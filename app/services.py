from csv import DictReader
from io import StringIO

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Progress, Question, now_utc
from .schemas import QuestionIn


def normalize_question(data: dict) -> QuestionIn:
    choices = data.get("choices") or data.get("answers")
    if isinstance(choices, str):
        choices = [part.strip() for part in choices.split("|") if part.strip()]
    return QuestionIn(
        external_id=str(data.get("external_id") or data.get("id") or data.get("number")),
        license_type=str(data.get("license_type") or data.get("license") or "see").lower(),
        category=str(data.get("category") or data.get("topic") or "Allgemein"),
        prompt=str(data.get("prompt") or data.get("question") or data.get("text")),
        choices=choices,
        correct_index=int(data.get("correct_index") if data.get("correct_index") is not None else data.get("correct")),
        explanation=data.get("explanation") or None,
    )


def upsert_questions(session: Session, records: list[dict]) -> int:
    imported = 0
    for record in records:
        item = normalize_question(record)
        existing = session.scalar(select(Question).where(Question.external_id == item.external_id))
        payload = item.model_dump()
        if existing:
            for key, value in payload.items():
                setattr(existing, key, value)
        else:
            session.add(Question(**payload))
        imported += 1
    return imported


def parse_csv_catalog(content: str) -> list[dict]:
    return list(DictReader(StringIO(content)))


def priority_for(question: Question) -> float:
    progress = question.progress
    if not progress:
        return 1.0
    return max(0.25, 1 + progress.wrong_count * 2 - progress.correct_count * 0.35 - progress.box * 0.15)


def record_answer(session: Session, question: Question, selected_index: int) -> tuple[bool, Progress]:
    progress = question.progress or Progress(
        question_id=question.id,
        correct_count=0,
        wrong_count=0,
        streak=0,
        box=1,
    )
    is_correct = selected_index == question.correct_index
    if is_correct:
        progress.correct_count += 1
        progress.streak += 1
        progress.box = min(5, progress.box + 1)
    else:
        progress.wrong_count += 1
        progress.streak = 0
        progress.box = 1
    progress.last_answered_at = now_utc()
    session.add(progress)
    return is_correct, progress
