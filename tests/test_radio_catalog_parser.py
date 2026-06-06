from scripts.parse_radio_catalogs import SPECS, parse_text


def make_catalog_text(count: int, labels: tuple[str, str, str, str]) -> str:
    rows = []
    for number in range(1, count + 1):
        answers = "\n".join(f"{label}) Antwort {label} zu {number}" for label in labels)
        rows.append(f"{number}. Frage {number}?\n[{number}]\n{answers}")
    return "\n\n".join(rows)


def test_parse_radio_catalogs_with_numeric_src_choices():
    spec = SPECS["src"]

    records = parse_text(spec, make_catalog_text(spec.expected_count, spec.choice_labels))

    assert len(records) == 180
    assert records[0]["external_id"] == "SRC-001"
    assert records[-1]["external_id"] == "SRC-180"
    assert records[0]["choices"][0] == "Antwort 1 zu 1"
    assert records[0]["correct_index"] == 0


def test_parse_radio_catalogs_with_letter_choices():
    spec = SPECS["ubi"]

    records = parse_text(spec, make_catalog_text(spec.expected_count, spec.choice_labels))

    assert len(records) == 130
    assert records[0]["external_id"] == "UBI-001"
    assert records[-1]["external_id"] == "UBI-130"
    assert records[0]["choices"][0] == "Antwort a zu 1"


def test_parse_radio_catalogs_accept_malformed_bracket_number():
    spec = SPECS["src"]
    text = make_catalog_text(spec.expected_count, spec.choice_labels).replace("[44]", "[4]")

    records = parse_text(spec, text)

    assert records[43]["external_id"] == "SRC-044"
    assert records[43]["prompt"] == "Frage 44?"
