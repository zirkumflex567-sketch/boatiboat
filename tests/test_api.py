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
    seed_questions()

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
