from scripts.parse_fkn_catalog import parse_text


def test_parse_fkn_catalog_keeps_all_official_question_numbers():
    raw = "\n".join(
        f"{number}. Frage {number}?\nAntwort {number}."
        for number in range(1, 61)
    )

    records = parse_text(raw)

    assert len(records) == 60
    assert records[0]["external_id"] == "FKN-001"
    assert records[-1]["external_id"] == "FKN-060"
    assert records[-1]["license_type"] == "fkn"
    assert records[-1]["card_type"] == "flashcard"


def test_parse_fkn_catalog_ignores_numbered_answer_options():
    raw = "\n".join(
        (
            f"{number}. Frage {number}?\n"
            "1. Erste Antwortoption.\n"
            "2. Zweite Antwortoption.\n"
            "Antwort bleibt bei derselben Frage."
        )
        for number in range(1, 61)
    )

    records = parse_text(raw)

    assert len(records) == 60
    assert records[0]["prompt"] == "Frage 1?"
    assert "Erste Antwortoption" in records[0]["explanation"]
    assert records[1]["external_id"] == "FKN-002"
