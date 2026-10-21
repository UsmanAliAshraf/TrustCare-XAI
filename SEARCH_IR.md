# Patient Search: Fuzzy and Extended Boolean IR Model

This document explains how TrustCare XAI's patient search works, in code.
It implements the Week 6 Information Retrieval concepts:

1. Fuzzy set model of retrieval
2. Fuzzy AND, OR and NOT
3. Extended Boolean model (inclusion and exclusion)
4. Membership functions and relevance scores
5. Ranked retrieval

It improves the existing search box on the **Patients** page. The interface
is unchanged apart from a one-line syntax hint, and relevance scores are
never shown to the doctor or returned by the API.

> Search relevance is **not** a clinical score. It only decides the order of
> search results. It is separate from the adherence-risk prediction and its
> explanations, and searching never changes a prediction or a patient record.

---

## 1. Architecture

### Before

The Patients page downloaded every patient and filtered them in the browser
with `includes()` on name, ID and primary disease. It had no ranking, no
tolerance for spelling mistakes, no clinical fields and no Boolean logic.

### After

```
Patients page search box  (frontend/src/pages/Patients.tsx)
   │  typed query, 250 ms debounce
   ▼
api.searchPatients(q)      (frontend/src/api/client.ts)
   │  GET /api/patients/search?q=...&limit=100
   ▼
FastAPI route              (backend/routes/patients.py → search)
   │  passes only the records the caller may see
   ▼
services/search            (backend/services/search/)
   ├── query.py   parse the query into a tree (AND / OR / NOT / ( ))
   ├── text.py    normalise text, Levenshtein similarity, word matching
   ├── fields.py  searchable fields, adherence concepts, membership functions
   ├── engine.py  fuzzy operators, exclusion, threshold, ranking
   └── config.py  every threshold and weight in one place
   │
   ▼
list of patient records, most relevant first (no scores)
```

**Offline mode.** The frontend already includes an in-browser copy of every
backend function (`src/api/mockEngine.ts`), so the prototype runs without
Python. Search follows the same pattern: `frontend/src/lib/search.ts` is a
direct port of the Python package. If the backend is unreachable, the client
ranks the browser's local records with it. A **parity test** checks that both
implementations return identical results (section 8).

The search endpoint is a new route, `GET /patients/search`. All existing
endpoints are unchanged, and the response is a plain list of patient objects
in the same shape as `GET /patients`.

---

## 2. Query language

| You type | Meaning |
|---|---|
| `kwame walsh` | Words next to each other form **one phrase**; every word must be found in the same field |
| `"pill organiser"` | Quoted phrase (lets you search the literal words *and*, *or*, *not*) |
| `diabetes AND forgetful` | Both conditions: fuzzy AND |
| `diabetes OR hypertension` | Either condition: fuzzy OR |
| `NOT hypertension` | Exclusion (see section 6) |
| `(diabetes OR hypertension) AND NOT type 1` | Grouping with parentheses, plus Extended Boolean exclusion |
| `diabetes age>70` | A term next to a filter or a bracketed group means implicit AND |
| `age>65`, `missed>=2`, `meds>5` | Structured numeric filters |

* **Operators** `AND`, `OR` and `NOT` are case-insensitive.
* **Precedence** is `NOT` > `AND` > `OR`, so `a OR b AND c` means `a OR (b AND c)`.
  Use parentheses to change it.
* **Filters** are `age`, `meds`/`medications`, `missed`, `hosp`/`hospitalizations`,
  `duration`/`months` and `hours`, followed by `>`, `>=`, `<`, `<=` or `=` and a number.

The parser is a small recursive-descent parser (`query.py`). It does not
split strings on operators, so parentheses and precedence are handled
correctly. Malformed input raises `QueryError` with a message safe to show
the user, and the API returns it as HTTP 400:

| Input | Message |
|---|---|
| `(diabetes` | Missing closing parenthesis. |
| `diabetes AND` | AND must be followed by a search term. |
| `AND diabetes` | AND must come between two search terms. |
| `()` | Empty parentheses. |
| `"open` | Unclosed quotation mark ("). |
| `weight>80` | Unknown filter 'weight'. Filters available: ... |
| `age>>5` | Malformed filter 'age>>5'. Use the form age>60. |
| over 200 characters | Query is too long (maximum 200 characters). |

The query is only ever read by this parser. It is never passed to `eval`,
SQL or any other interpreter.

---

## 3. Normalisation and word matching (`text.py`)

`normalize()` converts to lowercase, removes accents and apostrophes, turns
other punctuation into spaces and collapses whitespace. So `O'Connor` becomes
`oconnor` and `Type-2` becomes `type 2`. This happens only on copies used
for comparison; stored records are never changed.

Each query word `q` is compared with each word `t` of a field:

| Evidence | Rule | Score |
|---|---|---|
| Exact | `q == t` | **1.0** |
| Prefix | `t` starts with `q`, and `q` has at least 3 characters | **0.75 + 0.2·len(q)/len(t)** (0.75–0.95) |
| Infix | `q` appears inside `t`, and `q` has at least 4 characters | **0.6** |
| Fuzzy spelling | similarity(q, t) ≥ 0.75, and `q` has at least 4 characters | **0.8 · similarity** (0.6–0.8) |
| Otherwise | | 0 |

The fuzzy similarity is normalised Levenshtein:

```python
def similarity(a, b):
    if not a and not b: return 1.0     # both empty: identical
    if not a or not b:  return 0.0     # one empty: nothing in common
    return 1.0 - levenshtein(a, b) / max(len(a), len(b))
```

For example, `diabetis` vs `diabetes` has distance 1 and length 8, so
similarity = 0.875, which passes the threshold and scores 0.7.

**Why this ordering?** An exact word is the strongest evidence, a prefix
(someone still typing, e.g. `kwam`) is next, and a spelling match is the
weakest because it may be a different word. The prefix score grows with how
much of the word was typed. The fuzzy score is capped at 0.8, so a typo
never outranks a correctly spelled match.

**Short queries.** Words under 3 characters must match a whole word exactly
(`de` finds nothing; `2` matches the word "2" in "Type 2 Diabetes").
Three-character words may only match as prefixes (`dep` finds Depression
but not fuzzy look-alikes). This stops tiny inputs from matching half the
dataset.

**Phrases.** A multi-word term scores the **minimum** over its words, each
taking its best match in the field. Every word has to be present, so
`type 2 diabetes` does **not** match "Type 1 Diabetes".

---

## 4. Searchable fields and the membership function (`fields.py`)

### 4.1 Field selection

| Field | Matched as | Weight `w_f` | Why |
|---|---|---|---|
| Patient ID | exact or prefix only, **never fuzzy** | 1.0 | A near-miss ID is a different patient |
| First + last name | text | 1.0 | Main way to identify a patient |
| Primary disease | text | 1.0 | Main clinical search |
| Secondary disease | text | 0.85 | Relevant, but secondary to the main diagnosis |
| Adherence concepts (4.2) | controlled vocabulary + membership function | 0.9 | Core to an adherence CDSS |
| Doctor notes | text | 0.7 | Free text: useful but noisier |
| Occupation, gender | text | 0.6 | Occasionally useful context |
| Age, medication count, missed appointments, hospitalisations, duration, hours | **numeric filters** (`age>60`) and concept ramps | — | Numbers are compared, not text-matched |
| Phone, address, religion, marital status, education | **not searchable** | — | No patient-finding use, and sensitive |

### 4.2 Adherence concepts: membership functions on attributes

Categorical and numeric adherence attributes are not turned into searchable
text. Instead, a **controlled vocabulary** maps query words to an attribute,
and a **membership function** gives the degree to which the patient belongs
to that fuzzy set:

| Query words (fuzzy-matched) | Fuzzy set | Membership μ(P) |
|---|---|---|
| forgetful, forgetfulness, forgets | forgetful | Often 1.0, Sometimes 0.6, Rarely 0 |
| financial, financial difficulty, cost | financial difficulty | Yes 1.0 |
| transport, transportation | transportation issues | Yes 1.0 |
| low support, low family support | low family support | Low 1.0, Medium 0.4 |
| no caregiver, lives alone | no caregiver | caregiver None 1.0 |
| smoker, smoking | smoker | Yes 1.0, Former 0.5 |
| alcohol, drinker | alcohol use | Regularly 1.0, Occasionally 0.5 |
| inactive, sedentary | physically inactive | exercise Rarely 1.0, Sometimes 0.4 |
| no reminders, no sms | no SMS reminders | No 1.0 |
| missed, missed appointments | missed appointments | ramp(missed, 0 → 4) |
| hospitalized, admissions | prior hospitalisations | ramp(hosp, 0 → 3) |
| polypharmacy, many medications | polypharmacy | ramp(meds, 3 → 6) |
| elderly, older, senior | elderly | ramp(age, 60 → 75) |
| long hours, overworked | long working hours | ramp(hours, 8 → 12) |

`ramp(x, lo, hi)` is the standard linear (trapezoidal-shoulder) membership
function: 0 at or below `lo`, 1 at or above `hi`, and linear in between.
For example, 2 missed appointments gives μ = 0.5. Graded memberships such as
"Sometimes forgetful = 0.6" are what make this a *fuzzy* model: a patient
can belong to a set partially, and ranks below one who belongs fully.

### 4.3 Membership of a patient in one search term

```
μ_t(P) = max(  w_id · id_score,
               max over text fields f:   w_f · phrase_score(t, f),
               max over concepts c:      w_concept · keyword_match(t, c) · μ_c(P)  )
```

**Why a weighted maximum?** The maximum is the fuzzy OR across fields: the
term is relevant if *any* field supports it, to the degree of the strongest
support. It also **avoids double-counting**. "Frequently forgets doses" in the
notes and "forgetfulness = Often" describe the same fact, and a sum would
reward one fact twice. The weight `w_f` scales evidence by how well that
field identifies what the doctor means: a name or diagnosis match is
stronger evidence than a word in a free-text note. The result always stays
in [0, 1].

The weights are **design choices** tuned for this application, not values
prescribed by the lecture. They all live in `config.py`.

---

## 5. Fuzzy AND, OR and NOT (`engine.py`)

```python
def fuzzy_and(*values): return min(values)    # μ(A AND B) = min(a, b)
def fuzzy_or(*values):  return max(values)    # μ(A OR B)  = max(a, b)
def fuzzy_not(value):   return 1.0 - value    # μ(NOT A)   = 1 - a

def membership(node, patient):
    if isinstance(node, Term):   return term_membership(node.tokens, patient)
    if isinstance(node, Filter): return 1.0 if compare(...) else 0.0   # crisp
    if isinstance(node, Not):    return fuzzy_not(membership(node.child, patient))
    if isinstance(node, And):    return fuzzy_and(*(membership(c, patient) for c in node.children))
    if isinstance(node, Or):     return fuzzy_or(*(membership(c, patient) for c in node.children))
```

Worked example: `diabetes AND forgetfulness` for a Type 2 Diabetes patient
whose forgetfulness is *Sometimes*:

* μ(diabetes) = 1.0 · 1.0 = 1.0 (exact word in primary disease)
* μ(forgetfulness) = 0.9 · 1.0 · 0.6 = 0.54 (concept weight × keyword match × membership of *Sometimes*)
* μ(AND) = min(1.0, 0.54) = **0.54**, which is ≥ 0.5, so the patient is returned.
  A patient whose forgetfulness is *Often* scores 0.9 and ranks above them.

---

## 6. Extended Boolean exclusion

Fuzzy NOT and strict exclusion are different, and the system uses both:

* **Fuzzy NOT** gives the complement score `1 − μ`. A patient who only weakly
  matches the negated term still gets a fairly high score.
* **Strict exclusion** removes the patient from the result set entirely.

**Rule.** A `NOT` at the **top level** of the query, either alone or as one
of the top-level `AND` operands, is an explicit exclusion:

```
(A OR B) AND NOT C    →    (A ∪ B) − C
```

```python
def exclusion_clauses(root):
    if isinstance(root, Not): return [root.child]
    if isinstance(root, And): return [c.child for c in root.children if isinstance(c, Not)]
    return []

for patient in patients:
    if any(membership(c, patient) >= EXCLUSION_THRESHOLD for c in exclusions):
        continue                                    # removed, whatever its score
    score = membership(root, patient)               # full fuzzy evaluation
    if score >= RELEVANCE_THRESHOLD: keep(patient, score)
```

The exclusion threshold (0.35) is **lower** than the relevance threshold
(0.5) on purpose: in doubt, a patient is excluded rather than kept. Without
strict exclusion, a patient whose notes mention "hypertensive" (μ = 0.42)
would survive `asthma AND NOT hypertension`, because 1 − 0.42 = 0.58 ≥ 0.5.
That case is covered by an automated test.

A `NOT` nested deeper, as in `asthma OR NOT hypertension`, is a pure fuzzy
complement. There, the doctor asked for "either", not for an exclusion.

---

## 7. Ranking and result selection

1. Use only the records the caller may see (the route passes the same set as
   `GET /patients`).
2. Drop any patient matched by an explicit exclusion.
3. Compute μ_q(P) for each remaining patient.
4. Keep only patients with μ ≥ **0.5** (relevance threshold).
5. Sort by μ, highest first. **Ties** keep the existing list order (newest
   registration first), so results are fully deterministic.
6. Return up to `limit` results (default 50, maximum 100) as plain patient
   records. The page asks for 100 and says when the cap is reached.

The system never opens a patient automatically or treats the top hit as "the"
patient. The doctor always chooses from the list. If nothing reaches the
threshold, the page shows "No matching patients found". The threshold is not
lowered just to return something.

---

## 8. Tests

### Backend: 31 tests (`backend/tests/test_search.py`, standard-library `unittest`)

They run against a small hand-built synthetic cohort, so every expectation
is explicit. Coverage includes:

| # | Requirement | Test |
|---|---|---|
| 1 | Exact name | `test_01_exact_name` |
| 2 | Partial name (`walsh`, `kwam`) | `test_02_partial_name` |
| 3 | Case-insensitive | `test_03_case_insensitive` |
| 4 | Disease match, primary above secondary | `test_04_disease_match` |
| 5 | Spelling mistakes (`diabetis`, `hypertensoin`) | `test_05_spelling_mistake` |
| 6 | Doctor notes | `test_06_doctor_notes` |
| 7 | Adherence fields with graded membership | `test_07_adherence_fields` |
| 8 | Unrelated query returns nothing | `test_08_unrelated_query` |
| 9–11 | AND = min, OR = max, NOT = 1 − a | `test_09` … `test_11` |
| 12 | Parentheses and precedence | `test_12_parentheses_and_precedence` |
| 13 | `(A ∪ B) − C` exclusion, plus strict vs fuzzy NOT | `test_13…`, `test_exclusion_is_strict…` |
| 14 | 11 malformed queries | `test_14_malformed_queries` |
| 15 | Empty input | `test_15_empty_input` |
| 16 | Very short queries | `test_16_short_queries` |
| 17 | Similar names (Kwame / Kwami) | `test_17_similar_names_ranked` |
| 18 | Deterministic order and tie-breaking | `test_18_deterministic_ordering` |
| 19 | Search never leaves the permitted record set | `test_19_only_searches_permitted_records` |
| 20 | API response contains no scores | `test_20_api_response_has_no_scores` |
| — | `diabetes AND forgetfulness` finds Type 2 + Often | `test_lecture_example…` |
| — | False positives (`type 2` ≠ Type 1, `male` ≠ Female), sensitive fields unsearchable, records and risk predictions untouched, 400 on bad query | further tests |

### Frontend: 55 parity tests (`frontend/tests/search-parity.test.ts`, Node's built-in test runner)

`backend/tests/make_search_parity_fixture.py` runs 54 queries through the
Python engine over the full 120-patient synthetic dataset. These cover
names, typos, Boolean expressions, filters and every error message. The
script saves the ranked IDs to `frontend/tests/search-parity.json`. The test
checks that `src/lib/search.ts` returns exactly the same IDs in the same
order, and that results carry no score fields.

---

## 9. Configuration (`backend/services/search/config.py`)

| Setting | Value | Purpose |
|---|---|---|
| `RELEVANCE_THRESHOLD` | 0.5 | Minimum μ for a patient to be returned |
| `EXCLUSION_THRESHOLD` | 0.35 | μ at which an explicitly excluded term removes a patient |
| `FUZZY_MIN_SIMILARITY` | 0.75 | Minimum Levenshtein similarity for a spelling match |
| `PREFIX_BASE` / `PREFIX_COVERAGE` | 0.75 / 0.2 | Prefix score range 0.75–0.95 |
| `SCORE_INFIX` / `FUZZY_SCALE` | 0.6 / 0.8 | Infix score; maximum fuzzy score |
| `MIN_PREFIX_LEN` / `MIN_INFIX_LEN` / `MIN_FUZZY_LEN` | 3 / 4 / 4 | Short-query rules |
| `FIELD_WEIGHTS` | see 4.1 | Per-field evidence weights |
| `MAX_QUERY_LENGTH` / `MAX_TERMS` | 200 / 12 | Input validation |
| `DEFAULT_LIMIT` / `MAX_LIMIT` | 50 / 100 | Result caps |

The same values appear in `SEARCH_CONFIG` in `frontend/src/lib/search.ts`.
If you change one, change both, regenerate the fixture and rerun the tests.

**New dependencies:** none. Similarity, parsing and tests use only the Python
standard library, TypeScript and Node's built-in test runner.

---

## 10. Limitations

* **Spelling is not meaning.** Fuzzy matching catches typos, not synonyms.
  `high blood pressure` does not find *Hypertension*, and `sugar` does not
  find *Diabetes*. A future version should map terms through a clinical
  terminology (e.g. SNOMED CT or ICD-10 synonyms) instead of an ad-hoc list.
  The only vocabulary added is the adherence-concept table above, which maps
  plain words to recorded attributes, not medical synonyms.
* **Short queries are deliberately strict.** 1–2 characters match only
  whole words, and 3 characters only prefixes, so `dpe` (a typo of "dep")
  finds nothing.
* **Operator words.** Because `and`, `or` and `not` are operators in any
  case, they can't be searched as plain words unless quoted
  (`"lives alone and"`).
* **Phrases stay within one field.** `diabetes forgetful` (no AND) looks for
  both words in the same field and finds nothing. Use
  `diabetes AND forgetful`, as the hint under the search box suggests.
* **Weights are hand-tuned**, not learned from relevance judgements. With a
  labelled query set they could be tuned against precision and recall.
* **Scale.** Each search scores every visible patient: O(patients × fields ×
  words). That is instant for hundreds of records. For tens of thousands, add
  a first stage that cheaply generates candidates (e.g. a trigram or prefix
  index, which still keeps one-letter typos) and run full fuzzy scoring only
  on those candidates.
* **Access control.** The prototype has no per-doctor permissions. The
  search route already searches only the list it is given, so once access
  rules exist, passing the doctor's permitted patients there is the only
  change needed (`test_19` covers that boundary).
* **Two implementations.** The browser fallback duplicates the Python logic.
  The parity test catches drift, but changes must be made in both places.

---

## 11. Running and testing locally

```bash
# Backend
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000
# Try it: http://127.0.0.1:8000/patients/search?q=(diabetes%20OR%20hypertension)%20AND%20NOT%20type%201
# or interactively at http://127.0.0.1:8000/docs

# Backend tests
python -m unittest discover -s tests -v

# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173 → Patients → search box
npm test             # parity tests (Node 22+)

# After changing search logic or the dataset, regenerate the parity fixture:
cd backend
python tests/make_search_parity_fixture.py
```

Queries to try on the Patients page: `kwam`, `diabetis`,
`diabetes AND forgetfulness`, `(diabetes OR hypertension) AND NOT type 1`,
`"pill organiser"`, `missed appointments AND financial`, `elderly AND no caregiver`,
`hypertension age>70`.
