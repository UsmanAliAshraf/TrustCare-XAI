"""Mock adherence-risk 'model'.

There is NO machine-learning model here. This module derives a plausible
risk score from the patient's recorded risk factors so the prototype behaves
consistently and the explainability output feels grounded. Swapping in a real
model later only means replacing `analyze_patient` with a call to the model
service - the response schema stays the same.
"""

from __future__ import annotations


# Each rule contributes a raw weight when its condition is met. The weights are
# later normalised into the SHAP-style contribution percentages shown in the UI.
def _factor_weights(p: dict) -> list[dict]:
    factors: list[dict] = []

    med_count = int(p.get("medicationCount", 0) or 0)
    if med_count >= 3:
        factors.append({"feature": "Medication Count", "raw": min(med_count * 4, 24),
                        "direction": "increase"})

    missed = int(p.get("missedAppointments", 0) or 0)
    if missed >= 1:
        factors.append({"feature": "Previous Missed Appointments", "raw": min(missed * 6, 24),
                        "direction": "increase"})

    if str(p.get("caregiver", "None")).strip().lower() in ("", "none"):
        factors.append({"feature": "No Caregiver", "raw": 18, "direction": "increase"})

    hours = int(p.get("dailyWorkingHours", 0) or 0)
    if hours >= 10:
        factors.append({"feature": "Long Working Hours", "raw": 14, "direction": "increase"})

    if str(p.get("financialDifficulty", "No")).strip().lower() == "yes":
        factors.append({"feature": "Financial Difficulty", "raw": 15, "direction": "increase"})

    forget = str(p.get("forgetfulness", "Rarely")).strip().lower()
    if forget in ("often", "sometimes"):
        factors.append({"feature": "Medication Forgetfulness",
                        "raw": 20 if forget == "often" else 11, "direction": "increase"})

    if str(p.get("transportationIssues", "No")).strip().lower() == "yes":
        factors.append({"feature": "Transportation Issues", "raw": 12, "direction": "increase"})

    if str(p.get("familySupport", "High")).strip().lower() == "low":
        factors.append({"feature": "Low Family Support", "raw": 13, "direction": "increase"})

    if str(p.get("smsReminders", "No")).strip().lower() == "no":
        factors.append({"feature": "No SMS Reminders", "raw": 8, "direction": "increase"})

    hosp = int(p.get("hospitalizations", 0) or 0)
    if hosp >= 2:
        factors.append({"feature": "Prior Hospitalizations", "raw": 10, "direction": "increase"})

    if int(p.get("age", 0) or 0) >= 65:
        factors.append({"feature": "Advanced Age", "raw": 9, "direction": "increase"})

    # Protective factors are recorded but do not appear in the top contributors;
    # they lower the overall probability.
    protective = 0
    if str(p.get("familySupport", "")).strip().lower() == "high":
        protective += 10
    if str(p.get("smsReminders", "")).strip().lower() == "yes":
        protective += 8
    if forget == "rarely":
        protective += 8
    if str(p.get("exercise", "")).strip().lower() == "regularly":
        protective += 5

    return factors, protective


def _recommendations(p: dict, top_features: set[str]) -> list[dict]:
    recs: list[dict] = []
    if "No SMS Reminders" in top_features or str(p.get("smsReminders", "")).lower() == "no":
        recs.append({"title": "Medication Reminder",
                     "description": "Enable SMS or app-based reminders to prompt each dose.",
                     "icon": "bell"})
    if "No Caregiver" in top_features or "Low Family Support" in top_features:
        recs.append({"title": "Caregiver Support",
                     "description": "Encourage a family member to supervise and support medications.",
                     "icon": "users"})
    if "Medication Count" in top_features:
        recs.append({"title": "Medication Review",
                     "description": "Consider simplifying or consolidating the medication schedule.",
                     "icon": "clipboard"})
    if "Financial Difficulty" in top_features:
        recs.append({"title": "Financial Assistance",
                     "description": "Discuss generic alternatives and patient assistance programs.",
                     "icon": "wallet"})
    if "Transportation Issues" in top_features:
        recs.append({"title": "Delivery / Telehealth",
                     "description": "Arrange pharmacy delivery or telehealth follow-ups.",
                     "icon": "truck"})
    # Always suggest a follow-up.
    recs.append({"title": "Follow-up Visit",
                 "description": "Schedule a review within one week to reassess adherence.",
                 "icon": "calendar"})
    return recs


def analyze_patient(p: dict) -> dict:
    factors, protective = _factor_weights(p)

    raw_total = sum(f["raw"] for f in factors)
    # Map the net score to a 0-100 probability of NON-adherence. The scale /
    # offset are tuned so scores spread across the range rather than saturating.
    net = raw_total - protective
    probability = max(4, min(96, int(round(net * 0.45 + 22))))

    if probability >= 66:
        risk = "High"
        prediction = "Likely Non-Adherent"
    elif probability >= 38:
        risk = "Medium"
        prediction = "Possibly Non-Adherent"
    else:
        risk = "Low"
        prediction = "Likely Adherent"

    # Top 5 contributing factors, normalised to sum ~100%.
    factors.sort(key=lambda f: f["raw"], reverse=True)
    top = factors[:5]
    total_top = sum(f["raw"] for f in top) or 1
    contributions = [
        {"feature": f["feature"],
         "importance": round(f["raw"] / total_top * 100)}
        for f in top
    ]
    # Fix rounding so the bars sum to 100.
    if contributions:
        drift = 100 - sum(c["importance"] for c in contributions)
        contributions[0]["importance"] += drift

    # Confidence is higher when the score is far from the decision boundaries.
    distance = min(abs(probability - 38), abs(probability - 66), probability, 100 - probability)
    confidence = max(72, min(97, 74 + distance))

    return {
        "risk": risk,
        "probability": probability,
        "prediction": prediction,
        "confidence": confidence,
        "factors": contributions,
        "recommendations": _recommendations(p, {c["feature"] for c in contributions}),
        "disclaimer": "Prediction generated by a mock engine for demonstration only. "
                      "No machine-learning model is used in this prototype.",
    }
