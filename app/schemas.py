from pydantic import BaseModel, Field


class QuestionIn(BaseModel):
    external_id: str
    license_type: str = Field(pattern="^(see|binnen)$")
    category: str
    prompt: str
    choices: list[str] = Field(min_length=2)
    correct_index: int
    explanation: str | None = None


class QuestionOut(QuestionIn):
    id: int
    priority: float = 1


class AnswerIn(BaseModel):
    question_id: int
    selected_index: int
    mode: str = Field(default="learn", pattern="^(learn|exam)$")


class AnswerOut(BaseModel):
    is_correct: bool
    correct_index: int
    explanation: str
    box: int
    wrong_count: int


class SessionOut(BaseModel):
    mode: str
    time_limit_seconds: int | None
    questions: list[QuestionOut]
