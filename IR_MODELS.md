# Information Retrieval Models in TrustCare XAI

This document explains which **Information Retrieval (IR) browsing models**
TrustCare XAI implements, why each was chosen for a clinical decision-support
setting, and exactly where each one lives in the code.

TrustCare XAI implements two browsing models from classic IR theory
(Baeza-Yates & Ribeiro-Neto, *Modern Information Retrieval*, "Browsing" models):

1. **Structure-guided (structured) browsing model**
2. **Hypertext (hyperlink) browsing model**

These sit alongside the system's existing **query-based retrieval** (the
keyword search and risk filter on the *Patients* page). Together they cover
the two ways a user looks for information: *retrieval*, when they know what
they want and can describe it, and *browsing*, when their need is vague,
exploratory, or easier to recognise than to describe.

---

## 1. Why browsing at all, and not search alone?

IR distinguishes between two user tasks:

| Task | The user... | Best served by |
|---|---|---|
| **Retrieval** | knows what they need and can phrase it ("Amelia Hughes", "P-1001") | Query + matching (our search box) |
| **Browsing** | has a vague or exploratory need ("which diabetic patients are high risk?", "who else looks like this patient?") | Navigation through structure and links |

Clinicians do both. A doctor at the start of a clinic session doesn't type a
query. They want an overview of their caseload by condition and risk. A doctor
reviewing one high-risk patient wants to see *similar* patients to compare
interventions. Neither need fits well into a keyword box, because the user
doesn't know which names or IDs to type. Browsing models answer these needs
without requiring the user to formulate a query.

There is also a cost argument: in a clinical setting, **recognition is cheaper
than recall**. Picking "Cardiovascular → Hypertension" from a visible list is
faster and less error-prone than remembering how a condition is spelled, and
mistakes are visible straight away.

---

## 2. Structure-guided browsing model

### What the model says

In structure-guided browsing, documents are organised into a **hierarchy of
classes** (a directory or taxonomy, like a library classification or a web
directory). The user starts at the root and moves top-down, narrowing the
scope at each level until they reach the documents they want. At every step
the system shows *where the user is* in the structure.

### How TrustCare XAI implements it

Patient records (the "documents") are classified into a three-level clinical
taxonomy:

```
All conditions                      (root)
├── Cardiovascular                  (category)
│   ├── Hypertension                (condition)
│   │   └── patient records         (leaves)
│   ├── High Cholesterol
│   ├── Congestive Heart Failure
│   └── Atrial Fibrillation
├── Metabolic & Endocrine
│   ├── Type 2 Diabetes
│   ├── Type 1 Diabetes
│   └── Hypothyroidism
├── Respiratory          (Asthma, COPD)
├── Mental Health        (Depression, Anxiety)
├── Neurological         (Epilepsy, Migraine, Parkinson's Disease)
├── Renal                (Chronic Kidney Disease)
├── Musculoskeletal      (Rheumatoid Arthritis, Osteoporosis)
└── Other / Unspecified  (catch-all, so every record is reachable)
```

Features of the **Browse** page (sidebar → *Browse*, route `/browse`):

| IR concept | Implementation |
|---|---|
| Class hierarchy | `TAXONOMY` in `frontend/src/lib/browse.ts` |
| Classifying documents into the hierarchy | `buildTree()` groups each patient by primary disease and files it under its category |
| Top-down navigation | Three URL levels: `/browse` → `/browse/:category` → `/browse/:category/:disease` |
| Showing the whole structure | Collapsible directory tree with per-node record counts (`Tree` in `pages/Browse.tsx`) |
| "Where am I?" context | Breadcrumb trail (`Home › Browse › Metabolic & Endocrine › Type 2 Diabetes`) |
| Node summaries to guide the next choice | Each category and condition card shows its patient count and a High/Medium/Low risk-mix bar |
| Completeness | Unknown or missing diagnoses go into an *Other / Unspecified* node, so no record is unreachable |

Each level is a real URL, so a node can be bookmarked, shared, or reached with
the browser's back button.

### Why this model fits TrustCare XAI

- **It matches how clinicians already think.** Medicine organises knowledge by
  body system and then by diagnosis (similar in spirit to ICD chapters). A
  hierarchy shaped like that needs no training to use.
- **It supports caseload overview, a core CDSS task.** The risk-mix bar on
  each node shows straight away *where* adherence risk is concentrated (for
  example, most metabolic patients being high risk). A flat list or a search
  box cannot show that.
- **Narrowing is gradual and safe.** Each step cuts the result set down
  without ever reaching zero by accident, unlike a mistyped search query.
- **It scales.** As the patient base grows, a flat list becomes unusable. A
  hierarchy keeps every level small enough to scan.
- **It tells the user where they are.** Breadcrumbs and the highlighted tree
  node always show the user's position, which addresses the
  "lost in hyperspace" problem.

---

## 3. Hypertext (hyperlink) browsing model

### What the model says

The hypertext model treats the collection as a **directed graph**: documents
are **nodes**, and **links** connect related nodes. Each link has an
**anchor** that tells the user what lies at the other end. The user reads a
node, picks a link that looks relevant, and jumps to the next node, following
their interest rather than a fixed structure. Because users can get lost in a
graph, hypertext systems usually provide **navigation aids** such as history
trails and context indicators.

### How TrustCare XAI implements it

Every patient record is a node. The system computes **typed links** between
records and also links records to nodes of the taxonomy:

| Link type | Connects a patient to... | Weight |
|---|---|---|
| **Same primary disease** | other patients with the same primary diagnosis | 3 |
| **Shared comorbidity** | patients whose primary or secondary condition overlaps | 2 |
| **Same risk level** | patients in the same adherence-risk band | 1 |
| **Similar age (±5 yrs)** | patients of comparable age | 1 |
| **Condition anchors** | the condition's node in the browsing hierarchy | — |

| IR concept | Implementation |
|---|---|
| Nodes | Patient detail pages, `/patients/:id` |
| Typed, weighted links | `relatedLinks()` in `frontend/src/lib/browse.ts` |
| Anchors that describe the destination | **Related Patients** panel (`components/RelatedPatients.tsx`): each link shows name, condition, age, risk and coloured link-type labels saying *why* it is related |
| Link ranking | Links are sorted by summed weight, so the most strongly related records come first (top 8 shown) |
| Links between the two models | Condition names are hyperlinks into the hierarchy wherever they appear: patient header badges, the Medical section, the Patients table, the Dashboard table, the Reports table (`components/DiseaseLink.tsx`) |
| Other links | Reports → patient; patient → analysis, edit, reports |
| Navigation aid: history | **Recently visited** trail (`components/BrowsingTrail.tsx`) records the patients and hierarchy nodes visited this session so the user can go back |
| Navigation aid: context | Patient breadcrumbs show the record's position in the hierarchy (`Browse › Cardiovascular › Hypertension › Patient`) |

A link is only created when it carries real clinical meaning: a shared
condition, or at least two weaker signals together. That keeps the graph from
filling up with noise.

### Why this model fits TrustCare XAI

- **Case-based reasoning.** Clinicians often decide by comparing a patient
  with similar past cases ("what worked for the other high-risk diabetics?").
  Related-patient links make that comparison one click away instead of a
  manual search.
- **It supports explainability, the core aim of the project.** The XAI
  explanation says *which factors* drive one patient's risk. Following links
  to similar patients lets a clinician check whether those factors and risk
  levels hold across comparable cases, which builds trust in the prediction.
- **Comorbidities are naturally a graph.** A patient with diabetes *and*
  hypertension belongs to two clinical groups at once. A strict hierarchy
  files them in only one place. Comorbidity links recover the other connection.
- **Typed anchors tell the user what to expect.** Each link says *why* it
  exists (same disease, shared comorbidity, same risk, similar age), so the
  user can judge whether it is worth following before clicking.
- **The trail and breadcrumbs address disorientation.** Free graph navigation
  can leave users lost. The session trail and the hierarchy breadcrumbs give
  them a way back and a sense of position.

---

## 4. How the models work together

The two models are linked, not separate features:

```
          ┌──────────── Structured browsing ────────────┐
/browse ─► Category ─► Condition ─► Patient record ◄────┐
                 ▲          ▲            │               │
                 │          └─ condition │ anchors       │ typed
                 └──── breadcrumbs ──────┘               │ links
                                         └─► Related patient records
          └──────────── Hypertext browsing ─────────────┘
```

A typical session:

1. A clinician opens **Browse** and sees that *Metabolic & Endocrine* has the
   largest share of high-risk patients (structured, top-down).
2. They drill into *Type 2 Diabetes* and open *Amelia Hughes* (structured).
3. In **Related Patients**, they follow *Benjamin Clarke*, linked by
   "Same primary disease" and "Same risk level" (hypertext).
4. On his record they click the *Hypertension* comorbidity badge, which takes
   them back into the hierarchy at *Cardiovascular › Hypertension*
   (hypertext → structured).
5. The **Recently visited** trail lets them return to any earlier step.

Search on the Patients page is still there for known-item lookups.
Browsing does not replace retrieval; it adds the exploratory half of
information seeking that a query box cannot provide.

---

## 5. Where to find it in the code

| File | Role |
|---|---|
| `frontend/src/lib/browse.ts` | Taxonomy, tree building, typed-link scoring, browsing trail |
| `frontend/src/pages/Browse.tsx` | Structured browsing UI: tree, category/condition cards, leaf patient list |
| `frontend/src/components/RelatedPatients.tsx` | Hypertext link panel on each patient record |
| `frontend/src/components/DiseaseLink.tsx` | Condition anchors that link into the hierarchy |
| `frontend/src/components/BrowsingTrail.tsx` | "Recently visited" navigation aid |
| `frontend/src/pages/PatientDetails.tsx` | Patient node: hierarchy breadcrumbs, condition anchors, related links |
| `frontend/src/App.tsx`, `components/layout/Sidebar.tsx` | `/browse` routes and sidebar entry |

## 6. Limitations and future work

- **Single classification axis.** Patients are filed by primary disease only.
  A future version could add *faceted* browsing (for example category × risk
  × age band) so users can pivot the hierarchy.
- **Hand-built links.** Related-patient links use transparent rules, like the
  rest of the prototype. Once the ML model is integrated, links could instead
  come from similarity in the model's feature or SHAP-explanation space, so
  that "related" means "at risk for the same reasons".
- **Client-side computation.** The tree and links are built in the browser
  from the patient list. At hospital scale they should move to the backend
  (an indexed `/browse` endpoint and a precomputed link table).
- **Fixed taxonomy.** The category list is fixed in code. A production system
  should map diagnoses through a standard coding system such as ICD-10.

## Reference

R. Baeza-Yates and B. Ribeiro-Neto, *Modern Information Retrieval*,
Addison-Wesley / ACM Press, chapter on retrieval and browsing models
(flat browsing, structure-guided browsing, and the hypertext model).
