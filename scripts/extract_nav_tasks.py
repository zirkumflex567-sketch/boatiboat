"""Extrahiert die 15 amtlichen SBF-See-Navigationsaufgaben aus der ELWIS-PDF:
Szenario, Teilaufgaben (Nummer/Aufgabenstellung/Ergebnis) sowie die 8
Kartenausschnitt-Koordinaten der amtlichen Uebungskarte D49.
"""
import fitz, re, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "build/elwis/see.pdf"

def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip()

def pick_task_table(page):
    for t in page.find_tables().tables:
        rows = t.extract()
        if not rows:
            continue
        header = " ".join(clean(c) for c in rows[0] if c)
        if "Nummer" in header and "Ergebnis" in header:
            return rows
    return None

def main():
    doc = fitz.open(PDF)
    tasks = {}
    extents = {}
    for pi in range(len(doc)):
        text = doc[pi].get_text()
        if "Kartenausschnitte zu bearbeiten" in text:
            seg = text.split("Kartenausschnitte zu bearbeiten", 1)[1]
            seg = seg.split("Aus den nachfolgenden", 1)[0]
            for m in re.finditer(r"(\d{1,2})\.\s*(N\d.+?)(?=\s+\d{1,2}\.\s*N|\s*$)", seg, re.S):
                extents[int(m.group(1))] = clean(m.group(2))
        mh = re.search(r"Navigationsaufgabe\s+(\d{1,2})\s*\n", text)
        if not mh:
            continue
        num = int(mh.group(1))
        if num in tasks:
            continue
        rows = pick_task_table(doc[pi])
        if not rows:
            continue
        sc = re.search(r"Navigationsaufgabe\s+\d{1,2}\s*\n(.*?)\nNummer", text, re.S)
        scenario = clean(sc.group(1)) if sc else ""
        scenario = re.sub(r"^(Navigationsaufgaben?\s*\d*\s*)+", "", scenario)
        subtasks = []
        for row in rows:
            nummer = clean(row[0])
            if not re.match(r"^\d{1,2}\.?$", nummer):
                continue
            subtasks.append({"n": int(nummer.rstrip(".")),
                             "question": clean(row[1]), "answer": clean(row[2])})
        if subtasks:
            tasks[num] = {"scenario": scenario, "subtasks": subtasks}
    out = {"chart": {"name": "Amtliche Uebungskarte D49 (Muendungen der Jade, Weser und Elbe)",
                     "sections": [{"section": k, "extent": extents[k]} for k in sorted(extents)]},
           "tasks": []}
    for num in sorted(tasks):
        out["tasks"].append({"task": num, "scenario": tasks[num]["scenario"],
                             "subtasks": tasks[num]["subtasks"]})
    (ROOT / "build/elwis/nav_tasks.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("chart sections:", len(out["chart"]["sections"]))
    print("tasks:", len(out["tasks"]))
    for t in out["tasks"]:
        print(f"  Aufgabe {t['task']:2}: {len(t['subtasks'])} Teilaufgaben")

if __name__ == "__main__":
    main()
