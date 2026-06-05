"""Extrahiert die zu jeder Katalogfrage gehoerenden Grafiken aus den
amtlichen ELWIS-PDFs und rendert sie als PNG. Eine Frage kann mehrere
Bildteile enthalten (z. B. gestapelte Schifffahrtszeichen); diese werden
als ein zusammenhaengender Seitenausschnitt gerendert.
"""
import fitz, re, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = {
    "see": ROOT / "build/elwis/see.pdf",
    "binnen": ROOT / "build/elwis/binnen.pdf",
}
OUTDIR = ROOT / "frontend/graphics/catalog"
DPI = 200

qre = re.compile(r"^\s*(\d{1,3})\.\s")
are = re.compile(r"^\s*[a-d]\.\s")
STOP = ("Stand:", "Sie sind hier", "Navigationsaufgabe", "Hinweis:")

def first_text(block):
    return "".join(s["text"] for l in block["lines"] for s in l["spans"]).strip()

def extract(license_type, pdf_path):
    doc = fitz.open(pdf_path)
    # collect per question: list of image bboxes (page index + rect), but figures
    # for a question are on one page, so track within page with carry-over number.
    images_by_q = {}   # num -> (page_index, fitz.Rect union)
    current = None
    collecting = False  # True between a question line and its first answer
    for pi in range(len(doc)):
        page = doc[pi]
        d = page.get_text("dict")
        # sort blocks top-to-bottom
        blocks = sorted(d["blocks"], key=lambda b: (round(b["bbox"][1]), b["bbox"][0]))
        for b in blocks:
            if b["type"] == 1:  # image
                if current is not None and collecting:
                    rect = fitz.Rect(b["bbox"])
                    if current in images_by_q and images_by_q[current][0] == pi:
                        images_by_q[current] = (pi, images_by_q[current][1] | rect)
                    elif current not in images_by_q:
                        images_by_q[current] = (pi, rect)
                continue
            txt = first_text(b)
            if not txt:
                continue
            if any(txt.startswith(s) for s in STOP):
                collecting = False
                if txt.startswith("Navigationsaufgabe") or txt.startswith("Hinweis:"):
                    current = None
                continue
            m = qre.match(txt)
            if m:
                current = int(m.group(1))
                collecting = True
                continue
            if are.match(txt):
                collecting = False
    # render
    OUTDIR.mkdir(parents=True, exist_ok=True)
    mapping = {}
    zoom = DPI / 72
    for num, (pi, rect) in sorted(images_by_q.items()):
        # pad and clamp to content width
        page = doc[pi]
        pad = 6
        clip = fitz.Rect(max(rect.x0 - pad, 0), max(rect.y0 - pad, 0),
                         rect.x1 + pad, rect.y1 + pad)
        if clip.width < 8 or clip.height < 8:
            continue
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip)
        ext_id = f"{license_type.upper()}-{num:03d}"
        fname = f"{license_type}-{num:03d}.png"
        pix.save(OUTDIR / fname)
        mapping[ext_id] = f"/assets/graphics/catalog/{fname}"
    return mapping

def main():
    full = {}
    for lic, p in SRC.items():
        m = extract(lic, p)
        print(f"{lic}: {len(m)} Fragen mit Grafik")
        full.update(m)
    (ROOT / "build/elwis/image_map.json").write_text(
        json.dumps(full, ensure_ascii=False, indent=2), encoding="utf-8")
    print("gesamt:", len(full))

if __name__ == "__main__":
    main()
