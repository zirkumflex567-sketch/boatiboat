import os
import tempfile

os.environ["BOATIBOAT_DATA_DIR"] = tempfile.mkdtemp(prefix="boatiboat-test-")

from fastapi.testclient import TestClient

from app.database import Base, engine, session_scope
from app.main import app
from app.models import Question, Progress
from app.services import shuffled_choices


client = TestClient(app)


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def seed_questions():
    with session_scope() as session:
        session.add_all(
            [
                Question(
                    external_id="see-1",
                    license_type="see",
                    category="Ausweichregeln",
                    prompt="Wer ist ausweichpflichtig?",
                    choices=["Segler", "Maschinenfahrzeug", "Beide"],
                    correct_index=1,
                    explanation="Ein Maschinenfahrzeug muss einem Segelfahrzeug ausweichen.",
                    source_name="Testquelle",
                    source_url="https://example.test/see.pdf",
                    source_stand="01. August 2023",
                ),
                Question(
                    external_id="binnen-1",
                    license_type="binnen",
                    category="Schallsignale",
                    prompt="Was bedeutet ein langer Ton?",
                    choices=["Achtung", "Backbord", "Stopp"],
                    correct_index=0,
                    explanation="Ein langer Ton macht andere Verkehrsteilnehmer aufmerksam.",
                    source_name="Testquelle",
                    source_url="https://example.test/binnen.pdf",
                    source_stand="01. August 2023",
                ),
            ]
        )


def test_lists_questions_with_stored_explanations():
    seed_questions()

    response = client.get("/api/questions?license_type=see")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["external_id"] == "see-1"
    assert data[0]["explanation"].startswith("Ein Maschinenfahrzeug")
    assert data[0]["source_stand"] == "01. August 2023"
    assert data[0]["source_url"].startswith("https://")


def test_answer_updates_progress_and_returns_explanation():
    seed_questions()

    response = client.post(
        "/api/answer",
        json={"question_id": 1, "selected_index": 0, "mode": "learn"},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["is_correct"] is False
    assert result["correct_index"] == 1
    assert "Segelfahrzeug" in result["explanation"]

    with session_scope() as session:
        progress = session.query(Progress).filter_by(question_id=1).one()
        assert progress.wrong_count == 1
        assert progress.box == 1


def test_learning_queue_prioritizes_wrong_answers():
    seed_questions()
    client.post("/api/answer", json={"question_id": 1, "selected_index": 0, "mode": "learn"})

    response = client.get("/api/session?mode=learn&license_type=see&limit=5")

    assert response.status_code == 200
    data = response.json()
    assert data["questions"][0]["external_id"] == "see-1"
    assert data["questions"][0]["priority"] > 1


def test_import_accepts_json_catalog_records():
    payload = [
        {
            "external_id": "SBF-42",
            "license_type": "see",
            "category": "Navigation",
            "prompt": "Was zeigt eine Seekarte?",
            "choices": ["Tiefen und Seezeichen", "Nur Hafennamen", "Nur Wetter"],
            "correct_index": 0,
            "explanation": "Seekarten zeigen nautisch relevante Informationen.",
            "source_name": "ELWIS",
            "source_url": "https://www.elwis.de/test.pdf",
            "source_stand": "01. August 2023",
        }
    ]

    response = client.post("/api/import/json", json=payload)

    assert response.status_code == 200
    assert response.json()["imported"] == 1
    assert client.get("/api/questions").json()[0]["external_id"] == "SBF-42"


def test_choices_are_shuffled_and_correct_index_is_rebased():
    question = Question(
        external_id="mix-1",
        license_type="see",
        category="Test",
        prompt="Mix?",
        choices=["richtig", "falsch b", "falsch c", "falsch d"],
        correct_index=0,
    )

    mixed = shuffled_choices(question, salt="exam")

    assert mixed["choices"] != question.choices
    assert mixed["choices"][mixed["correct_index"]] == "richtig"


def test_exam_session_contains_sources_and_exam_shape():
    with session_scope() as session:
        for idx in range(1, 8):
            session.add(
                Question(
                    external_id=f"source-basis-{idx}",
                    license_type="see",
                    category="Basisfragen",
                    prompt=f"Basis {idx}?",
                    choices=["A", "B", "C", "D"],
                    correct_index=0,
                    source_name="Testquelle",
                    source_url="https://example.test/see.pdf",
                    source_stand="01. August 2023",
                )
            )
        for idx in range(1, 24):
            session.add(
                Question(
                    external_id=f"source-see-{idx}",
                    license_type="see",
                    category="Spezifische Fragen See",
                    prompt=f"See {idx}?",
                    choices=["A", "B", "C", "D"],
                    correct_index=0,
                    source_name="Testquelle",
                    source_url="https://example.test/see.pdf",
                    source_stand="01. August 2023",
                )
            )

    response = client.get("/api/session?mode=exam&license_type=see&limit=5")

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "exam"
    assert data["time_limit_seconds"] is not None
    assert data["passing_rules"]["max_wrong"] >= 0
    assert data["questions"][0]["source_stand"] == "01. August 2023"


def test_see_exam_prefers_navigation_task_when_available():
    with session_scope() as session:
        session.add_all(
            [
                Question(
                    external_id="see-nav",
                    license_type="see",
                    category="Navigationsaufgaben",
                    prompt="Wie lautet der rwK?",
                    choices=["148°", "150°", "152°", "154°"],
                    correct_index=0,
                    source_name="ELWIS",
                    source_url="https://example.test/see.pdf",
                    source_stand="01. August 2023",
                ),
                Question(
                    external_id="see-basic",
                    license_type="see",
                    category="Basisfragen",
                    prompt="Basis?",
                    choices=["A", "B", "C", "D"],
                    correct_index=0,
                    source_name="ELWIS",
                    source_url="https://example.test/see.pdf",
                    source_stand="01. August 2023",
                ),
            ]
        )

    response = client.get("/api/session?mode=exam&license_type=see&limit=2")

    assert response.status_code == 200
    categories = [question["category"] for question in response.json()["questions"]]
    assert "Navigationsaufgaben" in categories


def test_exam_ignores_requested_limit_for_binnen_motor_shape():
    with session_scope() as session:
        for idx in range(1, 8):
            session.add(
                Question(
                    external_id=f"basis-{idx}",
                    license_type="binnen",
                    category="Basisfragen",
                    prompt=f"Basis {idx}?",
                    choices=["A", "B", "C", "D"],
                    correct_index=0,
                )
            )
        for idx in range(1, 24):
            session.add(
                Question(
                    external_id=f"binnen-{idx}",
                    license_type="binnen",
                    category="Spezifische Fragen Binnen",
                    prompt=f"Binnen {idx}?",
                    choices=["A", "B", "C", "D"],
                    correct_index=0,
                )
            )

    response = client.get("/api/session?mode=exam&license_type=binnen&limit=10")
    data = response.json()

    assert data["time_limit_seconds"] == 45 * 60
    assert len(data["questions"]) == 30
    assert data["passing_rules"]["required_total"] == 24
    assert sum(1 for q in data["questions"] if q["category"] == "Basisfragen") == 7
    assert sum(1 for q in data["questions"] if q["category"] == "Spezifische Fragen Binnen") == 23


def test_exam_ignores_requested_limit_for_see_shape():
    with session_scope() as session:
        for idx in range(1, 8):
            session.add(
                Question(
                    external_id=f"see-basis-{idx}",
                    license_type="see",
                    category="Basisfragen",
                    prompt=f"Basis {idx}?",
                    choices=["A", "B", "C", "D"],
                    correct_index=0,
                )
            )
        for idx in range(1, 24):
            session.add(
                Question(
                    external_id=f"see-{idx}",
                    license_type="see",
                    category="Spezifische Fragen See",
                    prompt=f"See {idx}?",
                    choices=["A", "B", "C", "D"],
                    correct_index=0,
                )
            )
        session.add(
            Question(
                external_id="see-nav-1",
                license_type="see",
                category="Navigationsaufgaben",
                prompt="Navigation?",
                choices=["A", "B", "C", "D"],
                correct_index=0,
            )
        )

    response = client.get("/api/session?mode=exam&license_type=see&limit=10")
    data = response.json()

    assert data["time_limit_seconds"] == 60 * 60
    assert len(data["questions"]) == 31
    assert data["passing_rules"]["required_total"] == 24
    assert data["passing_rules"]["navigation_required"] == 7
    assert sum(1 for q in data["questions"] if q["category"] == "Basisfragen") == 7
    assert sum(1 for q in data["questions"] if q["category"] == "Spezifische Fragen See") == 23
    assert sum(1 for q in data["questions"] if q["category"] == "Navigationsaufgaben") == 1


def test_lists_fixed_exam_sheets():
    response = client.get("/api/exam-sheets?license_type=binnen")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 15
    assert data[0]["id"] == "binnen-01"
    assert data[-1]["label"] == "SBF Binnen Bogen 15"


def test_fixed_exam_sheet_is_reproducible():
    with session_scope() as session:
        for idx in range(1, 73):
            session.add(
                Question(
                    external_id=f"BINNEN-{idx:03d}",
                    license_type="binnen",
                    category="Basisfragen" if idx <= 72 else "Spezifische Fragen Binnen",
                    prompt=f"Basis {idx}?",
                    choices=["A", "B", "C", "D"],
                    correct_index=0,
                )
            )
        for idx in range(73, 254):
            session.add(
                Question(
                    external_id=f"BINNEN-{idx:03d}",
                    license_type="binnen",
                    category="Spezifische Fragen Binnen",
                    prompt=f"Binnen {idx}?",
                    choices=["A", "B", "C", "D"],
                    correct_index=0,
                )
            )

    first = client.get("/api/session?mode=exam&license_type=binnen&sheet_id=binnen-01").json()
    second = client.get("/api/session?mode=exam&license_type=binnen&sheet_id=binnen-01").json()
    third = client.get("/api/session?mode=exam&license_type=binnen&sheet_id=binnen-02").json()

    first_ids = [question["external_id"] for question in first["questions"]]
    second_ids = [question["external_id"] for question in second["questions"]]
    third_ids = [question["external_id"] for question in third["questions"]]
    expected = [
        "BINNEN-008", "BINNEN-016", "BINNEN-017", "BINNEN-032", "BINNEN-047",
        "BINNEN-060", "BINNEN-063", "BINNEN-077", "BINNEN-084", "BINNEN-086",
        "BINNEN-088", "BINNEN-092", "BINNEN-099", "BINNEN-102", "BINNEN-115",
        "BINNEN-118", "BINNEN-129", "BINNEN-137", "BINNEN-139", "BINNEN-147",
        "BINNEN-162", "BINNEN-168", "BINNEN-183", "BINNEN-191", "BINNEN-207",
        "BINNEN-214", "BINNEN-222", "BINNEN-237", "BINNEN-244", "BINNEN-251",
    ]

    assert first["passing_rules"]["sheet_id"] == "binnen-01"
    assert first["passing_rules"]["official_distribution"] is True
    assert first_ids == expected
    assert first_ids == second_ids
    assert first_ids != third_ids
    assert len(first_ids) == 30


def test_see_fixed_exam_sheet_includes_matching_navigation_task():
    with session_scope() as session:
        for idx in range(1, 286):
            session.add(
                Question(
                    external_id=f"SEE-{idx:03d}",
                    license_type="see",
                    category="Basisfragen" if idx <= 72 else "Spezifische Fragen See",
                    prompt=f"See {idx}?",
                    choices=["A", "B", "C", "D"],
                    correct_index=0,
                )
            )
        for idx in range(1, 16):
            session.add(
                Question(
                    external_id=f"SEE-NAV-{idx:02d}",
                    license_type="see",
                    category="Navigationsaufgaben",
                    prompt=f"Navigation {idx}?",
                    choices=[],
                    correct_index=0,
                    card_type="navigation",
                )
            )

    data = client.get("/api/session?mode=exam&license_type=see&sheet_id=see-01").json()
    ids = [question["external_id"] for question in data["questions"]]

    assert ids[0] == "SEE-NAV-01"
    assert ids[1:8] == ["SEE-008", "SEE-016", "SEE-017", "SEE-032", "SEE-047", "SEE-060", "SEE-063"]
    assert len(ids) == 31


def test_fixed_exam_sheet_rejects_mismatched_license():
    response = client.get("/api/session?mode=exam&license_type=see&sheet_id=binnen-01")

    assert response.status_code == 400
