from csv import DictReader
import hashlib
import random
from io import StringIO

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Progress, Question, now_utc
from .schemas import QuestionIn


def normalize_question(data: dict) -> QuestionIn:
    choices = data.get("choices")
    if choices is None:
        choices = data.get("answers")
    if isinstance(choices, str):
        choices = [part.strip() for part in choices.split("|") if part.strip()]
    if choices is None:
        choices = []
    raw_correct = data.get("correct_index")
    if raw_correct is None:
        raw_correct = data.get("correct")
    return QuestionIn(
        external_id=str(data.get("external_id") or data.get("id") or data.get("number")),
        license_type=str(data.get("license_type") or data.get("license") or "see").lower(),
        category=str(data.get("category") or data.get("topic") or "Allgemein"),
        prompt=str(data.get("prompt") or data.get("question") or data.get("text")),
        choices=choices,
        correct_index=int(raw_correct) if raw_correct is not None else 0,
        explanation=data.get("explanation") or None,
        source_name=data.get("source_name") or None,
        source_url=data.get("source_url") or None,
        source_stand=data.get("source_stand") or None,
        image_url=data.get("image_url") or None,
        image_alt=data.get("image_alt") or None,
        exam_section=data.get("exam_section") or None,
        card_type=data.get("card_type") or None,
        scenario=data.get("scenario") or None,
        subtasks=data.get("subtasks") or None,
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


def weighted_sample_without_replacement(
    questions: list[Question],
    limit: int,
    rng: random.Random | None = None,
) -> list[Question]:
    """Zieht Fragen zufaellig, gewichtet nach Spaced-Repetition-Prioritaet.

    Hoehere Prioritaet (zuletzt falsch beantwortete Fragen) erscheint
    wahrscheinlicher und weiter vorne, aber die Auswahl und Reihenfolge
    variiert bei jeder Session. Nutzt das Efraimidis-Spirakis-Verfahren.
    """
    rng = rng or random.Random()
    decorated = []
    for question in questions:
        # Prioritaet quadriert: verstaerkt den Spaced-Repetition-Effekt
        # gegenueber dem grossen Fragenpool, sodass oft falsch beantwortete
        # Fragen zuverlaessig vorne landen, ohne die Reihenfolge zu fixieren.
        weight = max(priority_for(question), 1e-6) ** 2
        # Schluessel: random()^(1/weight) -> absteigend sortiert (Efraimidis-Spirakis)
        key = rng.random() ** (1.0 / weight)
        decorated.append((key, question))
    decorated.sort(key=lambda item: item[0], reverse=True)
    return [question for _, question in decorated[:limit]]


def shuffled_choices(question: Question, salt: str = "") -> dict:
    if not question.choices or len(question.choices) < 2:
        # Lernkarten (z. B. Navigationsaufgaben) haben keine Antwortoptionen.
        return {"choices": list(question.choices or []), "correct_index": 0, "choice_order": None}
    order = list(range(len(question.choices)))
    digest = hashlib.sha256(f"{question.external_id}:{salt}".encode("utf-8")).digest()
    decorated = [(digest[idx % len(digest)], idx) for idx in order]
    order = [idx for _, idx in sorted(decorated, reverse=True)]
    if order == list(range(len(question.choices))) and len(order) > 1:
        order = order[1:] + order[:1]
    return {
        "choices": [question.choices[idx] for idx in order],
        "correct_index": order.index(question.correct_index),
        "choice_order": order,
    }


def record_answer(
    session: Session,
    question: Question,
    selected_index: int,
    choice_order: list[int] | None = None,
) -> tuple[bool, Progress]:
    progress = question.progress or Progress(
        question_id=question.id,
        correct_count=0,
        wrong_count=0,
        streak=0,
        box=1,
    )
    original_index = choice_order[selected_index] if choice_order else selected_index
    is_correct = original_index == question.correct_index
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
