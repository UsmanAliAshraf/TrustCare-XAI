"""Synthetic patient dataset generator for TrustCare XAI.

Produces `synthetic_patients.json`: fictional patient records with the same
fields as the Patient Registration form. Nothing here describes a real person:
names are random first/last-name pairings, phone numbers use the reserved
555-01xx fictional range, and addresses are invented.

Records are not independent coin flips per field. Each patient gets a latent
"adherence barrier" level in [0, 1], and every risk-related attribute
(forgetfulness, missed appointments, financial difficulty, support, ...) is
sampled with a probability that rises with that level. This gives the
correlated structure seen in real adherence data, so the dataset spans a
realistic mix of low, medium and high risk instead of uniform noise.
Diseases depend on age, and comorbidities on the primary disease.

The generator is seeded, so the same command always produces the same file:

    python data/generate_synthetic_patients.py            # 120 patients
    python data/generate_synthetic_patients.py --count 200 --seed 7
"""

from __future__ import annotations

import argparse
import json
import random
from datetime import date, timedelta
from pathlib import Path

OUT_FILE = Path(__file__).with_name("synthetic_patients.json")
TODAY = date(2026, 10, 20)  # fixed so regeneration is reproducible

FEMALE_NAMES = [
    "Amelia", "Sofia", "Grace", "Fatima", "Olivia", "Isabella", "Priya", "Aisha",
    "Hannah", "Mei", "Chloe", "Zara", "Elena", "Ayesha", "Nora", "Maya", "Leila",
    "Ruth", "Sana", "Clara", "Ingrid", "Yuki", "Amara", "Lucia", "Hira", "Esther",
    "Naomi", "Mariam", "Freya", "Anika",
]
MALE_NAMES = [
    "Daniel", "James", "Mohammed", "Carlos", "Benjamin", "Lucas", "Arjun", "Omar",
    "Ethan", "Kenji", "Samuel", "Ali", "Mateo", "David", "Hassan", "Noah", "Ivan",
    "Tariq", "George", "Rahul", "Felix", "Kwame", "Bilal", "Henry", "Usman",
    "Leo", "Andre", "Imran", "Victor", "Thomas",
]
LAST_NAMES = [
    "Hughes", "Foster", "Martinez", "Rahman", "Okafor", "O'Connor", "Patel", "Chen",
    "Reyes", "Nakamura", "Al-Sayed", "Rossi", "Meyer", "Clarke", "Khan", "Silva",
    "Novak", "Mensah", "Haddad", "Kowalski", "Fernandes", "Ibrahim", "Larsen",
    "Sharma", "Mahmood", "Turner", "Dubois", "Qureshi", "Lindqvist", "Nguyen",
    "Ahmed", "Bennett", "Moreau", "Siddiqui", "Walsh", "Yilmaz",
]
STREETS = [
    "Maple Street", "Oakwood Avenue", "Riverbend Road", "Cedar Lane", "Hillside Drive",
    "Park View", "Station Road", "Willow Court", "Canal Street", "Garden Town",
    "Mill Lane", "Orchard Close", "Lake Road", "Church Street", "Market Square",
]
CITIES = [
    "Springfield", "Riverton", "Lakeside", "Fairview", "Brookfield", "Greenville",
    "Ashford", "Kingsport", "Millbrook", "Westhaven",
]

# Primary diseases with relative prevalence and the age band they occur in.
DISEASES = [
    # name,                    weight, min_age, max_age
    ("Type 2 Diabetes",          14, 35, 85),
    ("Hypertension",             14, 30, 88),
    ("High Cholesterol",          7, 35, 80),
    ("Asthma",                    7, 18, 70),
    ("COPD",                      5, 45, 85),
    ("Congestive Heart Failure",  4, 55, 90),
    ("Atrial Fibrillation",       4, 55, 90),
    ("Chronic Kidney Disease",    4, 45, 85),
    ("Depression",                6, 18, 75),
    ("Anxiety",                   5, 18, 65),
    ("Epilepsy",                  3, 18, 60),
    ("Hypothyroidism",            4, 25, 80),
    ("Type 1 Diabetes",           3, 18, 55),
    ("Rheumatoid Arthritis",      3, 30, 80),
    ("Osteoporosis",              3, 55, 90),
    ("Migraine",                  3, 18, 55),
    ("Parkinson's Disease",       2, 55, 90),
]

# Clinically plausible comorbidities for each primary disease.
COMORBID = {
    "Type 2 Diabetes": ["Hypertension", "High Cholesterol", "Chronic Kidney Disease", "Depression"],
    "Hypertension": ["High Cholesterol", "Type 2 Diabetes", "Chronic Kidney Disease", "Atrial Fibrillation"],
    "High Cholesterol": ["Hypertension", "Type 2 Diabetes"],
    "Asthma": ["Anxiety", "Migraine"],
    "COPD": ["Hypertension", "Congestive Heart Failure", "Depression"],
    "Congestive Heart Failure": ["Atrial Fibrillation", "Hypertension", "Chronic Kidney Disease"],
    "Atrial Fibrillation": ["Hypertension", "Congestive Heart Failure"],
    "Chronic Kidney Disease": ["Hypertension", "Type 2 Diabetes"],
    "Depression": ["Anxiety", "Migraine"],
    "Anxiety": ["Depression", "Migraine"],
    "Epilepsy": ["Depression", "Migraine"],
    "Hypothyroidism": ["High Cholesterol", "Depression"],
    "Type 1 Diabetes": ["Hypothyroidism", "Depression"],
    "Rheumatoid Arthritis": ["Osteoporosis", "Depression"],
    "Osteoporosis": ["Rheumatoid Arthritis", "Hypertension"],
    "Migraine": ["Anxiety", "Depression"],
    "Parkinson's Disease": ["Depression", "Osteoporosis"],
}

OCCUPATIONS = [
    # name,               typical daily hours
    ("Teacher", 8), ("Nurse", 12), ("Software Engineer", 9), ("Shopkeeper", 11),
    ("Driver", 12), ("Factory Worker", 10), ("Accountant", 8), ("Farmer", 11),
    ("Construction Worker", 10), ("Cleaner", 9), ("Chef", 11), ("Electrician", 9),
    ("Sales Associate", 9), ("Security Guard", 12), ("Homemaker", 0),
    ("Self-employed", 10), ("Civil Servant", 8), ("Pharmacist", 8),
]
EDUCATION = ["None", "Primary", "High School", "Bachelor's", "Master's", "Doctorate"]
RELIGION = ["None", "Christianity", "Islam", "Hinduism", "Buddhism", "Judaism", "Other"]


def chance(rng: random.Random, p: float) -> bool:
    return rng.random() < max(0.0, min(1.0, p))


def pick_disease(rng: random.Random, age: int) -> str:
    options = [(d, w) for d, w, lo, hi in DISEASES if lo <= age <= hi]
    names, weights = zip(*options)
    return rng.choices(names, weights=weights)[0]


def doctor_note(p: dict, rng: random.Random) -> str:
    notes = []
    if p["forgetfulness"] == "Often":
        notes.append("Frequently forgets doses; would benefit from a pill organiser.")
    if p["transportationIssues"] == "Yes":
        notes.append("Difficulty reaching clinic and pharmacy.")
    if p["financialDifficulty"] == "Yes":
        notes.append("Reports cost of medication as a concern.")
    if p["caregiver"] == "None" and p["age"] >= 65:
        notes.append("Lives alone without a caregiver.")
    if p["dailyWorkingHours"] >= 11:
        notes.append("Long working hours make dose timing difficult.")
    if p["medicationCount"] >= 6:
        notes.append("Complex regimen; consider simplification.")
    if not notes:
        notes.append(rng.choice([
            "Engaged and well informed about treatment.",
            "Stable on current regimen; routine follow-up.",
            "Good understanding of medication schedule.",
            "No adherence concerns raised at last visit.",
        ]))
    return " ".join(notes[:2])


def make_patient(i: int, rng: random.Random, used_names: set[str]) -> dict:
    # Latent adherence-barrier level, spread across the whole low-to-high range.
    b = rng.betavariate(0.9, 1.1)

    gender = rng.choices(["Female", "Male", "Other"], weights=[49, 49, 2])[0]
    first_pool = FEMALE_NAMES if gender == "Female" else MALE_NAMES if gender == "Male" else FEMALE_NAMES + MALE_NAMES
    while True:
        first, last = rng.choice(first_pool), rng.choice(LAST_NAMES)
        if f"{first} {last}" not in used_names:
            used_names.add(f"{first} {last}")
            break

    age = int(min(90, max(18, rng.gauss(54 + 10 * b, 15))))
    retired = age >= 66 and chance(rng, 0.85)

    if retired:
        occupation, hours = "Retired", 0
    elif age < 23 and chance(rng, 0.6):
        occupation, hours = "Student", rng.randint(5, 8)
    elif chance(rng, 0.06 + 0.12 * b):
        occupation, hours = "Unemployed", 0
    else:
        occupation, base = rng.choice(OCCUPATIONS)
        hours = 0 if base == 0 else max(4, min(16, base + rng.randint(-1, 2) + round(2 * b)))

    marital = rng.choices(
        ["Single", "Married", "Divorced", "Widowed"],
        weights=[30 if age < 35 else 12, 55, 12 + 10 * b, 2 if age < 60 else 18],
    )[0]
    if marital == "Married" and chance(rng, 0.85 - 0.5 * b):
        caregiver = "Spouse"
    elif age >= 60 and chance(rng, 0.55 - 0.4 * b):
        caregiver = rng.choice(["Daughter", "Son"])
    elif chance(rng, 0.2 - 0.15 * b):
        caregiver = rng.choice(["Parent", "Sibling", "Other"])
    else:
        caregiver = "None"

    education = rng.choices(EDUCATION, weights=[3 + 6 * b, 8 + 8 * b, 30, 28, 12 - 6 * b, 3])[0]

    primary = pick_disease(rng, age)
    secondary = rng.choice(COMORBID[primary]) if chance(rng, 0.35 + 0.35 * (age / 90)) else "None"

    med_count = max(1, min(10, round(rng.gauss(2 + (secondary != "None") * 1.5 + age / 40 + 2 * b, 1.2))))
    missed = max(0, min(8, round(rng.gauss(5 * b - 0.5, 1.0))))
    hosp = max(0, min(5, round(rng.gauss(2.2 * b + (age >= 70) * 0.6 - 0.4, 0.8))))

    if age >= 70 and chance(rng, 0.5):
        phone = rng.choice(["Basic phone", "None"])
    else:
        phone = rng.choices(["Smartphone", "Basic phone", "None"], weights=[80 - 40 * b, 15 + 30 * b, 5 + 10 * b])[0]
    sms = "Yes" if phone != "None" and chance(rng, 0.85 - 0.75 * b) else "No"

    forget = rng.choices(["Rarely", "Sometimes", "Often"], weights=[1 - b, 0.5, b * 1.2])[0]
    support = rng.choices(["High", "Medium", "Low"], weights=[1 - b, 0.6, b])[0]
    if caregiver == "None" and support == "High":
        support = "Medium"

    p = {
        "id": f"P-{1001 + i}",
        "firstName": first,
        "lastName": last,
        "age": age,
        "gender": gender,
        "phone": f"+1 202 555 01{rng.randint(0, 99):02d}",
        "maritalStatus": marital,
        "occupation": occupation,
        "education": education,
        "religion": rng.choices(RELIGION, weights=[18, 34, 26, 10, 5, 3, 4])[0],
        "caregiver": caregiver,
        "address": f"{rng.randint(1, 240)} {rng.choice(STREETS)}, {rng.choice(CITIES)}",
        "primaryDisease": primary,
        "secondaryDisease": secondary,
        "medicationCount": med_count,
        "missedAppointments": missed,
        "hospitalizations": hosp,
        "medicationDurationMonths": rng.randint(3, 18) if age < 30 else rng.randint(6, 120),
        "smoking": rng.choices(["No", "Former", "Yes"], weights=[60 - 20 * b, 20, 12 + 25 * b])[0],
        "alcohol": rng.choices(["No", "Occasionally", "Regularly"], weights=[55, 35, 6 + 15 * b])[0],
        "exercise": rng.choices(["Rarely", "Sometimes", "Regularly"], weights=[0.2 + b, 0.5, 1.1 - b])[0],
        "phoneOwnership": phone,
        "smsReminders": sms,
        "dailyWorkingHours": hours,
        "forgetfulness": forget,
        "transportationIssues": "Yes" if chance(rng, 0.05 + 0.55 * b + (age >= 75) * 0.15) else "No",
        "financialDifficulty": "Yes" if chance(rng, 0.05 + 0.6 * b + (occupation == "Unemployed") * 0.3) else "No",
        "familySupport": support,
        "createdAt": (TODAY - timedelta(days=rng.randint(0, 180))).isoformat(),
    }
    p["doctorNotes"] = doctor_note(p, rng)
    return p


def generate(count: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    used_names: set[str] = set()
    return [make_patient(i, rng, used_names) for i in range(count)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--count", type=int, default=120, help="number of patients (default 120)")
    parser.add_argument("--seed", type=int, default=42, help="random seed (default 42)")
    parser.add_argument("--out", type=Path, default=OUT_FILE, help="output JSON path")
    args = parser.parse_args()

    patients = generate(args.count, args.seed)
    args.out.write_text(json.dumps(patients, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(patients)} synthetic patients to {args.out}")


if __name__ == "__main__":
    main()
