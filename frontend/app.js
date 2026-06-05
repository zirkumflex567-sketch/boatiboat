const state = {
  questions: [],
  index: 0,
  correct: 0,
  answered: 0,
  deadline: null,
  timerId: null,
  sourceSummary: [],
  results: [],
};

const $ = (id) => document.getElementById(id);

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode")) $("mode").value = params.get("mode");
  if (params.get("license")) $("license").value = params.get("license");
  if (params.get("limit")) $("limit").value = params.get("limit");
}

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
  state.sourceSummary = data.source_summary || [];
  state.results = [];
  state.deadline = data.time_limit_seconds ? Date.now() + data.time_limit_seconds * 1000 : null;

  clearInterval(state.timerId);
  state.timerId = setInterval(updateTimer, 500);
  updateTimer();
  renderSources();
  renderQuestion();
}

function renderSources() {
  $("sources").innerHTML = state.sourceSummary
    .map(
      (source) =>
        `<a href="${source.url}" target="_blank" rel="noreferrer">${source.name} · Stand: ${source.stand}</a>`
    )
    .join("");
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
  $("media").classList.add("hidden");

  if (!question) {
    const passed = $("mode").value === "exam" ? state.correct >= Math.max(0, state.answered - 5) : true;
    $("category").textContent = "Session beendet";
    $("priority").textContent = $("mode").value === "exam" ? (passed ? "Bestanden" : "Nicht bestanden") : "Gut gemacht";
    $("prompt").textContent = `Ergebnis: ${state.correct} von ${state.answered} richtig.`;
    $("choices").innerHTML = state.results
      .filter((result) => !result.is_correct)
      .slice(0, 8)
      .map((result) => `<div class="review-item"><strong>${result.label}</strong><span>${result.explanation}</span></div>`)
      .join("");
    $("next").disabled = false;
    $("next").textContent = "Neue Session";
    return;
  }

  $("next").textContent = "Nächste Frage";
  $("category").textContent = `${question.license_type.toUpperCase()} · ${question.category}`;
  $("priority").textContent = question.source_stand
    ? `Stand ${question.source_stand}`
    : `Priorität ${question.priority.toFixed(1)}`;
  $("prompt").textContent = question.prompt;
  $("choices").innerHTML = "";

  if (question.image_url) {
    $("mediaImage").src = question.image_url;
    $("mediaImage").alt = question.image_alt || "";
    $("media").classList.remove("hidden");
  }

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
      choice_order: question.choice_order,
    }),
  });
  const result = await response.json();
  const isExam = $("mode").value === "exam";

  state.answered += 1;
  if (result.is_correct) state.correct += 1;
  state.results.push({
    is_correct: result.is_correct,
    label: `${question.external_id}: ${question.prompt}`,
    explanation: result.explanation,
  });
  $("score").textContent = `${state.correct} / ${state.answered}`;

  buttons.forEach((button, index) => {
    if (isExam && index === selectedIndex) button.classList.add("selected");
    if (!isExam && index === result.correct_index) button.classList.add("correct");
    if (!isExam && index === selectedIndex && !result.is_correct) button.classList.add("wrong");
  });

  if (isExam) {
    $("explanation").textContent = "Antwort gespeichert. Die Auflösung kommt am Ende der Prüfung.";
  } else {
    $("explanation").innerHTML = `<strong>Warum?</strong> ${result.explanation}`;
  }
  $("explanation").classList.remove("hidden");
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

applyUrlParams();
$("start").addEventListener("click", startSession);
$("mode").addEventListener("change", startSession);
$("license").addEventListener("change", startSession);

startSession();
