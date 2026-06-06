# Behördenquellen für Katalogdaten

Boatiboat nutzt nur amtliche oder behördennahe Primärquellen als Grundlage für Katalogdaten.

## Bereits importiert

- SBF See Fragenkatalog: ELWIS, Stand 01. August 2023
- SBF Binnen Fragenkatalog: ELWIS, Stand 01. August 2023
- SBF See Fragenverteilung: ELWIS / Verkehrsblatt 2012, S. 224
- SBF Binnen Fragenverteilung: ELWIS / Verkehrsblatt 2012, S. 225

## Für nächste Scheine abgerufen

- SRC Gesamtfragenkatalog: ELWIS / Fachstelle der WSV für Verkehrstechniken
- LRC Fragenkatalog: ELWIS / Fachstelle der WSV für Verkehrstechniken
- UBI Fragenkatalog: Bundes-Verwaltungsvorschriften im Internet
- FKN Fragen- und Antwortenkatalog: gemeinsames Sportbootführerschein-Portal von DMYV und DSV

## Bodenseeschifferpatent

Für das Bodenseeschifferpatent ist ein Behördenhinweis des Landkreises Konstanz zum neuen
Fragenkatalog erfasst. Ein offizieller, frei herunterladbarer Behördenkatalog mit allen Fragen
wurde bei der Recherche nicht gefunden. Drittanbieter-Abschriften werden deshalb nicht importiert,
bis eine belastbare Quelle oder Genehmigung vorliegt.

## Abruf

```powershell
.venv\Scripts\python scripts\fetch_authority_catalogs.py
```

Das Skript schreibt die Quellen nach `build/authority_catalogs/` und erzeugt dort ein Manifest
mit Dateigrößen und SHA-256-Prüfsummen. `build/` bleibt bewusst unversioniert.
