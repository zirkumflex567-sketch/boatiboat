import json
import re
import tempfile
from pathlib import Path

import httpx
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "app" / "official_catalog.json"
SEE_URL = "https://www.elwis.de/DE/Sportschifffahrt/Sportbootfuehrerscheine/Fragenkatalog-See/Fragenkatalog-See-August-2023.pdf?__blob=publicationFile&v=13"

SOURCES = [
    {
        "license_type": "see",
        "source_name": "ELWIS Fragenkatalog See",
        "source_url": SEE_URL,
        "source_stand": "01. August 2023",
        "ranges": [
            (1, 72, "Basisfragen"),
            (73, 285, "Spezifische Fragen See"),
            (286, 300, "Navigationsaufgaben"),
        ],
    },
    {
        "license_type": "binnen",
        "source_name": "ELWIS Fragenkatalog Binnen",
        "source_url": "https://www.elwis.de/DE/Sportschifffahrt/Sportbootfuehrerscheine/Fragenkatalog-Binnen/Fragenkatalog-Binnen-August-2023.pdf?__blob=publicationFile&v=8",
        "source_stand": "01. August 2023",
        "ranges": [
            (1, 72, "Basisfragen"),
            (73, 253, "Spezifische Fragen Binnen"),
            (254, 300, "Spezifische Fragen Segeln"),
        ],
    },
]

NAVIGATION_TASKLETS = [
    {
        "external_id": "SEE-NAV-009-01",
        "license_type": "see",
        "category": "Navigationsaufgaben",
        "prompt": 'Navigationsaufgabe 9: Wann erreicht das Boot voraussichtlich die Tonne "6"?',
        "choices": ["Gegen 13:00 Uhr", "Gegen 12:20 Uhr", "Gegen 14:10 Uhr", "Gegen 15:00 Uhr"],
        "correct_index": 0,
        "explanation": "Die Zeit ergibt sich aus Distanz und Fahrt über Grund. In der amtlichen Navigationsaufgabe 9 ist das erwartete Ergebnis: Gegen 13:00 Uhr.",
    },
    {
        "external_id": "SEE-NAV-009-02",
        "license_type": "see",
        "category": "Navigationsaufgaben",
        "prompt": 'Navigationsaufgabe 9: Von Tonne "1" wird rwK 206° auf den Leuchtturm "Alte Weser" abgesetzt. Ablenkung +4°, Missweisung aus der Karte. Wie lautet der MgK?',
        "choices": ["MgK = 202°", "MgK = 206°", "MgK = 210°", "MgK = 198°"],
        "correct_index": 0,
        "explanation": "Der Magnetkompasskurs entsteht aus dem rechtweisenden Kurs unter Berücksichtigung von Missweisung und Ablenkung. Das amtliche Ergebnis lautet MgK = 202°.",
    },
    {
        "external_id": "SEE-NAV-010-01",
        "license_type": "see",
        "category": "Navigationsaufgaben",
        "prompt": 'Navigationsaufgabe 10: Entnehmen Sie der Seekarte die geographische Position der Tonne "A10".',
        "choices": ["53° 52,6' N 008° 06,4' E", "53° 56,0' N 008° 11,0' E", "53° 50,0' N 007° 53,4' E", "54° 08,6' N 007° 55,7' E"],
        "correct_index": 0,
        "explanation": "Bei Positionsangaben wird zuerst die Breite, dann die Länge gelesen. Das amtliche Ergebnis für Tonne A10 lautet 53° 52,6' N 008° 06,4' E.",
    },
    {
        "external_id": "SEE-NAV-011-03",
        "license_type": "see",
        "category": "Navigationsaufgaben",
        "prompt": 'Navigationsaufgabe 11: Von Position 53° 54,2\' N 007° 53,8\' E wird der Kurs auf Tonne "5" der Neuen Weser abgesetzt. Wie lautet der rwK?',
        "choices": ["rwK = 148°", "rwK = 152°", "rwK = 012°", "rwK = 205°"],
        "correct_index": 0,
        "explanation": "Der rwK wird in der Karte rechtweisend abgetragen und abgelesen. Das amtliche Ergebnis dieser Aufgabe ist rwK = 148°.",
    },
    {
        "external_id": "SEE-NAV-012-08",
        "license_type": "see",
        "category": "Navigationsaufgaben",
        "prompt": 'Navigationsaufgabe 12: Um 09:00 Uhr wird die Tonne "ST" mit rwP = 168° und Distanz 2,0 sm gepeilt. Wie lautet die Besteckversetzung?',
        "choices": ["BV = 296° -0,7 sm", "BV = 168° -2,0 sm", "BV = 007° +0,7 sm", "BV = 304° -4,6 sm"],
        "correct_index": 0,
        "explanation": "Die Besteckversetzung beschreibt Richtung und Betrag der Abweichung zwischen Koppelort und beobachtetem Ort. Das amtliche Ergebnis lautet BV = 296° -0,7 sm.",
    },
    {
        "external_id": "SEE-NAV-014-02",
        "license_type": "see",
        "category": "Navigationsaufgaben",
        "prompt": "Navigationsaufgabe 14: Was bedeuten die Hintergrundfarben weiß, hellblau, hellgrün und hellgelb in der Seekarte?",
        "choices": ['weiß: "tiefes Wasser", hellblau: "flaches Wasser", hellgrün: "Watt", hellgelb: "Land"', 'weiß: "Land", hellblau: "Watt", hellgrün: "tiefes Wasser", hellgelb: "flaches Wasser"', 'weiß: "Sperrgebiet", hellblau: "Land", hellgrün: "Fahrwasser", hellgelb: "Ankerplatz"', 'weiß: "flaches Wasser", hellblau: "tiefes Wasser", hellgrün: "Land", hellgelb: "Watt"'],
        "correct_index": 0,
        "explanation": "Die Kartenfarben helfen beim schnellen Erfassen von Wassertiefe und Landbereichen. Das amtliche Ergebnis ordnet weiß tiefem Wasser, hellblau flachem Wasser, hellgrün Watt und hellgelb Land zu.",
    },
]


def download_pdf(url: str) -> Path:
    target = Path(tempfile.mkdtemp()) / "catalog.pdf"
    with httpx.Client(follow_redirects=True, timeout=60, verify=False) as client:
        response = client.get(url, headers={"User-Agent": "boatiboat-catalog-sync/1.0"})
        response.raise_for_status()
        target.write_bytes(response.content)
    return target


def pdf_text(path: Path) -> str:
    reader = PdfReader(str(path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def section_for(number: int, ranges: list[tuple[int, int, str]]) -> str:
    for start, end, label in ranges:
        if start <= number <= end:
            return label
    return "Allgemein"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def explanation_for(prompt: str, correct: str, section: str) -> str:
    text = f"Richtig ist: {correct.rstrip('.')}"
    lower = f"{prompt} {correct}".lower()
    if "missweisung" in lower:
        return "Die Missweisung ist der Winkel zwischen rechtweisend Nord und magnetisch Nord. Du brauchst sie, um Kartenkurse und Kompasskurse sauber ineinander umzurechnen."
    if "kurzer ton" in lower:
        return "Ein kurzer Ton dauert etwa eine Sekunde. In Manöversignalen ist diese kurze Dauer wichtig, weil sie sich klar vom langen Ton mit vier bis sechs Sekunden unterscheidet."
    if "langer ton" in lower:
        return "Ein langer Ton dauert etwa vier bis sechs Sekunden. Das ist deutlich länger als der kurze Ton und wird deshalb in Schallzeichen eindeutig unterschieden."
    if "steuerbord" in lower and ("gegen" in lower or "kurs" in lower):
        return "Steuerbord ist hier der sichere Standard: Wenn beide Fahrzeuge klar nach rechts ausweichen, ist die Begegnung vorhersehbar und es entsteht keine Kreuzung der Kurse."
    if "lichter" in lower or "laterne" in lower:
        return "Die Lichterführung zeigt anderen Fahrzeugen Art, Lage und Bewegungsrichtung. Entscheidend ist nicht nur, dass ein Licht sichtbar ist, sondern was es ueber Fahrzeugtyp und Kurs aussagt."
    if "navigation" in section.lower() or "navigations" in section.lower():
        return "Bei Navigationsaufgaben zählt der Rechen- oder Kartenweg: erst die gegebene Größe sauber ablesen, dann Einheiten und Vorzeichen prüfen. Die richtige Antwort folgt aus diesem nautischen Zusammenhang."
    return f"{text}. Die falschen Antworten veraendern meist eine entscheidende Bedingung oder Zahl. Lerne deshalb nicht nur den Wortlaut, sondern welches Merkmal in der Frage abgefragt wird."


def image_for(number: int, section: str) -> tuple[str | None, str | None]:
    if "Navigation" in section or "Navigations" in section:
        return "/assets/graphics/navigation-card.svg", "Schematische Seekarten- und Kursdarstellung"
    if number in {7, 10, 11, 12, 13}:
        return "/assets/graphics/lights-card.svg", "Schematische Darstellung von Lichtern und Tagzeichen"
    return None, None


def parse_questions(text: str, source: dict) -> list[dict]:
    pattern = re.compile(
        r"(?ms)^\s*(\d{1,3})\.\s+(.+?)\n\s*a\.\s+(.+?)\n\s*b\.\s+(.+?)\n\s*c\.\s+(.+?)\n\s*d\.\s+(.+?)(?=\n\s*\d{1,3}\.\s+|\n\s*Stand:|\Z)"
    )
    records = []
    seen = set()
    for match in pattern.finditer(text):
        number = int(match.group(1))
        if number in seen:
            continue
        seen.add(number)
        prompt = clean(match.group(2))
        choices = [clean(match.group(idx)) for idx in range(3, 7)]
        section = section_for(number, source["ranges"])
        image_url, image_alt = image_for(number, section)
        records.append(
            {
                "external_id": f"{source['license_type'].upper()}-{number:03d}",
                "license_type": source["license_type"],
                "category": section,
                "prompt": prompt,
                "choices": choices,
                "correct_index": 0,
                "explanation": explanation_for(prompt, choices[0], section),
                "source_name": source["source_name"],
                "source_url": source["source_url"],
                "source_stand": source["source_stand"],
                "exam_section": section,
                "image_url": image_url,
                "image_alt": image_alt,
            }
        )
    return records


def main() -> None:
    all_records = []
    for source in SOURCES:
        path = download_pdf(source["source_url"])
        records = parse_questions(pdf_text(path), source)
        print(f"{source['source_name']}: {len(records)} Fragen extrahiert")
        all_records.extend(records)
    for tasklet in NAVIGATION_TASKLETS:
        tasklet.update(
            {
                "source_name": "ELWIS Fragenkatalog See",
                "source_url": SEE_URL,
                "source_stand": "01. August 2023",
                "exam_section": "Navigationsaufgaben",
                "image_url": "/assets/graphics/navigation-card.svg",
                "image_alt": "Schematische Seekarten- und Kursdarstellung",
            }
        )
        all_records.append(tasklet)
    OUTPUT.write_text(json.dumps(all_records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"geschrieben: {OUTPUT}")


if __name__ == "__main__":
    main()
