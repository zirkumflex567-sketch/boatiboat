from contextlib import contextmanager
from pathlib import Path
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


DATA_DIR = Path(os.getenv("BOATIBOAT_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'boatiboat.db'}")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


@contextmanager
def session_scope():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_session():
    with session_scope() as session:
        yield session


def ensure_sqlite_columns() -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return
    required = {
        "source_name": "VARCHAR(160)",
        "source_url": "TEXT",
        "source_stand": "VARCHAR(80)",
        "image_url": "TEXT",
        "image_alt": "TEXT",
        "exam_section": "VARCHAR(80)",
        "card_type": "VARCHAR(40)",
        "scenario": "TEXT",
        "subtasks": "JSON",
    }
    with engine.begin() as connection:
        existing = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(questions)")}
        for name, ddl in required.items():
            if name not in existing:
                connection.exec_driver_sql(f"ALTER TABLE questions ADD COLUMN {name} {ddl}")
