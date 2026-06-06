import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "build" / "authority_catalogs"
APP_DIR = ROOT / "app"


@dataclass(frozen=True)
class CatalogSpec:
    license_type: str
    expected_count: int
    source: Path
    output: Path
    source_name: str
    source_url: str
    source_stand: str
    choice_labels: tuple[str, str, str, str]
    categories: tuple[tuple[int, int, str], ...]


SPECS = {
    "src": CatalogSpec(
        license_type="src",
        expected_count=180,
        source=SOURCE_DIR / "src-fragenkatalog.pdf",
        output=APP_DIR / "src_catalog.json",
        source_name="ELWIS Gesamtfragenkatalog SRC",
        source_url="https://www.elwis.de/DE/Schifffahrtsrecht/Sprechfunkzeugnisse/Fragenkatalog-SRC-2018.pdf?__blob=publicationFile&v=3",
        source_stand="10/2018 Korrektur 07012019",
        choice_labels=("1", "2", "3", "4"),
        categories=(
            (1, 23, "Mobiler Seefunkdienst und GMDSS"),
            (24, 52, "Funkeinrichtungen und Seefunkstellen"),
            (53, 68, "Digitaler Selektivruf (DSC)"),
            (69, 84, "UKW/VHF-Sprechfunk"),
            (85, 115, "Betriebsverfahren und Rangfolgen"),
            (116, 124, "NAVTEX"),
            (125, 180, "SAR, EPIRB und SART"),
        ),
    ),
    "lrc": CatalogSpec(
        license_type="lrc",
        expected_count=76,
        source=SOURCE_DIR / "lrc-fragenkatalog.pdf",
        output=APP_DIR / "lrc_catalog.json",
        source_name="ELWIS Fragenkatalog LRC",
        source_url="https://www.elwis.de/DE/Schifffahrtsrecht/Sprechfunkzeugnisse/Fragenkatalog-LRC-2018.pdf?__blob=publicationFile&v=2",
        source_stand="02/2024",
        choice_labels=("a", "b", "c", "d"),
        categories=(
            (1, 14, "Mobiler Seefunkdienst, Satelliten und GMDSS"),
            (15, 18, "Funkeinrichtungen und Seefunkstellen"),
            (19, 24, "Digitaler Selektivruf (DSC)"),
            (25, 40, "GW/KW-Sprechfunk und Funkwellenausbreitung"),
            (41, 50, "Betriebsverfahren"),
            (51, 76, "Inmarsat"),
        ),
    ),
    "ubi": CatalogSpec(
        license_type="ubi",
        expected_count=130,
        source=SOURCE_DIR / "ubi-gesamtfragenkatalog-2023.pdf",
        output=APP_DIR / "ubi_catalog.json",
        source_name="ABVT UBI Gesamtfragenkatalog",
        source_url="https://www.abvt.wsv.de/Webs/WSA/ABVT/DE/SharedDocs/Downloads/UBI_Gesamtfragenkatalog_2023-08-16.pdf?__blob=publicationFile&v=2",
        source_stand="08/2023",
        choice_labels=("a", "b", "c", "d"),
        categories=(
            (1, 24, "Binnenschifffahrtsfunk"),
            (25, 54, "Funkeinrichtungen und Schiffsfunkstellen"),
            (55, 79, "Verkehrskreise"),
            (80, 108, "Sprechfunk"),
            (109, 130, "Betriebsverfahren und Rangfolgen"),
        ),
    ),
}


def pdf_text(path: Path) -> str:
    reader = PdfReader(path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def clean_text(value: str) -> str:
    value = value.replace("\u00a0", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\s+\n", "\n", value)
    value = re.sub(r"\n\s+", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def strip_headers(text: str) -> str:
    lines = []
    for line in text.splitlines():
        compact = line.strip()
        if not compact:
            lines.append("")
            continue
        if re.fullmatch(r"\d{1,3}", compact):
            continue
        if compact.startswith("Alle Rechte vorbehalten"):
            continue
        if compact.startswith("nur mit ausdrücklicher Genehmigung"):
            continue
        if compact.startswith("Gesamtfragenkatalog für"):
            continue
        if compact.startswith("Fragenkatalog für das"):
            continue
        if compact.startswith("FRAGENKATALOG FÜR DAS"):
            continue
        if compact.startswith("Dies ist eine Leseversion"):
            continue
        if compact.startswith("Rechtsverbindlich sind"):
            continue
        if compact.startswith("Stand:") or compact.startswith("ABVT Koblenz. Stand"):
            continue
        lines.append(line)
    return "\n".join(lines)


def category_for(spec: CatalogSpec, number: int) -> str:
    for start, end, title in spec.categories:
        if start <= number <= end:
            return title
    return "Funkfragen"


def parse_question_chunk(spec: CatalogSpec, number: int, chunk: str) -> dict:
    marker = re.search(r"\[\s*\d{1,3}\s*\]", chunk)
    if not marker:
        raise ValueError(f"{spec.license_type.upper()}-{number:03d} has no bracket marker")
    prompt = clean_text(chunk[: marker.start()])
    answer_block = chunk[marker.end():]
    label_pattern = "|".join(re.escape(label) for label in spec.choice_labels)
    choices = re.findall(
        rf"(?ms)(?:^|\n)\s*({label_pattern})\)\s+(.*?)(?=\n\s*(?:{label_pattern})\)\s+|\Z)",
        answer_block,
    )
    if len(choices) != 4:
        raise ValueError(f"{spec.license_type.upper()}-{number:03d} expected 4 choices, found {len(choices)}")
    return {
        "external_id": f"{spec.license_type.upper()}-{number:03d}",
        "license_type": spec.license_type,
        "category": category_for(spec, number),
        "prompt": prompt,
        "choices": [clean_text(choice) for _, choice in choices],
        "correct_index": 0,
        "explanation": "Laut amtlichem Katalog ist die erste Antwort richtig.",
        "source_name": spec.source_name,
        "source_url": spec.source_url,
        "source_stand": spec.source_stand,
        "exam_section": spec.license_type.upper(),
    }


def parse_text(spec: CatalogSpec, raw_text: str) -> list[dict]:
    body = strip_headers(raw_text)
    starts = list(re.finditer(r"(?m)^\s*(\d{1,3})\.\s+", body))
    chunks: dict[int, str] = {}
    for index, start in enumerate(starts):
        number = int(start.group(1))
        if not (1 <= number <= spec.expected_count):
            continue
        end = starts[index + 1].start() if index + 1 < len(starts) else len(body)
        chunk = body[start.end():end]
        if re.search(r"\[\s*\d{1,3}\s*\]", chunk):
            chunks[number] = chunk
    missing = [number for number in range(1, spec.expected_count + 1) if number not in chunks]
    if missing:
        raise ValueError(f"{spec.license_type.upper()} missing questions: {missing[:12]}")
    return [parse_question_chunk(spec, number, chunks[number]) for number in range(1, spec.expected_count + 1)]


def parse_catalog(spec: CatalogSpec) -> list[dict]:
    return parse_text(spec, pdf_text(spec.source))


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse official radio certificate question catalogs.")
    parser.add_argument("catalog", choices=[*SPECS.keys(), "all"], nargs="?", default="all")
    args = parser.parse_args()

    selected = SPECS.values() if args.catalog == "all" else [SPECS[args.catalog]]
    for spec in selected:
        records = parse_catalog(spec)
        spec.output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{len(records)} {spec.license_type.upper()} records -> {spec.output}")


if __name__ == "__main__":
    main()
