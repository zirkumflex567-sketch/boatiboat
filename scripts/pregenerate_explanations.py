import argparse
import asyncio
import os

from litellm import acompletion
from sqlalchemy import select

from app.database import session_scope
from app.models import Question


SYSTEM_PROMPT = (
    "Du erklärst offizielle Prüfungsfragen für den deutschen Sportbootführerschein. "
    "Antworte kurz, präzise und didaktisch: warum die richtige Antwort stimmt und "
    "welcher Denkfehler die falschen Antworten plausibel macht. Keine erfundenen Regeln."
)


def build_prompt(question: Question) -> str:
    choices = "\n".join(
        f"{idx}. {choice}{' (richtig)' if idx == question.correct_index else ''}"
        for idx, choice in enumerate(question.choices)
    )
    return (
        f"Bereich: SBF {question.license_type}\n"
        f"Kategorie: {question.category}\n"
        f"Frage: {question.prompt}\n"
        f"Antworten:\n{choices}\n\n"
        "Erzeuge eine Erklärung mit 2 bis 4 Sätzen."
    )


async def generate_explanation(model: str, question: Question) -> str:
    response = await acompletion(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_prompt(question)},
        ],
        temperature=0.2,
    )
    return response.choices[0].message.content.strip()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Generate missing SBF explanations with LiteLLM.")
    parser.add_argument("--model", default=os.getenv("LITELLM_MODEL", "ollama/gemma3:27b"))
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with session_scope() as session:
        statement = select(Question).where((Question.explanation.is_(None)) | (Question.explanation == ""))
        if args.limit:
            statement = statement.limit(args.limit)
        questions = session.scalars(statement).all()

        for question in questions:
            explanation = await generate_explanation(args.model, question)
            print(f"{question.external_id}: {explanation}")
            if not args.dry_run:
                question.explanation = explanation
                session.add(question)


if __name__ == "__main__":
    asyncio.run(main())
