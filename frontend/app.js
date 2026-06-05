const state = {
  questions: [],
  index: 0,
  correct: 0,
  answered: 0,
  deadline: null,
  timerId: null,
};

const $ = (id) => document.getElementById(id);

async function startSession() {
  const mode = $("mode").value;
  const license = $("license").value;
  const limit = $("limit").value;
  const params = new URLSearchParams({ mode, limit });
  if (license) params.set("license_type", license);

  const response = await fetch(`api/session?${params}`);
  const data = await response.json();
  state.questions = data.questions;
  state.index = 0;
  state.correct = 0;
  state.answered = 0;
  state.deadline = data.time_limit_seconds ? Date.now() + data.time_limit_seconds * 1000 : null;

  clearInterval(state.timerId);
  state.timerId = setInterval(updateTimer, 500);
  updateTimer();
  renderQuestion();
}

function updateTimer() {
  if (!state.deadline) {
    $("timer").textContent = "Lernmodus";
    return;
  }
  const remaining = Math.max(0, Math.floor((state.deadline - Date.now()) / 1000));
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  $("timer").textContent = `${minutes}:${seconds}`;
  if (remaining === 0) {
    [...document.querySelectorAll(".choice")].forEach((button) => (button.disabled = true));
  }
}

function renderQuestion() {
  const question = state.questions[state.index];
  $("score").textContent = `${state.correct} / ${state.answered}`;
  $("next").disabled = true;
  $("explanation").classList.add("hidden");
  $("explanation").textContent = "";

  if (!question) {
    $("category").textContent = "Session beendet";
    $("priority").textContent = "Gut gemacht";
    $("prompt").textContent = `Ergebnis: ${state.correct} von ${state.answered} richtig.`;
    $("choices").innerHTML = "";
    $("next").disabled = false;
    $("next").textContent = "Neue Session";
    return;
  }

  $("next").textContent = "Nächste Frage";
  $("category").textContent = `${question.license_type.toUpperCase()} · ${question.category}`;
  $("priority").textContent = `Priorität ${question.priority.toFixed(1)}`;
  $("prompt").textContent = question.prompt;
  $("choices").innerHTML = "";

  question.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "choice";
    button.innerHTML = `<span>${String.fromCharCode(65 + index)}</span><span>${choice}</span>`;
    button.addEventListener("click", () => submitAnswer(question, index));
    $("choices").appendChild(button);
  });
}

async function submitAnswer(question, selectedIndex) {
  const buttons = [...document.querySelectorAll(".choice")];
  buttons.forEach((button) => (button.disabled = true));

  const response = await fetch("api/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question_id: question.id,
      selected_index: selectedIndex,
      mode: $("mode").value,
    }),
  });
  const result = await response.json();

  state.answered += 1;
  if (result.is_correct) state.correct += 1;
  $("score").textContent = `${state.correct} / ${state.answered}`;

  buttons.forEach((button, index) => {
    if (index === result.correct_index) button.classList.add("correct");
    if (index === selectedIndex && !result.is_correct) button.classList.add("wrong");
  });

  if ($("mode").value === "learn") {
    $("explanation").textContent = result.explanation;
    $("explanation").classList.remove("hidden");
  }
  $("next").disabled = false;
}

$("next").addEventListener("click", () => {
  if (state.index >= state.questions.length) {
    startSession();
    return;
  }
  state.index += 1;
  renderQuestion();
});

$("start").addEventListener("click", startSession);
$("mode").addEventListener("change", startSession);
$("license").addEventListener("change", startSession);

startSession();
