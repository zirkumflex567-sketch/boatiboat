from pathlib import Path
from contextlib import asynccontextmanager
import random
import secrets

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .database import get_session
from .exam_sheets import EXAM_SHEET_COUNT, OFFICIAL_EXAM_SHEETS, external_ids_for_sheet
from .models import Question
from .schemas import AnswerIn, AnswerOut, QuestionOut, SessionOut
from .seed import init_db
from .services import (
    parse_csv_catalog,
    priority_for,
    record_answer,
    shuffled_choices,
    upsert_questions,
    weighted_sample_without_replacement,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Boatiboat SBF Trainer", version="0.1.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/assets", StaticFiles(directory=PUBLIC_DIR), name="assets")


def serialize_question(question: Question, shuffle_salt: str | None = None) -> QuestionOut:
    mixed = shuffled_choices(question, shuffle_salt) if shuffle_salt is not None else {}
    return QuestionOut(
        id=question.id,
        external_id=question.external_id,
        license_type=question.license_type,
        category=question.category,
        prompt=question.prompt,
        choices=mixed.get("choices", question.choices),
        correct_index=mixed.get("correct_index", question.correct_index),
        explanation=question.explanation,
        source_name=question.source_name,
        source_url=question.source_url,
        source_stand=question.source_stand,
        image_url=question.image_url,
        image_alt=question.image_alt,
        exam_section=question.exam_section,
        card_type=question.card_type,
        scenario=question.scenario,
        subtasks=question.subtasks,
        priority=priority_for(question),
        choice_order=mixed.get("choice_order"),
    )


def source_summary(questions: list[Question]) -> list[dict]:
    seen = {}
    for question in questions:
        key = (question.source_name, question.source_stand, question.source_url)
        if key[0] and key not in seen:
            seen[key] = {"name": key[0], "stand": key[1], "url": key[2]}
    return list(seen.values())


def exam_sheet_id(license_type: str, number: int) -> str:
    return f"{license_type}-{number:02d}"


def parse_sheet_id(sheet_id: str | None, license_type: str) -> tuple[str | None, int | None]:
    if not sheet_id:
        return None, None
    parts = sheet_id.lower().split("-", 1)
    if len(parts) != 2 or parts[0] not in {"see", "binnen"}:
        raise HTTPException(status_code=400, detail="Invalid sheet_id")
    if parts[0] != license_type:
        raise HTTPException(status_code=400, detail="sheet_id does not match license_type")
    try:
        number = int(parts[1])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid sheet_id") from exc
    if number < 1 or number > EXAM_SHEET_COUNT:
        raise HTTPException(status_code=404, detail="Exam sheet not found")
    return parts[0], number


def exam_rules(license_type: str, sheet_id: str | None = None) -> tuple[dict, int]:
    radio_rules = {
        "src": {
            "question_count": 24,
            "required_total": 19,
            "max_wrong": 5,
            "sheet_label": "SRC Prüfungssimulation",
            "note": "SRC-Theorie: 24 Multiple-Choice-Fragen, mindestens 19 richtig. Not-/Dringlichkeits-/Sicherheitsmeldungen und Praxis sind nicht enthalten.",
        },
        "lrc": {
            "question_count": 14,
            "required_total": 11,
            "max_wrong": 3,
            "sheet_label": "LRC Ergänzungsbogen",
            "note": "LRC-Katalog II: 14 Multiple-Choice-Fragen, mindestens 11 richtig. Die vollständige LRC-Prüfung kann zusätzlich SRC-Anteile und Praxis enthalten.",
        },
        "ubi": {
            "question_count": 22,
            "required_total": 17,
            "max_wrong": 5,
            "sheet_label": "UBI Prüfungssimulation",
            "note": "UBI-Theorie: 22 Multiple-Choice-Fragen aus dem Gesamtfragenkatalog, mindestens 17 richtig. Praktische Funkaufgaben sind nicht enthalten.",
        },
    }
    if license_type in radio_rules:
        rules = {**radio_rules[license_type], "simulated_distribution": True}
        seconds = 20 * 60 if license_type == "lrc" else 30 * 60
        return rules, seconds

    if license_type == "binnen":
        rules = {
            "question_count": 30,
            "basis_count": 7,
            "specific_count": 23,
            "required_total": 24,
            "required_basis": 5,
            "required_specific": 18,
            "navigation_count": 0,
            "navigation_required": 0,
            "max_wrong": 6,
            "note": "Amtlicher SBF Binnen Motor-Fragebogen: 7 Basisfragen und 23 spezifische Binnen-Fragen.",
        }
        if sheet_id:
            rules["sheet_id"] = sheet_id
            rules["sheet_label"] = f"SBF Binnen Bogen {sheet_id[-2:]}"
            rules["official_distribution"] = True
            rules["note"] += " Dieser Bogen nutzt die amtliche ELWIS-Fragenverteilung."
        return rules, 45 * 60

    rules = {
        "question_count": 30,
        "basis_count": 7,
        "specific_count": 23,
        "required_total": 24,
        "required_basis": 5,
        "required_specific": 18,
        "navigation_count": 9,
        "navigation_required": 7,
        "max_wrong": 6,
        "note": "Amtlicher SBF See-Fragebogen: 7 Basisfragen, 23 spezifische See-Fragen und eine Navigationsaufgabe mit 9 Teilaufgaben.",
    }
    if sheet_id:
        rules["sheet_id"] = sheet_id
        rules["sheet_label"] = f"SBF See Bogen {sheet_id[-2:]}"
        rules["official_distribution"] = True
        rules["note"] += " Dieser Bogen nutzt die amtliche ELWIS-Fragenverteilung."
    return rules, 60 * 60


def pick_official_sheet_questions(questions: list[Question], license_type: str, sheet_number: int) -> list[Question]:
    by_external_id = {question.external_id.upper(): question for question in questions}
    required_ids = external_ids_for_sheet(license_type, sheet_number)
    selected = []
    missing = []
    for external_id in required_ids:
        question = by_external_id.get(external_id)
        if question:
            selected.append(question)
        else:
            missing.append(external_id)
    if missing:
        raise HTTPException(status_code=409, detail=f"Missing questions for exam sheet: {', '.join(missing)}")
    if license_type == "see":
        nav_id = f"SEE-NAV-{sheet_number:02d}"
        navigation = by_external_id.get(nav_id)
        if navigation:
            selected = [navigation] + selected
        else:
            raise HTTPException(status_code=409, detail=f"Missing navigation task for exam sheet: {nav_id}")
    return selected


def pick_exam_questions(
    questions: list[Question],
    license_type: str | None,
    seed: str,
    sheet_id: str | None = None,
) -> tuple[list[Question], dict, int]:
    target_license = license_type or "see"
    _, sheet_number = parse_sheet_id(sheet_id, target_license)
    if sheet_number:
        selected = pick_official_sheet_questions(questions, target_license, sheet_number)
        rules, seconds = exam_rules(target_license, sheet_id)
        return selected, rules, seconds

    rng = random.Random(seed)

    def take(category: str, count: int) -> list[Question]:
        pool = [question for question in questions if question.category == category]
        rng.shuffle(pool)
        return pool[:count]

    if target_license == "binnen":
        basis = take("Basisfragen", 7)
        specific = take("Spezifische Fragen Binnen", 23)
        rules, seconds = exam_rules("binnen", sheet_id)
        return basis + specific, rules, seconds

    if target_license in {"src", "lrc", "ubi"}:
        rules, seconds = exam_rules(target_license, sheet_id)
        pool = [question for question in questions if question.license_type == target_license]
        rng.shuffle(pool)
        selected = pool[: rules["question_count"]]
        if len(selected) < rules["question_count"]:
            raise HTTPException(status_code=409, detail=f"Not enough questions for {target_license.upper()} exam simulation")
        return selected, rules, seconds

    basis = take("Basisfragen", 7)
    specific = take("Spezifische Fragen See", 23)
    navigation = take("Navigationsaufgaben", 1)
    rules, seconds = exam_rules("see", sheet_id)
    return navigation + basis + specific, rules, seconds


@app.get("/")
def index() -> FileResponse:
    return FileResponse(PUBLIC_DIR / "index.html")


@app.get("/sw.js")
def service_worker() -> FileResponse:
    # Im Root-Scope ausliefern, damit der Service Worker die gesamte App steuert.
    return FileResponse(PUBLIC_DIR / "sw.js", media_type="application/javascript",
                        headers={"Service-Worker-Allowed": "/", "Cache-Control": "no-cache"})


@app.get("/manifest.webmanifest")
def manifest() -> FileResponse:
    return FileResponse(PUBLIC_DIR / "manifest.webmanifest", media_type="application/manifest+json")


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/questions", response_model=list[QuestionOut])
def list_questions(
    license_type: str | None = Query(default=None, pattern="^(see|binnen|fkn|src|lrc|ubi)$"),
    session: Session = Depends(get_session),
) -> list[QuestionOut]:
    statement = select(Question).options(selectinload(Question.progress)).order_by(Question.category, Question.id)
    if license_type:
        statement = statement.where(Question.license_type == license_type)
    return [serialize_question(question) for question in session.scalars(statement).all()]


@app.get("/api/exam-sheets")
def list_exam_sheets(
    license_type: str = Query(default="see", pattern="^(see|binnen)$"),
) -> list[dict]:
    label = "SBF See" if license_type == "see" else "SBF Binnen"
    return [
        {
            "id": exam_sheet_id(license_type, number),
            "label": f"{label} Bogen {number:02d}",
            "license_type": license_type,
            "official_distribution": True,
            "question_numbers": OFFICIAL_EXAM_SHEETS[license_type][number],
        }
        for number in range(1, EXAM_SHEET_COUNT + 1)
    ]


@app.get("/api/session", response_model=SessionOut)
def create_session(
    mode: str = Query(default="learn", pattern="^(learn|exam)$"),
    license_type: str | None = Query(default=None, pattern="^(see|binnen|fkn|src|lrc|ubi)$"),
    limit: int = Query(default=10, ge=1, le=60),
    sheet_id: str | None = Query(default=None, pattern="^(see|binnen)-\\d{2}$"),
    session: Session = Depends(get_session),
) -> SessionOut:
    statement = select(Question).options(selectinload(Question.progress))
    if license_type:
        statement = statement.where(Question.license_type == license_type)
    questions = session.scalars(statement).all()
    # Eigener Zufalls-Salt pro Session: sorgt dafuer, dass sowohl die Frage-
    # auswahl/-reihenfolge als auch die Antwortreihenfolge bei jeder Session
    # neu gemischt werden und nicht jedes Mal identisch sind.
    session_salt = secrets.token_hex(8)
    if mode == "exam":
        if license_type not in {None, "see", "binnen", "src", "lrc", "ubi"}:
            raise HTTPException(status_code=400, detail="Exam mode is only available for SBF See, SBF Binnen, SRC, LRC and UBI")
        ordered, passing_rules, time_limit_seconds = pick_exam_questions(
            questions,
            license_type,
            f"{session_salt}:{license_type or 'see'}",
            sheet_id,
        )
        if sheet_id:
            session_salt = f"fixed:{sheet_id}"
    else:
        ordered = weighted_sample_without_replacement(list(questions), limit)
        passing_rules = {
            "question_count": limit,
            "required_total": 0,
            "max_wrong": 0,
            "note": "Lernmodus: freie Frageanzahl mit Spaced-Repetition-Auswahl.",
        }
        time_limit_seconds = None
    return SessionOut(
        mode=mode,
        time_limit_seconds=time_limit_seconds,
        passing_rules=passing_rules,
        source_summary=source_summary(ordered),
        questions=[
            serialize_question(question, shuffle_salt=f"{session_salt}:{mode}:{idx}:{len(ordered)}") for idx, question in enumerate(ordered)
        ],
    )


@app.post("/api/answer", response_model=AnswerOut)
def submit_answer(payload: AnswerIn, session: Session = Depends(get_session)) -> AnswerOut:
    question = session.get(Question, payload.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    is_correct, progress = record_answer(session, question, payload.selected_index, payload.choice_order)
    correct_index = question.correct_index
    if payload.choice_order:
        correct_index = payload.choice_order.index(question.correct_index)
    return AnswerOut(
        is_correct=is_correct,
        correct_index=correct_index,
        explanation=question.explanation or "Für diese Frage wurde noch keine Erklärung erzeugt.",
        box=progress.box,
        wrong_count=progress.wrong_count,
    )


@app.post("/api/import/json")
def import_json(records: list[dict], session: Session = Depends(get_session)) -> dict:
    return {"imported": upsert_questions(session, records)}


@app.post("/api/import/csv")
async def import_csv(file: UploadFile = File(...), session: Session = Depends(get_session)) -> dict:
    content = (await file.read()).decode("utf-8-sig")
    return {"imported": upsert_questions(session, parse_csv_catalog(content))}
