"""Tests for the fuzzy / Extended Boolean patient search.

Run from the backend folder:  python -m unittest discover -s tests -v
Uses a small hand-built synthetic cohort so every expectation is explicit.
"""

from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes import patients as patient_routes  # noqa: E402
from services.analysis import analyze_patient  # noqa: E402
from services.search import QueryError, fuzzy_and, fuzzy_not, fuzzy_or, parse_query, search_patients  # noqa: E402
from services.search import config  # noqa: E402
from services.search.engine import membership  # noqa: E402
from services.search.fields import index_patient  # noqa: E402
from services.search.text import similarity  # noqa: E402

BASE = {
    "age": 50, "gender": "Female", "phone": "+1 202 555 0100", "maritalStatus": "Married",
    "occupation": "Teacher", "education": "High School", "religion": "Islam", "caregiver": "Spouse",
    "address": "1 Test Street, Testville", "primaryDisease": "Asthma", "secondaryDisease": "None",
    "medicationCount": 2, "missedAppointments": 0, "hospitalizations": 0,
    "medicationDurationMonths": 12, "smoking": "No", "alcohol": "No", "exercise": "Regularly",
    "phoneOwnership": "Smartphone", "smsReminders": "Yes", "dailyWorkingHours": 8,
    "forgetfulness": "Rarely", "transportationIssues": "No", "financialDifficulty": "No",
    "familySupport": "High", "doctorNotes": "", "createdAt": "2026-10-01",
}


def patient(pid: str, first: str, last: str, **fields) -> dict:
    return {**BASE, "id": pid, "firstName": first, "lastName": last, **fields}


COHORT = [
    patient("P-2001", "Kwame", "Walsh", primaryDisease="Type 2 Diabetes", forgetfulness="Often",
            doctorNotes="Frequently forgets doses; would benefit from a pill organiser."),
    patient("P-2002", "Kwame", "Novak", primaryDisease="Depression", forgetfulness="Sometimes"),
    patient("P-2003", "Kwami", "Osei", primaryDisease="Hypertension", secondaryDisease="High Cholesterol",
            forgetfulness="Often"),
    patient("P-2004", "Sofia", "Martinez", primaryDisease="Type 1 Diabetes", forgetfulness="Often",
            transportationIssues="Yes"),
    patient("P-2005", "Grace", "Chen", primaryDisease="Hypertension", secondaryDisease="Type 2 Diabetes",
            financialDifficulty="Yes", doctorNotes="Reports cost of medication as a concern."),
    patient("P-2006", "Omar", "Haddad", primaryDisease="Asthma", age=81,
            doctorNotes="Difficulty reaching clinic and pharmacy."),
    patient("P-2007", "Clara", "O'Connor", primaryDisease="COPD", smoking="Yes", missedAppointments=4),
]


def ids(query: str, cohort: list[dict] = COHORT, **kw) -> list[str]:
    return [h.patient["id"] for h in search_patients(query, cohort, **kw)]


def mu(query: str, p: dict) -> float:
    return membership(parse_query(query), index_patient(p))


class NameSearch(unittest.TestCase):
    def test_01_exact_name(self):
        self.assertEqual(ids("Kwame Walsh"), ["P-2001"])

    def test_02_partial_name(self):
        self.assertEqual(ids("walsh"), ["P-2001"])
        self.assertEqual(set(ids("kwam")), {"P-2001", "P-2002", "P-2003"})  # prefix of Kwame and Kwami

    def test_03_case_insensitive(self):
        self.assertEqual(ids("KWAME WALSH"), ids("kwame walsh"))
        self.assertEqual(ids("o'CONNOR"), ["P-2007"])

    def test_17_similar_names_ranked(self):
        # Exact "kwame" outranks the one-letter variant "Kwami", which is still found.
        result = ids("kwame")
        self.assertEqual(result[:2], ["P-2001", "P-2002"])
        self.assertIn("P-2003", result)
        self.assertGreater(mu("kwame", COHORT[0]), mu("kwame", COHORT[2]))

    def test_patient_id(self):
        self.assertEqual(ids("P-2004"), ["P-2004"])
        self.assertEqual(ids("2004"), ["P-2004"])
        self.assertEqual(ids("P-2009"), [])  # IDs never match fuzzily


class ClinicalSearch(unittest.TestCase):
    def test_04_disease_match(self):
        self.assertEqual(ids("depression"), ["P-2002"])
        # Primary-diagnosis matches outrank secondary-diagnosis matches.
        self.assertEqual(ids("type 2 diabetes"), ["P-2001", "P-2005"])

    def test_05_spelling_mistake(self):
        self.assertGreaterEqual(similarity("diabetis", "diabetes"), config.FUZZY_MIN_SIMILARITY)
        self.assertEqual(set(ids("diabetis")), {"P-2001", "P-2004", "P-2005"})
        self.assertEqual(set(ids("hypertensoin")), {"P-2003", "P-2005"})

    def test_06_doctor_notes(self):
        self.assertEqual(ids("pharmacy"), ["P-2006"])
        self.assertEqual(ids('"pill organiser"'), ["P-2001"])

    def test_07_adherence_fields(self):
        # forgetfulness: Often -> 1.0, Sometimes -> 0.6, Rarely -> 0 (membership function)
        result = ids("forgetfulness")
        self.assertEqual(set(result), {"P-2001", "P-2002", "P-2003", "P-2004"})
        self.assertEqual(result[-1], "P-2002")  # "Sometimes" ranks below "Often"
        self.assertEqual(ids("transport"), ["P-2004"])
        self.assertEqual(ids("financial"), ["P-2005"])
        self.assertEqual(ids("missed appointments"), ["P-2007"])

    def test_numeric_filter(self):
        self.assertEqual(ids("age>80"), ["P-2006"])
        self.assertEqual(ids("asthma age>=81"), ["P-2006"])

    def test_08_unrelated_query(self):
        self.assertEqual(ids("xylophone"), [])
        self.assertEqual(ids("zzzz qqqq"), [])

    def test_false_positive_guard(self):
        # "type 2 diabetes" must not match Type 1 diabetes, and "male" must not match "Female".
        self.assertNotIn("P-2004", ids("type 2 diabetes"))
        self.assertEqual(ids("male"), [])

    def test_lecture_example_diabetes_and_forgetfulness(self):
        result = ids("diabetes AND forgetfulness")
        self.assertIn("P-2001", result)  # Type 2 Diabetes + forgetfulness Often
        self.assertNotIn("P-2005", result)  # diabetic but forgetfulness Rarely


class FuzzyOperators(unittest.TestCase):
    def test_operator_functions(self):
        self.assertEqual(fuzzy_and(0.8, 0.3), 0.3)
        self.assertEqual(fuzzy_or(0.8, 0.3), 0.8)
        self.assertAlmostEqual(fuzzy_not(0.8), 0.2)

    def test_09_and_is_minimum(self):
        p = COHORT[1]  # Depression, forgetfulness Sometimes
        a, b = mu("depression", p), mu("forgetfulness", p)
        self.assertLess(b, a)
        self.assertAlmostEqual(mu("depression AND forgetfulness", p), min(a, b))

    def test_10_or_is_maximum(self):
        p = COHORT[4]  # Hypertension primary, Type 2 Diabetes secondary
        a, b = mu("hypertension", p), mu("diabetes", p)
        self.assertAlmostEqual(mu("hypertension OR diabetes", p), max(a, b))
        self.assertEqual(set(ids("depression OR copd")), {"P-2002", "P-2007"})

    def test_11_not_is_complement(self):
        for p in COHORT:
            self.assertAlmostEqual(mu("NOT forgetfulness", p), 1 - mu("forgetfulness", p))

    def test_12_parentheses_and_precedence(self):
        # NOT > AND > OR, so "a OR b AND c" == "a OR (b AND c)".
        self.assertEqual(parse_query("asthma OR copd AND smoker"), parse_query("asthma OR (copd AND smoker)"))
        grouped = ids("(depression OR hypertension) AND forgetfulness")
        self.assertEqual(set(grouped), {"P-2002", "P-2003"})
        self.assertNotIn("P-2005", grouped)  # hypertension, but not forgetful


class ExtendedBoolean(unittest.TestCase):
    def test_13_exclusion_removes_matches(self):
        # (A u B) - C with A=diabetes, B=hypertension, C=type 1
        result = ids("(diabetes OR hypertension) AND NOT type 1")
        self.assertEqual(set(result), {"P-2001", "P-2003", "P-2005"})
        self.assertNotIn("P-2004", result)

    def test_exclusion_is_strict_below_relevance_threshold(self):
        # A patient whose exclusion membership is between the two thresholds
        # would survive a purely fuzzy NOT (1 - 0.42 = 0.58 >= 0.5) but must
        # still be removed by an explicit exclusion.
        p = patient("P-2100", "Test", "Case", primaryDisease="Asthma", doctorNotes="Patient is hypertensive.")
        excluded_mu = mu("hypertension", p)
        self.assertGreaterEqual(excluded_mu, config.EXCLUSION_THRESHOLD)
        self.assertGreaterEqual(1 - excluded_mu, config.RELEVANCE_THRESHOLD)
        self.assertEqual(ids("asthma AND NOT hypertension", [p]), [])
        self.assertEqual(ids("asthma OR NOT hypertension", [p]), ["P-2100"])  # nested NOT stays fuzzy

    def test_standalone_not(self):
        self.assertNotIn("P-2003", ids("NOT hypertension"))
        self.assertNotIn("P-2005", ids("NOT hypertension"))


class InputHandling(unittest.TestCase):
    def test_14_malformed_queries(self):
        for bad in ["(diabetes", "diabetes)", "AND diabetes", "diabetes AND", "NOT", "()",
                    "diabetes OR", '"unclosed', "age>>5", "weight>80", "a" * (config.MAX_QUERY_LENGTH + 1)]:
            with self.subTest(query=bad), self.assertRaises(QueryError):
                search_patients(bad, COHORT)

    def test_15_empty_input(self):
        for empty in ["", "   ", "!!!"]:
            self.assertEqual(ids(empty), [])

    def test_16_short_queries(self):
        self.assertEqual(ids("de"), [])  # under 3 characters: whole-word matches only
        self.assertEqual(ids("dep"), ["P-2002"])  # 3 characters: prefix only, no fuzzy
        self.assertEqual(ids("d"), [])
        self.assertEqual(ids("2"), ["P-2001", "P-2005"])  # whole word "2" in "Type 2 Diabetes"

    def test_18_deterministic_ordering(self):
        first = ids("forgetfulness")
        for _ in range(5):
            self.assertEqual(ids("forgetfulness"), first)
        # Equal scores keep the caller's order.
        reversed_cohort = list(reversed(COHORT))
        self.assertEqual(ids("kwame", reversed_cohort)[:2], ["P-2002", "P-2001"])

    def test_limit(self):
        self.assertEqual(len(ids("forgetfulness", limit=2)), 2)


class Boundaries(unittest.TestCase):
    def test_19_only_searches_permitted_records(self):
        permitted = [p for p in COHORT if p["id"] != "P-2001"]
        self.assertNotIn("P-2001", ids("Kwame Walsh", permitted))
        self.assertNotIn("P-2001", ids("diabetes OR NOT diabetes", permitted))

    def test_sensitive_fields_not_searchable(self):
        self.assertEqual(ids("Testville"), [])  # address
        self.assertEqual(ids("islam"), [])  # religion
        self.assertEqual(ids("555"), [])  # phone

    def test_20_api_response_has_no_scores(self):
        hidden = {"score", "relevance", "membership", "_score"}
        for p in patient_routes.search(q="diabetes AND forgetfulness", limit=10):
            self.assertFalse(hidden & set(p))
            self.assertIn("firstName", p)

    def test_api_rejects_malformed_query(self):
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as ctx:
            patient_routes.search(q="(diabetes", limit=10)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_search_does_not_touch_records_or_risk(self):
        before = copy.deepcopy(COHORT)
        risk_before = [analyze_patient(p) for p in COHORT]
        search_patients("(diabetes OR hypertension) AND NOT type 1", COHORT)
        self.assertEqual(COHORT, before)
        self.assertEqual([analyze_patient(p) for p in COHORT], risk_before)


if __name__ == "__main__":
    unittest.main()
