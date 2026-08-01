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
    ├── mock_data/         ~20 realistic (fake) patients
    └── main.py
```

## Features

- **Login** (mock auth — any credentials work)
- **Dashboard** — live stats, risk distribution chart, searchable recent patients
- **Patients** — searchable / filterable / paginated list, full profile view
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
