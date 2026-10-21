// Checks that the browser search port (src/lib/search.ts) ranks patients
// exactly like the reference Python implementation (backend/services/search).
// Expected results come from backend/tests/make_search_parity_fixture.py.
//
// Run:  npm test   (Node's built-in test runner; no extra dependencies)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { QueryError, searchPatients } from '../src/lib/search.ts'
import type { Patient } from '../src/api/types.ts'

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const patients: Patient[] = read('../../data/synthetic_patients.json')
const cases: { query: string; ids?: string[]; error?: string }[] = read('./search-parity.json')

for (const c of cases) {
  test(`parity: ${JSON.stringify(c.query)}`, () => {
    if (c.error !== undefined) {
      assert.throws(() => searchPatients(c.query, patients), (e: unknown) => e instanceof QueryError && e.message === c.error)
    } else {
      assert.deepEqual(
        searchPatients(c.query, patients).map((p) => p.id),
        c.ids,
      )
    }
  })
}

test('results are plain patient records without scores', () => {
  for (const p of searchPatients('diabetes AND forgetfulness', patients)) {
    assert.deepEqual(Object.keys(p).sort(), Object.keys(patients[0]).sort())
  }
})
