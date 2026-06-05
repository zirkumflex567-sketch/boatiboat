from pathlib import Path
from contextlib import asynccontextmanager

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
from .services import parse_csv_catalog, priority_for, record_answer, upsert_questions


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


def serialize_question(question: Question) -> QuestionOut:
    return QuestionOut(
        id=question.id,
        external_id=question.external_id,
        license_type=question.license_type,
        category=question.category,
        prompt=question.prompt,
        choices=question.choices,
        correct_index=question.correct_index,
        explanation=question.explanation,
        priority=priority_for(question),
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
    ordered = sorted(questions, key=lambda question: (-priority_for(question), question.id))[:limit]
    return SessionOut(
        mode=mode,
        time_limit_seconds=limit * 90 if mode == "exam" else None,
        questions=[serialize_question(question) for question in ordered],
    )


@app.post("/api/answer", response_model=AnswerOut)
def submit_answer(payload: AnswerIn, session: Session = Depends(get_session)) -> AnswerOut:
    question = session.get(Question, payload.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    is_correct, progress = record_answer(session, question, payload.selected_index)
    return AnswerOut(
        is_correct=is_correct,
        correct_index=question.correct_index,
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
