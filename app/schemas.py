from pydantic import BaseModel, Field


class QuestionIn(BaseModel):
    external_id: str
    license_type: str = Field(pattern="^(see|binnen)$")
    category: str
    prompt: str
    choices: list[str] = []
    correct_index: int = 0
    explanation: str | None = None
    source_name: str | None = None
    source_url: str | None = None
    source_stand: str | None = None
    image_url: str | None = None
    image_alt: str | None = None
    exam_section: str | None = None
    card_type: str | None = None
    scenario: str | None = None
    subtasks: list[dict] | None = None


class QuestionOut(QuestionIn):
    id: int
    priority: float = 1
    choice_order: list[int] | None = None


class AnswerIn(BaseModel):
    question_id: int
    selected_index: int
    mode: str = Field(default="learn", pattern="^(learn|exam)$")
    choice_order: list[int] | None = None


class AnswerOut(BaseModel):
    is_correct: bool
    correct_index: int
    explanation: str
    box: int
    wrong_count: int


class SessionOut(BaseModel):
    mode: str
    time_limit_seconds: int | None
    passing_rules: dict
    source_summary: list[dict]
    questions: list[QuestionOut]
