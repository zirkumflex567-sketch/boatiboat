from pathlib import Path
from contextlib import asynccontextmanager
import random
import secrets

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .database import get_session
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


def pick_exam_questions(questions: list[Question], license_type: str | None, seed: str) -> tuple[list[Question], dict, int]:
    rng = random.Random(seed)

    def take(category: str, count: int) -> list[Question]:
        pool = [question for question in questions if question.category == category]
        rng.shuffle(pool)
        return pool[:count]

    target_license = license_type or "see"
    if target_license == "binnen":
        basis = take("Basisfragen", 7)
        specific = take("Spezifische Fragen Binnen", 23)
        return (
            basis + specific,
            {
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
            },
            45 * 60,
        )

    basis = take("Basisfragen", 7)
    specific = take("Spezifische Fragen See", 23)
    navigation = take("Navigationsaufgaben", 1)
    return (
        navigation + basis + specific,
        {
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
        },
        60 * 60,
    )


@app.get("/")
def index() -> FileResponse:
    return FileResponse(PUBLIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/questions", response_model=list[QuestionOut])
def list_questions(
    license_type: str | None = Query(default=None, pattern="^(see|binnen)$"),
    session: Session = Depends(get_session),
) -> list[QuestionOut]:
    statement = select(Question).options(selectinload(Question.progress)).order_by(Question.category, Question.id)
    if license_type:
        statement = statement.where(Question.license_type == license_type)
    return [serialize_question(question) for question in session.scalars(statement).all()]


@app.get("/api/session", response_model=SessionOut)
def create_session(
    mode: str = Query(default="learn", pattern="^(learn|exam)$"),
    license_type: str | None = Query(default=None, pattern="^(see|binnen)$"),
    limit: int = Query(default=10, ge=1, le=60),
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
        ordered, passing_rules, time_limit_seconds = pick_exam_questions(
            questions,
            license_type,
            f"{session_salt}:{license_type or 'see'}",
        )
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
