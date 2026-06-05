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


def number_hint(choices: list[str] | None) -> str:
    if not choices:
        return ""
    values = []
    for choice in choices:
        values.extend(re.findall(r"\d+(?:[,.]\d+)?\s*(?:%|‰|grad|°|m|km/h|kn|sm|sekunden?|minuten?|stunden?)?", choice.lower()))
    unique = sorted({value.strip() for value in values if value.strip()})
    if len(unique) >= 2:
        return " Die Antwortmöglichkeiten unterscheiden sich hier vor allem in Zahlenwerten; deshalb zählt der exakte amtliche Grenzwert, nicht ein ungefährer Erinnerungswert."
    return ""


def explanation_for(prompt: str, correct: str, section: str, choices: list[str] | None = None) -> str:
    right = correct.rstrip(".")
    lower = f"{prompt} {correct} {section}".lower()
    prefix = f"Richtig ist: {right}."
    numbers = number_hint(choices)

    rules = [
        (
            ("schiffsführer", "verantwortliche"),
            "Vor Fahrtantritt muss klar sein, wer verantwortlich führt. Diese Person trifft die Sicherheitsentscheidungen an Bord; ohne eindeutige Zuständigkeit kann niemand verlässlich handeln.",
        ),
        (
            ("fahrzeug in fahrt", "in fahrt"),
            "Ein Fahrzeug ist nur dann nicht in Fahrt, wenn es festliegt, ankert oder auf Grund sitzt. Sobald keiner dieser Zustände vorliegt, muss es wie ein fahrendes Fahrzeug beurteilt werden.",
        ),
        (
            ("alkohol", "blutalkohol", "berauschender"),
            "Es geht um Fahrtüchtigkeit: Wer körperlich, geistig oder durch Alkohol/Drogen nicht sicher führen kann, darf weder Kurs noch Geschwindigkeit selbst bestimmen. Die Promilleangabe ist nur ein klar messbarer Teil dieser Regel.",
        ),
        (
            ("umwelt", "abfall", "öl", "gewaesser", "gewässer", "einleiten"),
            "Hier geht es um Gewässerschutz. Schadstoffe, Abfälle und Betriebsstoffe dürfen nicht ins Wasser gelangen; zuständig sind je nach Fall Behörden oder Sammelstellen, nicht eine Entsorgung nach Gefühl an Bord.",
        ),
        (
            ("missweisung", "ablenkung", "mgk", "rwk", "rwp", "rechtweisend"),
            "Bei Kursumwandlungen musst du sauber zwischen rechtweisender Richtung, magnetischer Richtung und Kompasskurs trennen. Missweisung kommt aus der Karte, Ablenkung vom Kompass; mit falschem Vorzeichen landet man schnell bei einer plausiblen, aber falschen Antwort.",
        ),
        (
            ("position", "breite", "länge", "seekarte", "geographische"),
            "In der Karte wird zuerst die Breite und dann die Länge gelesen. Kleine Ablesefehler verändern Minuten und Zehntelminuten, daher muss die Position exakt zur gesuchten Tonne oder zum gesuchten Ort passen.",
        ),
        (
            ("tonne", "fahrwasser", "betonnung", "ufer"),
            "Betonnung ordnet das Fahrwasser. Entscheidend ist, von welcher Richtung oder Seite du schaust; vertauscht man diese Perspektive, wirken mehrere Antworten ähnlich, führen aber zur falschen Seite.",
        ),
        (
            ("kurzer ton", "kurzen ton", "kurzen tons", "kurze töne", "schallsignal", "schallzeichen"),
            "Schallsignale sind standardisierte Manöver- und Warnzeichen. Ein kurzer Ton dauert etwa eine Sekunde; die Anzahl und Länge der Töne sagt anderen Fahrzeugführern, was du tust oder welche Gefahr besteht.",
        ),
        (
            ("langer ton", "langen ton", "langen tons", "lange töne"),
            "Ein langer Ton dauert etwa vier bis sechs Sekunden. Diese Dauer unterscheidet ihn eindeutig vom kurzen Ton und macht das Signal auch ohne Sichtkontakt verständlich.",
        ),
        (
            ("lichter", "laterne", "topplicht", "seitenlicht", "hecklicht"),
            "Die Lichterführung zeigt bei Nacht und unsichtigem Wetter Fahrzeugart, Lage und Fahrtrichtung. Wichtig ist die Kombination aus Farbe, Sichtbereich und Anordnung, nicht nur ein einzelnes Licht.",
        ),
        (
            ("ausweich", "kurshalter", "begegn", "kreuzend", "überholen", "vorfahrt"),
            "Die Ausweichregeln sollen eine klare, früh erkennbare Bewegung erzeugen. Ein Fahrzeug ist ausweichpflichtig, das andere hält Kurs und Geschwindigkeit; beim Überholen bleibt der Überholende grundsätzlich ausweichpflichtig.",
        ),
        (
            ("steuerbord", "backbord", "rechts"),
            "Steuerbord und Backbord beziehen sich immer auf das eigene Fahrzeug in Fahrtrichtung. Bei Begegnungen sorgt ein klares Steuerbord-Ausweichen dafür, dass beide Seiten vorhersehbar handeln.",
        ),
        (
            ("segel", "maschinenfahrzeug", "maschine", "motor"),
            "Unter Segeln gelten andere Begegnungsregeln als unter Maschine. Läuft ein Motor mit und bestimmt den Vortrieb, zählt das Fahrzeug rechtlich nicht mehr wie ein reines Segelfahrzeug.",
        ),
        (
            ("luvseite", "leeseite", "luv", "lee"),
            "Luv ist die dem Wind zugewandte Seite, Lee die vom Wind abgewandte Seite. Bei Segel- und Ausweichregeln ist diese Blickrichtung wichtig, weil sie bestimmt, welches Boot welche Pflicht hat.",
        ),
        (
            ("schleuse", "schleusen", "wehr"),
            "An Schleusen und Wehren ist geordnetes, langsames Verhalten wichtig, weil Strömung, Sog und begrenzter Raum wenig Fehler verzeihen. Signale und Anweisungen haben dort Vorrang vor Bequemlichkeit.",
        ),
        (
            ("anker", "ankern"),
            "Beim Ankern geht es um sicheren Halt ohne Behinderung anderer. Ankerplatz, Wassertiefe, Schwojkreis und Fahrwasser müssen zusammenpassen, sonst wird ein sicher wirkender Platz zur Gefahr.",
        ),
        (
            ("rettungsweste", "rettungsmittel", "mann über bord"),
            "Rettungsmittel helfen nur, wenn sie sofort erreichbar und passend eingesetzt werden. Bei Mensch-über-Bord zählt zuerst Sichtkontakt, ruhiges Manövrieren und das schnelle Herstellen von Auftrieb.",
        ),
        (
            ("wetter", "wind", "beaufort", "sturm", "nebel", "sicht"),
            "Wetterzeichen sind Sicherheitsinformationen. Windstärke, Sicht und Gewittergefahr verändern Fahrweise, Geschwindigkeit und die Entscheidung, ob man überhaupt ausläuft.",
        ),
        (
            ("geschwindigkeit", "sog", "wellenschlag", "abstand"),
            "Geschwindigkeit ist nicht nur eine Zahl: Sie muss so gewählt werden, dass Sog, Wellenschlag, Bremsweg und Reaktionszeit zur Situation passen. In engen oder belebten Bereichen ist deshalb besonders vorsichtig zu fahren.",
        ),
        (
            ("führerschein", "befähigungsnachweis", "sportbootführerschein"),
            "Die Frage prüft, wann ein amtlicher Befähigungsnachweis erforderlich ist. Maßgeblich sind Antriebsart, Leistung, Revier und Fahrzeug, nicht nur die subjektive Erfahrung des Bootsführers.",
        ),
        (
            ("navigationsaufgabe", "distanz", "besteck", "peilung", "koppelort"),
            "Bei Navigationsaufgaben zählt der Rechen- oder Kartenweg: Angaben sauber ablesen, Einheiten prüfen und erst dann rechnen. Die falschen Antworten entstehen meist durch vertauschte Vorzeichen, ungenaue Ablesung oder falsche Zeit-Distanz-Rechnung.",
        ),
    ]

    for keywords, detail in rules:
        if any(keyword in lower for keyword in keywords):
            return f"{prefix} {detail}{numbers}"

    if "basisfragen" in section.lower():
        return f"{prefix} Diese Basisfrage prüft eine Grundregel, die im Alltag an Bord direkt über sicheres Verhalten entscheidet. Lies besonders auf Bedingungen wie 'nur', 'immer', 'nicht' und konkrete Grenzwerte; dort sitzen die typischen Fallen.{numbers}"
    if "binnen" in section.lower():
        return f"{prefix} Binnen gelten zusätzlich die besonderen Regeln für enge Fahrwasser, Berufsschifffahrt, Schleusen und Uferbereiche. Die richtige Antwort passt zur sicheren, vorhersehbaren Fahrweise auf begrenztem Raum.{numbers}"
    if "see" in section.lower():
        return f"{prefix} Auf See stehen KVR, Sichtbarkeit, Navigation und eigenständige Gefahrenbeurteilung im Vordergrund. Die richtige Antwort ist die, die anderen Fahrzeugen dein Verhalten eindeutig erkennbar macht und die nautische Situation sauber bewertet.{numbers}"
    return f"{prefix} Entscheidend ist die konkrete Bedingung in der Frage. Die falschen Antworten klingen oft ähnlich, ändern aber Zuständigkeit, Grenzwert, Reihenfolge oder Geltungsbereich.{numbers}"


def image_for(number: int, section: str) -> tuple[str | None, str | None]:
    # Echte Grafiken werden aus den PDFs extrahiert (siehe extract_catalog_images.py)
    # und nachträglich über die image_map zugeordnet.
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
                "explanation": explanation_for(prompt, choices[0], section, choices),
                "source_name": source["source_name"],
                "source_url": source["source_url"],
                "source_stand": source["source_stand"],
                "exam_section": section,
                "image_url": image_url,
                "image_alt": image_alt,
            }
        )
    return records


PDF_DIR = ROOT / "build" / "elwis"
NAV_NOTE = (
    "Amtliche Lösungen aus dem ELWIS-Fragenkatalog See. In der Prüfung wird diese "
    "Aufgabe an der amtlichen Übungskarte D49 (Mündungen der Jade, Weser und Elbe) "
    "bearbeitet. Die Karte ist urheberrechtlich geschützt (BSH) und im Fachhandel erhältlich."
)


TONE_SVG_OVERRIDES = {
    "BINNEN-004": ("/assets/graphics/catalog/tone-kurz.svg", "Schallzeichen: ein kurzer Ton"),
    "SEE-004": ("/assets/graphics/catalog/tone-kurz.svg", "Schallzeichen: ein kurzer Ton"),
    "BINNEN-005": ("/assets/graphics/catalog/tone-lang.svg", "Schallzeichen: ein langer Ton"),
    "SEE-005": ("/assets/graphics/catalog/tone-lang.svg", "Schallzeichen: ein langer Ton"),
    "SEE-116": ("/assets/graphics/catalog/tone-lang.svg", "Schallzeichen: ein langer Ton"),
    "SEE-117": ("/assets/graphics/catalog/tone-lang-lang.svg", "Schallzeichen: zwei lange Töne"),
}


def save_pdf(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with httpx.Client(follow_redirects=True, timeout=120, verify=False) as client:
        response = client.get(url, headers={"User-Agent": "boatiboat-catalog-sync/1.0"})
        response.raise_for_status()
        dest.write_bytes(response.content)
    return dest


def build_navigation_cards() -> list[dict]:
    import extract_nav_tasks  # liest build/elwis/see.pdf, schreibt nav_tasks.json

    extract_nav_tasks.main()
    nav = json.loads((PDF_DIR / "nav_tasks.json").read_text(encoding="utf-8"))
    cards = []
    for task in nav["tasks"]:
        cards.append({
            "external_id": f"SEE-NAV-{task['task']:02d}",
            "license_type": "see",
            "category": "Navigationsaufgaben",
            "card_type": "navigation",
            "prompt": f"Navigationsaufgabe {task['task']}",
            "scenario": task["scenario"],
            "subtasks": task["subtasks"],
            "choices": [],
            "correct_index": 0,
            "explanation": NAV_NOTE,
            "source_name": "ELWIS Fragenkatalog See",
            "source_url": SEE_URL,
            "source_stand": "01. August 2023",
            "exam_section": "Navigationsaufgaben",
            "image_url": None,
            "image_alt": None,
        })
    return cards


def main() -> None:
    import extract_catalog_images  # liest build/elwis/*.pdf, schreibt image_map.json

    all_records = []
    for source in SOURCES:
        dest = PDF_DIR / f"{source['license_type']}.pdf"
        save_pdf(source["source_url"], dest)
        records = parse_questions(pdf_text(dest), source)
        print(f"{source['source_name']}: {len(records)} Fragen extrahiert")
        all_records.extend(records)

    # Echte Grafiken aus den PDFs extrahieren und zuordnen
    extract_catalog_images.main()
    image_map = json.loads((PDF_DIR / "image_map.json").read_text(encoding="utf-8"))
    for record in all_records:
        url = image_map.get(record["external_id"])
        if url:
            record["image_url"] = url
            record["image_alt"] = f"Abbildung zur Frage: {record['prompt']}"
    print(f"Grafiken zugeordnet: {sum(1 for r in all_records if r.get('image_url'))}")

    # Niedrig aufgeloeste Inline-Tonzeichen durch saubere SVGs ersetzen
    for record in all_records:
        ov = TONE_SVG_OVERRIDES.get(record["external_id"])
        if ov:
            record["image_url"], record["image_alt"] = ov

    # Amtliche Navigationsaufgaben als Lernkarten anhängen
    nav_cards = build_navigation_cards()
    all_records.extend(nav_cards)
    print(f"Navigationsaufgaben: {len(nav_cards)}")

    OUTPUT.write_text(json.dumps(all_records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"geschrieben: {OUTPUT} ({len(all_records)} Eintraege)")


if __name__ == "__main__":
    main()
