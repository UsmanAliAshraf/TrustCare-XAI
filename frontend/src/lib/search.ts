// Fuzzy / Extended Boolean patient search - browser copy.
//
// Line-for-line port of backend/services/search (config, text, query, fields,
// engine) used by the offline mock engine, exactly as mockEngine.ts mirrors
// the rest of the backend. The Python package is the reference
// implementation; tests/search-parity.test.ts checks this port returns the
// same ranked results. Change both together. See SEARCH_IR.md.
//
// Scores never leave this module: callers get patient records only.

import type { Patient } from '@/api/types'

// ---- config ------------------------------------------------------------------
export const SEARCH_CONFIG = {
  MAX_QUERY_LENGTH: 200,
  MAX_TERMS: 12,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  RELEVANCE_THRESHOLD: 0.5,
  EXCLUSION_THRESHOLD: 0.35,
  SCORE_EXACT: 1.0,
  PREFIX_BASE: 0.75,
  PREFIX_COVERAGE: 0.2,
  SCORE_INFIX: 0.6,
  FUZZY_SCALE: 0.8,
  FUZZY_MIN_SIMILARITY: 0.75,
  MIN_PREFIX_LEN: 3,
  MIN_INFIX_LEN: 4,
  MIN_FUZZY_LEN: 4,
}
const C = SEARCH_CONFIG

const FIELD_WEIGHTS = {
  id: 1.0,
  name: 1.0,
  primaryDisease: 1.0,
  secondaryDisease: 0.85,
  concept: 0.9,
  doctorNotes: 0.7,
  occupation: 0.6,
  gender: 0.6,
}

const NUMERIC_FILTERS: Record<string, keyof Patient> = {
  age: 'age',
  meds: 'medicationCount',
  medications: 'medicationCount',
  medication: 'medicationCount',
  missed: 'missedAppointments',
  hospitalizations: 'hospitalizations',
  hospitalisations: 'hospitalizations',
  hosp: 'hospitalizations',
  duration: 'medicationDurationMonths',
  months: 'medicationDurationMonths',
  hours: 'dailyWorkingHours',
}

export class QueryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QueryError'
  }
}

// ---- text --------------------------------------------------------------------
export function normalize(text: string): string {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const tokenize = (text: string) => normalize(text).split(' ').filter(Boolean)
const compact = (text: string) => normalize(text).replace(/ /g, '')

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length < b.length) [a, b] = [b, a]
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)))
    }
    prev = cur
  }
  return prev[b.length]
}

export function similarity(a: string, b: string): number {
  if (!a && !b) return 1
  if (!a || !b) return 0
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

export function tokenScore(q: string, t: string): number {
  if (q === t) return C.SCORE_EXACT
  const n = q.length
  if (n < C.MIN_PREFIX_LEN) return 0
  if (t.startsWith(q)) return C.PREFIX_BASE + (C.PREFIX_COVERAGE * n) / t.length
  let best = 0
  if (n >= C.MIN_INFIX_LEN && t.includes(q)) best = C.SCORE_INFIX
  if (n >= C.MIN_FUZZY_LEN) {
    const sim = similarity(q, t)
    if (sim >= C.FUZZY_MIN_SIMILARITY) best = Math.max(best, C.FUZZY_SCALE * sim)
  }
  return best
}

function phraseScore(query: string[], field: string[]): number {
  if (!query.length || !field.length) return 0
  return Math.min(...query.map((q) => Math.max(...field.map((t) => tokenScore(q, t)))))
}

// ---- query (AST + parser) ----------------------------------------------------
export type QueryNode =
  | { kind: 'term'; tokens: string[] }
  | { kind: 'filter'; field: keyof Patient; op: string; value: number }
  | { kind: 'not'; child: QueryNode }
  | { kind: 'and'; children: QueryNode[] }
  | { kind: 'or'; children: QueryNode[] }

type Tok =
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'op'; op: 'AND' | 'OR' | 'NOT' }
  | { kind: 'word' | 'phrase'; words: string[] }
  | { kind: 'filter'; node: QueryNode }

const TOKEN =
  /(?<space>\s+)|(?<lparen>\()|(?<rparen>\))|(?<quote>"[^"]*")|(?<filter>[A-Za-z]+\s*(?:>=|<=|>|<|=)\s*\d{1,5}(?![\w.]))|(?<word>[^\s()"]+)/y
const FILTER = /^([A-Za-z]+)\s*(>=|<=|>|<|=)\s*(\d+)$/
const OPERATORS: Record<string, 'AND' | 'OR' | 'NOT'> = { and: 'AND', or: 'OR', not: 'NOT' }

function lex(text: string): Tok[] {
  const tokens: Tok[] = []
  let pos = 0
  while (pos < text.length) {
    TOKEN.lastIndex = pos
    const m = TOKEN.exec(text)
    if (!m || !m.groups) throw new QueryError('Unclosed quotation mark (").')
    pos = TOKEN.lastIndex
    const g = m.groups
    const value = m[0]
    if (g.space !== undefined) continue
    if (g.lparen !== undefined) tokens.push({ kind: 'lparen' })
    else if (g.rparen !== undefined) tokens.push({ kind: 'rparen' })
    else if (g.quote !== undefined) {
      const words = tokenize(value.slice(1, -1))
      if (!words.length) throw new QueryError('Quoted phrase is empty.')
      tokens.push({ kind: 'phrase', words })
    } else if (g.filter !== undefined) {
      const [, name, op, number] = FILTER.exec(value)!
      const field = NUMERIC_FILTERS[name.toLowerCase()]
      if (!field) {
        const names = [...new Set(Object.keys(NUMERIC_FILTERS))].sort().join(', ')
        throw new QueryError(`Unknown filter '${name}'. Filters available: ${names}.`)
      }
      tokens.push({ kind: 'filter', node: { kind: 'filter', field, op, value: Number(number) } })
    } else {
      if (/[<>=]/.test(value)) throw new QueryError(`Malformed filter '${value}'. Use the form age>60.`)
      const op = OPERATORS[value.toLowerCase()]
      if (op) tokens.push({ kind: 'op', op })
      else {
        const words = tokenize(value)
        if (words.length) tokens.push({ kind: 'word', words })
      }
    }
  }
  return tokens
}

class Parser {
  private i = 0
  private terms = 0
  private tokens: Tok[]
  constructor(tokens: Tok[]) {
    this.tokens = tokens
  }

  private peek(): Tok | undefined {
    return this.tokens[this.i]
  }
  private isOp(op: string) {
    const t = this.peek()
    return t?.kind === 'op' && t.op === op
  }
  private startsOperand() {
    const t = this.peek()
    return !!t && (['lparen', 'word', 'phrase', 'filter'].includes(t.kind) || (t.kind === 'op' && t.op === 'NOT'))
  }

  parse(): QueryNode {
    const node = this.orExpr()
    const t = this.peek()
    if (t) throw new QueryError(t.kind === 'rparen' ? "Unexpected ')'." : 'Unexpected operator.')
    return node
  }

  private orExpr(): QueryNode {
    const children = [this.andExpr()]
    while (this.isOp('OR')) {
      this.i++
      if (!this.startsOperand()) throw new QueryError('OR must be followed by a search term.')
      children.push(this.andExpr())
    }
    return children.length === 1 ? children[0] : { kind: 'or', children }
  }

  private andExpr(): QueryNode {
    const children = [this.notExpr()]
    for (;;) {
      if (this.isOp('AND')) {
        this.i++
        if (!this.startsOperand()) throw new QueryError('AND must be followed by a search term.')
      } else if (!this.startsOperand()) break
      children.push(this.notExpr())
    }
    return children.length === 1 ? children[0] : { kind: 'and', children }
  }

  private notExpr(): QueryNode {
    if (this.isOp('NOT')) {
      this.i++
      if (!this.startsOperand()) throw new QueryError('NOT must be followed by a search term.')
      return { kind: 'not', child: this.notExpr() }
    }
    return this.primary()
  }

  private primary(): QueryNode {
    const t = this.peek()
    if (!t) throw new QueryError('Query is incomplete.')
    if (t.kind === 'lparen') {
      this.i++
      if (this.peek()?.kind === 'rparen') throw new QueryError('Empty parentheses.')
      const node = this.orExpr()
      if (this.peek()?.kind !== 'rparen') throw new QueryError('Missing closing parenthesis.')
      this.i++
      return node
    }
    if (t.kind === 'rparen') throw new QueryError("Unexpected ')'.")
    if (t.kind === 'op') throw new QueryError(`${t.op} must come between two search terms.`)
    this.terms++
    if (this.terms > C.MAX_TERMS) throw new QueryError(`Too many search terms (maximum ${C.MAX_TERMS}).`)
    this.i++
    if (t.kind === 'filter') return t.node
    const words = [...t.words]
    if (t.kind === 'word') {
      for (let n = this.peek(); n?.kind === 'word'; n = this.peek()) {
        words.push(...n.words)
        this.i++
      }
    }
    return { kind: 'term', tokens: words }
  }
}

export function parseQuery(text: string): QueryNode | null {
  if (text.length > C.MAX_QUERY_LENGTH)
    throw new QueryError(`Query is too long (maximum ${C.MAX_QUERY_LENGTH} characters).`)
  const tokens = lex(text)
  return tokens.length ? new Parser(tokens).parse() : null
}

// ---- fields, concepts, membership functions ----------------------------------
export function ramp(x: number, lo: number, hi: number): number {
  if (x <= lo) return 0
  if (x >= hi) return 1
  return (x - lo) / (hi - lo)
}

const num = (p: Patient, field: keyof Patient) => Number(p[field]) || 0
const level =
  (field: keyof Patient, levels: Record<string, number>) =>
  (p: Patient) =>
    levels[String(p[field] ?? '').trim().toLowerCase()] ?? 0

interface ConceptDef {
  keywords: string[]
  membership: (p: Patient) => number
}

const CONCEPT_DEFS: ConceptDef[] = [
  { keywords: ['forgetful', 'forgetfulness', 'forgets', 'forgetting'], membership: level('forgetfulness', { often: 1, sometimes: 0.6 }) },
  { keywords: ['financial difficulty', 'financial', 'finances', 'cost'], membership: level('financialDifficulty', { yes: 1 }) },
  { keywords: ['transportation issues', 'transportation', 'transport'], membership: level('transportationIssues', { yes: 1 }) },
  { keywords: ['low family support', 'low support', 'poor support'], membership: level('familySupport', { low: 1, medium: 0.4 }) },
  { keywords: ['no caregiver', 'lives alone', 'alone'], membership: level('caregiver', { none: 1, '': 1 }) },
  { keywords: ['smoker', 'smokers', 'smoking', 'smokes'], membership: level('smoking', { yes: 1, former: 0.5 }) },
  { keywords: ['alcohol', 'drinker', 'drinking'], membership: level('alcohol', { regularly: 1, occasionally: 0.5 }) },
  { keywords: ['inactive', 'sedentary', 'no exercise'], membership: level('exercise', { rarely: 1, sometimes: 0.4 }) },
  { keywords: ['no reminders', 'no sms', 'no sms reminders'], membership: level('smsReminders', { no: 1 }) },
  { keywords: ['missed appointments', 'missed', 'no show'], membership: (p) => ramp(num(p, 'missedAppointments'), 0, 4) },
  {
    keywords: ['hospitalized', 'hospitalised', 'hospitalization', 'hospitalisation', 'hospitalizations', 'admissions'],
    membership: (p) => ramp(num(p, 'hospitalizations'), 0, 3),
  },
  { keywords: ['polypharmacy', 'many medications'], membership: (p) => ramp(num(p, 'medicationCount'), 3, 6) },
  { keywords: ['elderly', 'older', 'senior'], membership: (p) => ramp(num(p, 'age'), 60, 75) },
  { keywords: ['long hours', 'long working hours', 'overworked'], membership: (p) => ramp(num(p, 'dailyWorkingHours'), 8, 12) },
]
const CONCEPTS = CONCEPT_DEFS.map((c) => ({ ...c, keywordTokens: c.keywords.map(tokenize) }))

function conceptMatch(term: string[], keyword: string[]): number {
  if (term.length !== keyword.length) return 0
  return Math.min(...term.map((q, i) => phraseScore([q], [keyword[i]])))
}

type TextField = 'name' | 'primaryDisease' | 'secondaryDisease' | 'doctorNotes' | 'occupation' | 'gender'

interface PatientIndex {
  patient: Patient
  idCompact: string
  idDigits: string
  text: [TextField, string[]][]
}

function indexPatient(p: Patient): PatientIndex {
  const idCompact = compact(p.id)
  return {
    patient: p,
    idCompact,
    idDigits: idCompact.replace(/\D/g, ''),
    text: [
      ['name', tokenize(`${p.firstName ?? ''} ${p.lastName ?? ''}`)],
      ['primaryDisease', tokenize(p.primaryDisease)],
      ['secondaryDisease', tokenize(p.secondaryDisease).filter((t) => t !== 'none')],
      ['doctorNotes', tokenize(p.doctorNotes)],
      ['occupation', tokenize(p.occupation)],
      ['gender', tokenize(p.gender)],
    ],
  }
}

function idScore(term: string[], ix: PatientIndex): number {
  const q = term.join('')
  if (!q || !ix.idCompact) return 0
  if (q === ix.idCompact || q === ix.idDigits) return C.SCORE_EXACT
  for (const target of [ix.idCompact, ix.idDigits]) {
    if (q.length >= C.MIN_PREFIX_LEN && target.startsWith(q))
      return C.PREFIX_BASE + (C.PREFIX_COVERAGE * q.length) / target.length
  }
  return 0
}

function termMembership(term: string[], ix: PatientIndex): number {
  let best = FIELD_WEIGHTS.id * idScore(term, ix)
  for (const [field, tokens] of ix.text) {
    if (best >= FIELD_WEIGHTS[field]) continue
    best = Math.max(best, FIELD_WEIGHTS[field] * phraseScore(term, tokens))
  }
  for (const c of CONCEPTS) {
    const match = Math.max(...c.keywordTokens.map((k) => conceptMatch(term, k)))
    if (match > 0) best = Math.max(best, FIELD_WEIGHTS.concept * match * c.membership(ix.patient))
  }
  return best
}

// ---- engine: fuzzy operators, exclusion, ranking -----------------------------
export const fuzzyAnd = (...v: number[]) => Math.min(...v)
export const fuzzyOr = (...v: number[]) => Math.max(...v)
export const fuzzyNot = (v: number) => 1 - v

const COMPARE: Record<string, (a: number, b: number) => boolean> = {
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '=': (a, b) => a === b,
}

function membership(node: QueryNode, ix: PatientIndex): number {
  switch (node.kind) {
    case 'term':
      return termMembership(node.tokens, ix)
    case 'filter':
      return COMPARE[node.op](num(ix.patient, node.field), node.value) ? 1 : 0
    case 'not':
      return fuzzyNot(membership(node.child, ix))
    case 'and':
      return fuzzyAnd(...node.children.map((c) => membership(c, ix)))
    case 'or':
      return fuzzyOr(...node.children.map((c) => membership(c, ix)))
  }
}

function exclusionClauses(root: QueryNode): QueryNode[] {
  if (root.kind === 'not') return [root.child]
  if (root.kind === 'and') return root.children.flatMap((c) => (c.kind === 'not' ? [c.child] : []))
  return []
}

/**
 * Rank `patients` against `query` and return the matching records, most
 * relevant first. `patients` must already be limited to records the user may
 * see; its order breaks ties. Throws QueryError for malformed queries.
 */
export function searchPatients(query: string, patients: Patient[], limit = C.DEFAULT_LIMIT): Patient[] {
  const root = parseQuery(query.trim())
  if (!root) return []
  limit = Math.max(1, Math.min(limit, C.MAX_LIMIT))
  const exclusions = exclusionClauses(root)

  const ranked: { score: number; position: number; patient: Patient }[] = []
  patients.forEach((patient, position) => {
    const ix = indexPatient(patient)
    if (exclusions.some((c) => membership(c, ix) >= C.EXCLUSION_THRESHOLD)) return
    const score = membership(root, ix)
    if (score >= C.RELEVANCE_THRESHOLD) ranked.push({ score: Math.round(score * 1e9) / 1e9, position, patient })
  })
  ranked.sort((a, b) => b.score - a.score || a.position - b.position)
  return ranked.slice(0, limit).map((r) => r.patient)
}
