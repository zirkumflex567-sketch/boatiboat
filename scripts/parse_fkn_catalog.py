import argparse
import json
import re
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "build" / "authority_catalogs" / "fkn-fragenkatalog.pdf"
DEFAULT_OUTPUT = ROOT / "app" / "fkn_catalog.json"

SOURCE_NAME = "Anlage 2 zur Pruefungsordnung FKN - Fragen- und Antwortenkatalog"
SOURCE_URL = "https://www.sportbootfuehrerscheine.org/app/uploads/sites/6/2024/08/Anlage-2-Fachkunde_Fragen-_und_Antwortenkatalog_Anlage_2.pdf"
SOURCE_STAND = "01.01.2008/500 010/02"


def pdf_text(path: Path) -> str:
    reader = PdfReader(path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def clean_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value)
    value = value.replace("Ha ndel", "Handel")
    value = value.replace("wer den", "werden")
    value = value.replace("Pers onen", "Personen")
    value = value.replace("Di e ", "Die ")
    return value.strip()


def question_markers(text: str) -> list[re.Match[str]]:
    markers = list(re.finditer(r"(?m)^\s*(\d{1,2})\.\s+", text))
    selected = []
    expected = 1
    for marker in markers:
        if int(marker.group(1)) == expected:
            selected.append(marker)
            expected += 1
        if expected > 60:
            break
    return selected


def parse_text(raw_text: str) -> list[dict]:
    body = raw_text.split("Zusammenstellung der Fragen")[0]
    markers = question_markers(body)
    if len(markers) != 60:
        raise ValueError(f"Expected 60 FKN questions, found {len(markers)}")

    records = []
    for index, marker in enumerate(markers):
        number = int(marker.group(1))
        next_start = markers[index + 1].start() if index + 1 < len(markers) else len(body)
        chunk = body[marker.end():next_start]
        chunk = re.sub(r"\n\s*\d+\s*\n\s*01\.01\.2008/500\s+010/02\s*", "\n", chunk)
        terminators = list(re.finditer(r"[?!]", chunk))
        if not terminators:
            raise ValueError(f"Question {number} has no prompt terminator")
        split = terminators[-1]

        prompt = clean_text(chunk[: split.end()])
        answer = clean_text(chunk[split.end():])
        records.append(
            {
                "external_id": f"FKN-{number:03d}",
                "license_type": "fkn",
                "category": "Fachkundenachweis Seenotsignalmittel",
                "prompt": prompt,
                "choices": [],
                "correct_index": 0,
                "explanation": answer,
                "source_name": SOURCE_NAME,
                "source_url": SOURCE_URL,
                "source_stand": SOURCE_STAND,
                "exam_section": "FKN",
                "card_type": "flashcard",
            }
        )
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse the official FKN question catalog PDF.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    records = parse_text(pdf_text(args.source))
    args.output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(records)} FKN records -> {args.output}")


if __name__ == "__main__":
    main()
