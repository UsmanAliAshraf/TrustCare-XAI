# TrustCare XAI — MVP Prototype

**Explainable AI for Medication Adherence Risk Assessment**

A modern web-based Clinical Decision Support System (CDSS) that helps healthcare
professionals identify patients at risk of not following their prescribed
medications — and understand *why*, through factor-level explanations.

> ⚠️ **Prototype.** This MVP contains **no machine-learning model**. All
> predictions are produced by a transparent, rule-based **mock engine** that
> mirrors how the final AI-powered system will behave. The frontend consumes API
> responses exactly as if they came from a real model, so integrating one later
> only means swapping the backend's scoring function.

---

## What's inside

```
FYP/
├── data/              Synthetic patient dataset (shared by frontend + backend)
│   ├── generate_synthetic_patients.py   seeded generator
│   └── synthetic_patients.json          120 generated patients
├── frontend/          React + TypeScript + Tailwind + shadcn-style UI (Vite)
│   └── src/
│       ├── api/           API client, shared types, and the client-side mock engine
│       ├── components/    Reusable UI (ui/ primitives + domain components)
│       ├── hooks/         Auth & settings context
│       ├── lib/           utils, form options, PDF report generation
│       └── pages/         Login, Dashboard, Patients, Analysis, Reports, Settings
└── backend/           FastAPI mock backend
    ├── routes/            /dashboard, /patients, /analyze, /reports
    ├── services/          mock analysis engine + in-memory store
    ├── schemas/           Pydantic request/response models
    ├── mock_data/         loads data/synthetic_patients.json
    └── main.py
```

## Synthetic data

Patient records are not hand-written in the code. They come from a
**synthetic dataset**, `data/synthetic_patients.json`, which the FastAPI
backend and the in-browser fallback engine both load.

The dataset is produced by `data/generate_synthetic_patients.py`. Each
synthetic patient gets a hidden "adherence barrier" level, and risk-related
attributes (forgetfulness, missed appointments, financial difficulty, family
support, transport, SMS reminders, ...) are sampled with probabilities that
rise with it. Diseases depend on age, and comorbidities on the primary
disease. This keeps the attributes correlated the way they are in real
adherence data, instead of being independent random values. The default run
(120 patients, seed 42) gives roughly 20% low, 54% medium and 26% high risk.
No real people are described: names are random pairings, phone numbers use
the fictional 555-01xx range, and addresses are invented.

Regenerate it (the same seed always produces the same file):

```bash
python data/generate_synthetic_patients.py --count 120 --seed 42
```

The browser caches patients in localStorage under a versioned key. After
regenerating, clear site data (or bump `LS_PATIENTS` in
`frontend/src/api/mockEngine.ts`) so the offline mode picks up the new file.

## Features

- **Login** (mock auth — any credentials work)
- **Dashboard** — live stats, risk distribution chart, searchable recent patients
- **Patients** — ranked fuzzy search (names, IDs, diseases, notes, adherence
  factors, typos, AND / OR / NOT), filterable, paginated list, full profile view.
  See [SEARCH_IR.md](SEARCH_IR.md).
- **Browse by Condition** — structured (hierarchical) browsing of patients by
  condition category → condition, plus hyperlink browsing via related-patient
  links and condition anchors. See [IR_MODELS.md](IR_MODELS.md).
- **Patient registration & editing** — the complete intake form
- **Adherence Analysis** — loading animation → risk level, probability,
  confidence, SHAP-style explainability bars, circular risk gauge, and
  rule-based recommended interventions
- **PDF report** generation (patient details, prediction, factors,
  recommendations, doctor notes, hospital branding)
- **Reports** — saved analyses with download / delete
- **Settings** — hospital/doctor details, light & dark theme, notifications
- Fully responsive, loading skeletons, empty states, toasts, smooth animations

## Running it

You need **Node 18+** and **Python 3.10+**.

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows  (source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs are then available at http://127.0.0.1:8000/docs

### 2. Frontend (Vite)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

The Vite dev server proxies `/api/*` to the backend on port 8000.

> **Runs without the backend too.** If the FastAPI service isn't reachable, the
> frontend transparently falls back to an in-browser mock engine (persisted to
> `localStorage`), so the whole app is demoable with just `npm run dev`.

## Swapping in a real model later

The entire contract lives in the backend's `services/analysis.py`
(`analyze_patient`). Replace its body with a call to your trained model — keep
the response shape (`risk`, `probability`, `prediction`, `confidence`,
`factors`, `recommendations`) and **nothing on the frontend has to change**.
The mirrored logic in `frontend/src/api/mockEngine.ts` exists only for the
offline fallback and can be deleted once a real backend is always available.

## Tech stack

React · TypeScript · Tailwind CSS · shadcn-style components · React Router ·
Recharts · Lucide · Sonner · jsPDF · FastAPI · Pydantic · Uvicorn
