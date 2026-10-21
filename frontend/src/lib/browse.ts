// Information-retrieval browsing models.
//
// 1. Structure-guided browsing: patients are organised in a fixed taxonomy
//    (Disease Category -> Disease -> Patient). Users navigate top-down through
//    the hierarchy instead of formulating a query.
// 2. Hypertext (hyperlink) browsing: every patient record is a node; typed
//    links connect it to related nodes (same disease, shared comorbidity,
//    same risk band, similar age) and to its taxonomy node, so users can
//    hop record-to-record by following anchors.

import type { Patient, RiskLevel } from '@/api/types'

// ---- Taxonomy (structured browsing) ----------------------------------------

export interface Category {
  slug: string
  name: string
  description: string
  diseases: string[]
}

export const TAXONOMY: Category[] = [
  {
    slug: 'cardiovascular',
    name: 'Cardiovascular',
    description: 'Heart and blood-vessel conditions',
    diseases: ['Hypertension', 'High Cholesterol', 'Congestive Heart Failure', 'Atrial Fibrillation'],
  },
  {
    slug: 'metabolic-endocrine',
    name: 'Metabolic & Endocrine',
    description: 'Hormonal and metabolic disorders',
    diseases: ['Type 2 Diabetes', 'Type 1 Diabetes', 'Hypothyroidism'],
  },
  {
    slug: 'respiratory',
    name: 'Respiratory',
    description: 'Chronic lung and airway conditions',
    diseases: ['Asthma', 'COPD'],
  },
  {
    slug: 'mental-health',
    name: 'Mental Health',
    description: 'Mood and anxiety disorders',
    diseases: ['Depression', 'Anxiety'],
  },
  {
    slug: 'neurological',
    name: 'Neurological',
    description: 'Brain and nervous-system disorders',
    diseases: ['Epilepsy', 'Migraine', "Parkinson's Disease"],
  },
  {
    slug: 'renal',
    name: 'Renal',
    description: 'Kidney conditions',
    diseases: ['Chronic Kidney Disease'],
  },
  {
    slug: 'musculoskeletal',
    name: 'Musculoskeletal',
    description: 'Bone, joint and autoimmune conditions',
    diseases: ['Rheumatoid Arthritis', 'Osteoporosis'],
  },
]

// Catch-all node so every record is reachable through the hierarchy.
export const OTHER: Category = {
  slug: 'other',
  name: 'Other / Unspecified',
  description: 'Conditions outside the taxonomy, or not recorded',
  diseases: [],
}

export const slugify = (s: string) =>
  s.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const UNSPECIFIED = 'Unspecified'

export function diseaseOf(p: Patient) {
  return p.primaryDisease && p.primaryDisease !== 'None' ? p.primaryDisease : UNSPECIFIED
}

export function categoryOf(disease: string): Category {
  return TAXONOMY.find((c) => c.diseases.includes(disease)) ?? OTHER
}

export function categoryBySlug(slug?: string): Category | undefined {
  return slug === OTHER.slug ? OTHER : TAXONOMY.find((c) => c.slug === slug)
}

export const categoryPath = (c: Category) => `/browse/${c.slug}`
export const diseasePath = (disease: string) =>
  `/browse/${categoryOf(disease).slug}/${slugify(disease)}`

export interface TreeNode {
  category: Category
  diseases: { name: string; patients: Patient[] }[]
  total: number
}

// Build the populated hierarchy. Diseases from the taxonomy always appear
// (even when empty); unknown diseases are filed under "Other".
export function buildTree(patients: Patient[]): TreeNode[] {
  const byDisease = new Map<string, Patient[]>()
  for (const p of patients) {
    const d = diseaseOf(p)
    byDisease.set(d, [...(byDisease.get(d) ?? []), p])
  }

  const known = new Set(TAXONOMY.flatMap((c) => c.diseases))
  const otherDiseases = [...byDisease.keys()].filter((d) => !known.has(d)).sort()

  return [...TAXONOMY, { ...OTHER, diseases: otherDiseases }].map((category) => {
    const diseases = category.diseases.map((name) => ({ name, patients: byDisease.get(name) ?? [] }))
    return { category, diseases, total: diseases.reduce((n, d) => n + d.patients.length, 0) }
  })
}

// ---- Hypertext links (hyperlink browsing) ----------------------------------

export type LinkType = 'same-disease' | 'comorbidity' | 'same-risk' | 'similar-age'

export const LINK_LABELS: Record<LinkType, string> = {
  'same-disease': 'Same primary disease',
  comorbidity: 'Shared comorbidity',
  'same-risk': 'Same risk level',
  'similar-age': 'Similar age (±5 yrs)',
}

export interface RelatedLink {
  patient: Patient
  risk: RiskLevel
  types: LinkType[]
  score: number
}

const WEIGHT: Record<LinkType, number> = {
  'same-disease': 3,
  comorbidity: 2,
  'same-risk': 1,
  'similar-age': 1,
}

const conditions = (p: Patient) =>
  [p.primaryDisease, p.secondaryDisease].filter((d) => d && d !== 'None')

// Outgoing typed links from `source` to every other record it is related to,
// strongest first.
export function relatedLinks(
  source: Patient,
  all: Patient[],
  riskOf: (p: Patient) => RiskLevel,
  limit = 8,
): RelatedLink[] {
  const sourceRisk = riskOf(source)
  const sourceConds = conditions(source)

  return all
    .filter((p) => p.id !== source.id)
    .map((p) => {
      const types: LinkType[] = []
      if (diseaseOf(p) !== UNSPECIFIED && diseaseOf(p) === diseaseOf(source)) types.push('same-disease')
      else if (conditions(p).some((c) => sourceConds.includes(c))) types.push('comorbidity')
      const risk = riskOf(p)
      if (risk === sourceRisk) types.push('same-risk')
      if (Math.abs(p.age - source.age) <= 5) types.push('similar-age')
      return { patient: p, risk, types, score: types.reduce((n, t) => n + WEIGHT[t], 0) }
    })
    .filter((l) => l.types.some((t) => t === 'same-disease' || t === 'comorbidity') || l.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ---- Browsing trail (navigation history across visited nodes) ---------------

export interface TrailEntry {
  label: string
  to: string
}

const TRAIL_KEY = 'trustcare.trail'
const TRAIL_MAX = 6

export function readTrail(): TrailEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(TRAIL_KEY) || '[]')
  } catch {
    return []
  }
}

export function pushTrail(entry: TrailEntry) {
  try {
    const next = [entry, ...readTrail().filter((e) => e.to !== entry.to)].slice(0, TRAIL_MAX)
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable - trail is a convenience only */
  }
}
