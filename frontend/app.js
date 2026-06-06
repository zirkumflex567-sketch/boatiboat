"use strict";

/* ======================================================================
   Boatiboat SBF Trainer – local-first single page app
   Fortschritt & Statistik werden im localStorage des Browsers gehalten.
   ====================================================================== */

const APP = document.getElementById("app");
const TOAST = document.getElementById("toast");
const TOPACTIONS = document.getElementById("topbarActions");

const STORE_KEY = "boatiboat.progress.v1";
const CACHE_KEY = "boatiboat.catalog.v1";

const MASTER_BOX = 5;
const CAT_ORDER = [
  "Basisfragen",
  "Spezifische Fragen See",
  "Spezifische Fragen Binnen",
  "Spezifische Fragen Segeln",
  "Navigationsaufgaben",
];

let CATALOG = [];           // alle Fragen
let MC = [];                // Multiple-Choice-Fragen
let NAV = [];               // Navigationsaufgaben (Lernkarten)
let session = null;         // aktuelle Lern-/Prüfungssession
let timerId = null;

/* ---------------------------------------------------------------- store */
function defaultStore() {
  return { v: 1, scope: "all", byId: {}, streak: 0, best: 0, autoAdvance: false };
}
function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.byId) return Object.assign(defaultStore(), s);
  } catch (e) {}
  return defaultStore();
}
let store = loadStore();
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
}
function stat(id) {
  return store.byId[id] || { box: 1, c: 0, w: 0, seen: 0, last: 0, lastCorrect: null };
}
function recordAnswer(id, correct) {
  const st = store.byId[id] || { box: 1, c: 0, w: 0, seen: 0, last: 0, lastCorrect: null };
  st.seen += 1;
  st.last = Date.now();
  st.lastCorrect = correct;
  if (correct) { st.c += 1; st.box = Math.min(MASTER_BOX, st.box + 1); store.streak += 1; }
  else { st.w += 1; st.box = 1; store.streak = 0; }
  store.best = Math.max(store.best, store.streak);
  store.byId[id] = st;
  saveStore();
}

/* --------------------------------------------------------------- helpers */
function $(sel, root = document) { return root.querySelector(sel); }
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    n.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
  }
  return n;
}
function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function toast(msg) {
  TOAST.textContent = msg; TOAST.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => TOAST.classList.remove("show"), 2200);
}
function fmtTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/* ------------------------------------------------------------ data load */
async function loadCatalog() {
  // 1) Offline gebündelter Katalog (Android-App / PWA): sofort nutzen
  if (window.__CATALOG__ && Array.isArray(window.__CATALOG__) && window.__CATALOG__.length) {
    setCatalog(window.__CATALOG__);
    return;
  }
  // 2) Lokaler Cache vom letzten Online-Besuch: sofort rendern, dann auffrischen
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) {}
  if (cached && Array.isArray(cached.q) && cached.q.length) {
    setCatalog(cached.q);
    refreshCatalog();
    return;
  }
  // 3) Erstbesuch online
  await refreshCatalog();
}
async function refreshCatalog() {
  try {
    const res = await fetch("api/questions");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      const changed = data.length !== CATALOG.length;
      setCatalog(data);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ q: data, t: Date.now() })); } catch (e) {}
      if (changed && session === null) renderHome();
    }
  } catch (e) {
    if (!CATALOG.length) {
      APP.innerHTML = "";
      APP.appendChild(el("div", { class: "qcard" },
        el("h2", {}, "Fragen konnten nicht geladen werden"),
        el("p", { class: "qhint" }, "Bitte Internetverbindung prüfen und neu laden.")));
    }
  }
}
function setCatalog(data) {
  CATALOG = data;
  MC = data.filter((q) => q.card_type !== "navigation");
  NAV = data.filter((q) => q.card_type === "navigation");
}

/* --------------------------------------------------------- scope filter */
function scopedMC() {
  if (store.scope === "all") return MC;
  return MC.filter((q) => q.license_type === store.scope);
}
function scopedNAV() {
  if (store.scope === "binnen") return [];
  return NAV;
}

/* ------------------------------------------------------- spaced learning */
function weight(q) {
  const st = store.byId[q.external_id];
  if (!st || st.seen === 0) return 12;
  const base = { 1: 8, 2: 5, 3: 3, 4: 2, 5: 0.6 }[st.box] || 3;
  return st.lastCorrect === false ? base * 1.7 : base;
}
function weightedOrder(pool) {
  // Efraimidis-Spirakis: key = rand^(1/weight), absteigend
  return pool
    .map((q) => [Math.pow(Math.random(), 1 / Math.max(weight(q), 0.01)), q])
    .sort((a, b) => b[0] - a[0])
    .map((x) => x[1]);
}

/* ----------------------------------------------------------- mastery agg */
function masteryFor(pool) {
  let seen = 0, mastered = 0, correct = 0, answered = 0;
  for (const q of pool) {
    const st = store.byId[q.external_id];
    if (st && st.seen) { seen += 1; correct += st.c; answered += st.c + st.w; if (st.box >= MASTER_BOX) mastered += 1; }
  }
  return { total: pool.length, seen, mastered, correct, answered };
}

/* =======================================================================
   SESSION ENGINE
   ===================================================================== */
function makeLearnItem(q) {
  if (q.card_type === "navigation") return { q, nav: true };
  const order = shuffle(q.choices.map((_, i) => i));
  return { q, order, correctIdx: order.indexOf(q.correct_index), picked: null, correct: null };
}
function makeExamItem(q) {
  if (q.card_type === "navigation") return { q, nav: true };
  // /api/session liefert bereits gemischte choices + rebasierten correct_index
  return { q, order: q.choices.map((_, i) => i), correctIdx: q.correct_index, picked: null, correct: null };
}

function startLearn(kind) {
  const pool = scopedMC();
  if (!pool.length) { toast("Keine Fragen im gewählten Bereich"); return; }
  let chosen;
  if (kind === "all") {
    chosen = weightedOrder(pool);
  } else if (kind === "wrong") {
    const wrong = pool.filter((q) => { const s = store.byId[q.external_id]; return s && s.seen && s.box <= 2; });
    if (!wrong.length) { toast("Keine schwierigen Fragen – stark! 💪"); return; }
    chosen = weightedOrder(wrong);
  } else {
    const n = Math.min(kind, pool.length);
    chosen = weightedOrder(pool).slice(0, n);
  }
  session = { mode: "learn", items: chosen.map(makeLearnItem), idx: 0, deadline: null, rules: null };
  renderQuiz();
}

function startNav() {
  const pool = scopedNAV();
  if (!pool.length) { toast("Navigationsaufgaben gibt es nur für den Schein See"); return; }
  session = { mode: "nav", items: pool.map((q) => ({ q, nav: true })), idx: 0, deadline: null, rules: null };
  renderQuiz();
}

async function startExam() {
  const lic = store.scope === "binnen" ? "binnen" : "see";
  // Online: amtliche Zusammenstellung vom Server. Offline: client-seitig bauen.
  if (!window.__CATALOG__) {
    try {
      const res = await fetch(`api/session?mode=exam&license_type=${lic}`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      session = {
        mode: "exam",
        items: data.questions.map(makeExamItem),
        idx: 0,
        rules: data.passing_rules || {},
        deadline: data.time_limit_seconds ? Date.now() + data.time_limit_seconds * 1000 : null,
      };
      renderQuiz();
      return;
    } catch (e) { /* fällt auf lokalen Aufbau zurück */ }
  }
  startExamLocal(lic);
}

function pickRandom(pool, n) { return shuffle(pool).slice(0, n); }

function startExamLocal(lic) {
  const byCat = (c) => MC.filter((q) => q.license_type === lic && q.category === c);
  let items = [], rules, secs;
  if (lic === "binnen") {
    items = pickRandom(byCat("Basisfragen"), 7).concat(pickRandom(byCat("Spezifische Fragen Binnen"), 23));
    rules = { question_count: 30, required_total: 24, required_basis: 5, required_specific: 18 };
    secs = 45 * 60;
  } else {
    const nav = NAV.filter((q) => q.license_type === "see");
    items = pickRandom(byCat("Basisfragen"), 7).concat(pickRandom(byCat("Spezifische Fragen See"), 23));
    rules = { question_count: 30, required_total: 24, required_basis: 5, required_specific: 18 };
    secs = 60 * 60;
    if (nav.length) items = pickRandom(nav, 1).concat(items);
  }
  if (items.filter((q) => q.card_type !== "navigation").length < 30) { toast("Nicht genügend Fragen offline verfügbar"); return; }
  session = { mode: "exam", items: items.map(makeLearnItem), idx: 0, rules, deadline: Date.now() + secs * 1000 };
  renderQuiz();
}

/* =======================================================================
   HOME / DASHBOARD
   ===================================================================== */
function ring(percent, label, sub) {
  const r = 56, c = 2 * Math.PI * r, off = c * (1 - percent / 100);
  const svg = `
    <svg class="ring" viewBox="0 0 132 132" role="img" aria-label="${label} ${percent}%">
      <circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--line)" stroke-width="12"/>
      <circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--sea)" stroke-width="12"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"
        transform="rotate(-90 66 66)"/>
      <text x="66" y="62" text-anchor="middle" font-size="26" font-weight="700" fill="var(--ink)">${percent}%</text>
      <text x="66" y="84" text-anchor="middle" font-size="11" fill="var(--muted)">${sub}</text>
    </svg>`;
  return el("div", { html: svg });
}

function scopeSegmented() {
  const seg = el("div", { class: "segmented", role: "group", "aria-label": "Schein wählen" });
  [["all", "Binnen + See"], ["see", "See"], ["binnen", "Binnen"]].forEach(([val, lbl]) => {
    seg.appendChild(el("button", {
      "aria-pressed": String(store.scope === val),
      onclick: () => { store.scope = val; saveStore(); renderHome(); },
    }, lbl));
  });
  return seg;
}

function renderHome() {
  session = null;
  stopTimer();
  TOPACTIONS.innerHTML = "";
  const pool = scopedMC();
  const m = masteryFor(pool);
  const navPool = scopedNAV();
  const masterPct = m.total ? Math.round((m.mastered / m.total) * 100) : 0;
  const acc = m.answered ? Math.round((m.correct / m.answered) * 100) : 0;

  const view = el("div", { class: "view" });

  // hero
  view.appendChild(el("section", { class: "hero" },
    el("p", { class: "eyebrow" }, "Sportbootführerschein · See & Binnen"),
    el("h1", {}, "Verstehen statt nur ankreuzen."),
    el("p", {}, "Lerne mit den amtlichen ELWIS-Fragen, im eigenen Tempo. Falsch beantwortete Fragen kommen automatisch häufiger – dein Fortschritt bleibt auf diesem Gerät gespeichert."),
  ));

  view.appendChild(el("div", { style: "margin:4px 0 18px" }, scopeSegmented()));

  // overview
  view.appendChild(el("section", { class: "overview" },
    ring(masterPct, "Gemeistert", "gemeistert"),
    el("div", { class: "meta" },
      el("h3", {}, m.seen ? `${m.mastered} von ${m.total} Fragen gemeistert` : "Bereit, loszulegen?"),
      el("p", {}, m.seen
        ? `Du hast ${m.seen} Fragen geübt · Trefferquote ${acc}%.`
        : "Starte eine Lernrunde – dein Fortschritt wird automatisch gespeichert."),
    ),
  ));

  // stat tiles
  view.appendChild(el("div", { class: "tiles" },
    tile(m.seen, "Fragen geübt"),
    tile(acc + "%", "Trefferquote"),
    tile(m.mastered, "Gemeistert"),
    tile("🔥 " + store.streak, "Serie", `Bestwert ${store.best}`),
  ));

  // modes
  view.appendChild(el("p", { class: "section-label" }, "Training starten"));
  const grid = el("div", { class: "modegrid" });
  grid.appendChild(modecard("📚", "Weiterlernen", "Clevere Auswahl: neue & schwierige Fragen zuerst.", () => startLearn(20), "feature"));
  grid.appendChild(modecard("🗂️", "Alle Fragen", `Kompletter Durchlauf (${pool.length} Fragen).`, () => startLearn("all")));
  grid.appendChild(modecard("🎯", "Nur Schwächen", "Wiederhole gezielt deine Fehler.", () => startLearn("wrong")));
  grid.appendChild(modecard("⏱️", "Prüfung simulieren", "Amtlicher Bogen mit Zeitlimit.", startExam));
  if (navPool.length) grid.appendChild(modecard("🧭", "Navigationsaufgaben", `${navPool.length} amtliche Kartenaufgaben mit Lösungen.`, startNav));
  view.appendChild(grid);

  // quick session sizes
  view.appendChild(el("p", { class: "section-label" }, "Schnelle Lernrunde"));
  const chips = el("div", { class: "chips" });
  [10, 25, 50].forEach((n) => chips.appendChild(el("button", { class: "chip", onclick: () => startLearn(n) }, `${n} Fragen`)));
  view.appendChild(chips);

  // category mastery
  if (m.seen) {
    view.appendChild(el("p", { class: "section-label" }, "Fortschritt nach Themen"));
    const cats = {};
    for (const q of pool) {
      const c = q.category; (cats[c] = cats[c] || { total: 0, mastered: 0 });
      cats[c].total += 1;
      const s = store.byId[q.external_id];
      if (s && s.box >= MASTER_BOX) cats[c].mastered += 1;
    }
    const list = el("div", { class: "catlist" });
    Object.keys(cats).sort((a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b)).forEach((c) => {
      const { total, mastered } = cats[c];
      const pct = total ? Math.round((mastered / total) * 100) : 0;
      list.appendChild(el("div", { class: "catrow" },
        el("div", { class: "top" }, el("span", {}, c), el("span", {}, `${mastered}/${total}`)),
        el("div", { class: "bar" }, el("i", { style: `width:${pct}%` })),
      ));
    });
    view.appendChild(list);
    view.appendChild(el("div", { style: "margin-top:20px" },
      el("button", { class: "btn btn-ghost", onclick: resetProgress }, "Fortschritt zurücksetzen")));
  }

  APP.innerHTML = ""; APP.appendChild(view);
  window.scrollTo(0, 0);
}
function tile(val, lbl, sub) {
  return el("div", { class: "tile" },
    el("div", { class: "val", html: typeof val === "string" ? val : String(val) }),
    el("div", { class: "lbl" }, lbl + (sub ? "" : "")),
    sub ? el("div", { class: "lbl" }, sub) : null);
}
function modecard(ic, t, d, onclick, extra = "") {
  return el("button", { class: "modecard " + extra, onclick },
    el("div", { class: "ic" }, ic),
    el("div", { class: "t" }, t),
    el("div", { class: "d" }, d));
}
function resetProgress() {
  if (!confirm("Gesamten Lernfortschritt auf diesem Gerät wirklich löschen?")) return;
  store = defaultStore(); saveStore(); toast("Fortschritt zurückgesetzt"); renderHome();
}

/* =======================================================================
   QUIZ
   ===================================================================== */
function renderQuiz() {
  const it = session.items[session.idx];
  if (!it) { renderResult(); return; }

  TOPACTIONS.innerHTML = "";
  const view = el("div", { class: "view narrow-content" });

  // top bar: back + progress + counter/timer
  const pct = (session.idx / session.items.length) * 100;
  const top = el("div", { class: "qtop" },
    el("button", { class: "btn btn-ghost btn-back", onclick: confirmExit, "aria-label": "Beenden" }, "✕"),
    el("div", { class: "progress-track" }, el("i", { style: `width:${pct}%` })),
  );
  if (session.deadline) {
    const tm = el("span", { class: "qtimer", id: "timer" }, "—:—");
    top.appendChild(tm);
  } else {
    top.appendChild(el("span", { class: "qcount" }, `${session.idx + 1} / ${session.items.length}`));
  }
  view.appendChild(top);

  // card
  const q = it.q;
  const card = el("div", { class: "qcard" });
  const licLabel = q.license_type ? q.license_type.toUpperCase() : "";
  card.appendChild(el("div", { class: "qcat" },
    el("span", {}, `${licLabel} · ${q.category}`),
    el("span", {}, session.mode === "exam" ? "Prüfung" : (session.mode === "nav" ? "Lernkarte" : "Lernmodus")),
  ));
  card.appendChild(el("h2", { class: "qprompt" }, q.prompt));

  if (q.image_url) {
    const fig = el("figure", { class: "question-media" });
    const img = el("img", { alt: q.image_alt || "" });
    img.onload = () => { if (img.naturalWidth / img.naturalHeight >= 3.2) fig.classList.add("media-symbol"); };
    img.src = q.image_url.replace(/^\/assets\//, "assets/");
    fig.appendChild(img); card.appendChild(fig);
  }

  if (it.nav) {
    card.appendChild(renderNavCard(q));
    card.appendChild(quizFooter(it, true));
  } else {
    const choices = el("div", { class: "choices" });
    it.order.forEach((origIdx, displayIdx) => {
      const b = el("button", { class: "choice", onclick: () => answer(it, displayIdx) },
        el("span", { class: "badge" }, String.fromCharCode(65 + displayIdx)),
        el("span", {}, q.choices[origIdx]));
      choices.appendChild(b);
    });
    card.appendChild(choices);
    card.appendChild(el("div", { class: "feedback hidden", id: "feedback" }));
    card.appendChild(quizFooter(it, false));
  }
  view.appendChild(card);

  APP.innerHTML = ""; APP.appendChild(view);
  window.scrollTo(0, 0);

  if (it.picked != null) restoreAnswered(it);
  if (session.deadline) startTimer();
}

function quizFooter(it, isNav) {
  const foot = el("div", { class: "qfoot" });
  const hint = el("div", { class: "qhint", html: isNav
    ? 'Wähle <kbd>→</kbd> für die nächste Aufgabe'
    : 'Tasten <kbd>1</kbd>–<kbd>4</kbd> antworten · <kbd>↵</kbd> weiter' });
  foot.appendChild(hint);
  const last = session.idx === session.items.length - 1;
  const next = el("button", { class: "btn btn-primary", id: "nextBtn", onclick: nextItem },
    last ? "Abschließen" : "Weiter");
  if (!isNav && it.picked == null) next.disabled = true;
  foot.appendChild(next);
  return foot;
}

function answer(it, displayIdx) {
  if (it.picked != null) return;
  it.picked = displayIdx;
  it.correct = displayIdx === it.correctIdx;
  if (session.mode !== "nav") recordAnswer(it.q.external_id, it.correct);
  paintAnswer(it);
  const nb = $("#nextBtn"); if (nb) { nb.disabled = false; nb.focus(); }
  if (session.mode === "exam") { setTimeout(nextItem, 220); }
}

function paintAnswer(it) {
  const btns = APP.querySelectorAll(".choice");
  btns.forEach((b, i) => {
    b.disabled = true;
    if (session.mode === "exam") { if (i === it.picked) b.classList.add("chosen"); return; }
    if (i === it.correctIdx) b.classList.add("correct");
    if (i === it.picked && !it.correct) b.classList.add("wrong");
  });
  if (session.mode !== "exam") {
    const fb = $("#feedback");
    if (fb) {
      fb.className = "feedback " + (it.correct ? "ok" : "no");
      fb.innerHTML = `<span class="verdict">${it.correct ? "✓ Richtig" : "✗ Leider falsch"}</span>${esc(it.q.explanation || "")}`;
    }
  }
}
function restoreAnswered(it) {
  if (it.nav || it.picked == null) return;
  paintAnswer(it);
  const nb = $("#nextBtn"); if (nb) nb.disabled = false;
}

function nextItem() {
  if (session.items[session.idx] && !session.items[session.idx].nav
      && session.items[session.idx].picked == null && session.mode !== "nav") {
    // im Lernmodus nicht ohne Antwort weiter
    if (session.mode === "learn") { toast("Bitte zuerst antworten"); return; }
  }
  session.idx += 1;
  if (session.idx >= session.items.length) renderResult();
  else renderQuiz();
}

function confirmExit() {
  const answered = session.items.some((it) => it.picked != null);
  if (session.mode === "exam" && answered && !confirm("Prüfung wirklich abbrechen?")) return;
  renderHome();
}

/* nav study card (Navigationsaufgaben) */
const CHART_SECTIONS = [
  "1: N53°46,06' E007°43,12' – N54°00,42' E008°00,00'",
  "2: N53°50,48' E007°57,54' – N54°05,24' E008°14,48'",
  "3: N53°53,36' E007°51,12' – N54°13,80' E008°15,00'",
  "4: N53°46,00' E007°49,00' – N54°06,00' E008°13,00'",
  "5: N53°43,00' E007°24,00' – N53°57,00' E007°55,00'",
  "6: N53°48,20' E007°24,00' – N54°08,54' E007°48,00'",
  "7: N53°54,24' E008°15,24' – N54°09,00' E008°32,12'",
  "8: N53°50,00' E008°04,00' – N54°01,00' E008°32,00'",
];
function renderNavCard(q) {
  const box = el("div", { class: "choices nav-card" });
  box.appendChild(el("p", { class: "nav-scenario" }, q.scenario || ""));
  const tasks = el("div", { class: "nav-tasks" });
  (q.subtasks || []).forEach((sub) => {
    const a = el("div", { class: "nav-a hidden" }, sub.answer);
    const btn = el("button", { class: "btn btn-ghost nav-reveal", onclick: () => {
      const hid = a.classList.toggle("hidden");
      btn.textContent = hid ? "Lösung anzeigen" : "Lösung verbergen";
    } }, "Lösung anzeigen");
    tasks.appendChild(el("div", { class: "nav-task" },
      el("div", { class: "nav-q", html: `<strong>${sub.n}.</strong> ${esc(sub.question)}` }), btn, a));
  });
  box.appendChild(tasks);
  const det = el("details", { class: "nav-chart" }, el("summary", {}, "Kartenausschnitte der amtlichen Übungskarte D49"));
  const ul = el("ul"); CHART_SECTIONS.forEach((s) => ul.appendChild(el("li", {}, s))); det.appendChild(ul);
  box.appendChild(det);
  box.appendChild(el("p", { class: "nav-note" }, q.explanation || ""));
  return box;
}

/* ----------------------------------------------------------------- timer */
function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    const t = $("#timer"); if (!t || !session || !session.deadline) return;
    const rem = Math.max(0, Math.round((session.deadline - Date.now()) / 1000));
    t.textContent = fmtTime(rem);
    t.classList.toggle("warn", rem <= 300);
    if (rem <= 0) { stopTimer(); toast("Zeit abgelaufen"); renderResult(); }
  }, 500);
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

/* =======================================================================
   RESULT
   ===================================================================== */
function renderResult() {
  stopTimer();
  TOPACTIONS.innerHTML = "";
  const mcItems = session.items.filter((it) => !it.nav && it.picked != null);
  const correct = mcItems.filter((it) => it.correct).length;
  const total = mcItems.length;
  const acc = total ? Math.round((correct / total) * 100) : 0;

  const view = el("div", { class: "view" });

  if (session.mode === "nav") {
    view.appendChild(el("div", { class: "result-card" },
      el("div", { class: "result-badge" }, "🧭"),
      el("h2", {}, "Navigationsaufgaben durchgearbeitet"),
      el("p", { class: "qhint" }, "Übe diese Aufgaben mit der amtlichen Übungskarte D49."),
      el("div", { class: "result-actions" },
        el("button", { class: "btn btn-primary", onclick: startNav }, "Nochmal"),
        el("button", { class: "btn btn-ghost", onclick: renderHome }, "Zur Übersicht"))));
    APP.innerHTML = ""; APP.appendChild(view); window.scrollTo(0, 0); return;
  }

  let badge = "🎉", title = "Lernrunde geschafft!";
  if (session.mode === "exam") {
    const r = session.rules || {};
    const basis = mcItems.filter((it) => it.q.category === "Basisfragen");
    const spec = mcItems.filter((it) => it.q.category !== "Basisfragen");
    const bc = basis.filter((it) => it.correct).length;
    const sc = spec.filter((it) => it.correct).length;
    const passed = correct >= (r.required_total || 0)
      && bc >= (r.required_basis || 0) && sc >= (r.required_specific || 0);
    badge = passed ? "✅" : "❌";
    title = passed ? "Bestanden!" : "Noch nicht bestanden";
    view.appendChild(el("div", { class: "result-card" },
      el("div", { class: "result-badge" }, badge),
      el("h2", {}, title),
      el("div", { class: "result-score", html: `${correct}<small> / ${total} richtig</small>` }),
      el("div", { class: "result-stats" },
        tile(`${bc}/${basis.length}`, "Basisfragen"),
        tile(`${sc}/${spec.length}`, "Spezifisch"),
        tile(acc + "%", "Trefferquote")),
      el("p", { class: "qhint" }, `Bestehensgrenze: mind. ${r.required_total || 0} von ${total} richtig${session.items.some((it)=>it.nav) ? " · Navigationsaufgabe separat bewerten" : ""}.`),
      resultActions()));
  } else {
    if (acc < 60) { badge = "💪"; title = "Weiter üben!"; }
    else if (acc < 85) { badge = "👍"; title = "Gut gemacht!"; }
    view.appendChild(el("div", { class: "result-card" },
      el("div", { class: "result-badge" }, badge),
      el("h2", {}, title),
      el("div", { class: "result-score", html: `${correct}<small> / ${total} richtig</small>` }),
      el("div", { class: "result-stats" },
        tile(acc + "%", "Trefferquote"),
        tile("🔥 " + store.streak, "Serie"),
        tile(total - correct, "Zu wiederholen")),
      resultActions()));
  }

  // review wrong
  const wrong = mcItems.filter((it) => !it.correct);
  if (wrong.length) {
    const rev = el("div", { class: "review" }, el("h3", {}, `Zum Nachlesen (${wrong.length})`));
    wrong.slice(0, 30).forEach((it) => {
      rev.appendChild(el("div", { class: "review-item" },
        el("div", { class: "q" }, it.q.prompt),
        el("div", { class: "a" }, "Richtig: " + it.q.choices[it.q.correct_index]),
        el("div", { class: "e" }, it.q.explanation || "")));
    });
    view.appendChild(rev);
  }

  APP.innerHTML = ""; APP.appendChild(view); window.scrollTo(0, 0);
}
function resultActions() {
  const wrap = el("div", { class: "result-actions" });
  if (session.mode === "exam") {
    wrap.appendChild(el("button", { class: "btn btn-primary", onclick: startExam }, "Neue Prüfung"));
  } else {
    const wrong = session.items.filter((it) => !it.nav && it.correct === false);
    if (wrong.length) wrap.appendChild(el("button", { class: "btn btn-primary", onclick: () => {
      session = { mode: "learn", items: wrong.map((it) => makeLearnItem(it.q)), idx: 0, deadline: null, rules: null };
      renderQuiz();
    } }, `Fehler wiederholen (${wrong.length})`));
    wrap.appendChild(el("button", { class: "btn btn-sea", onclick: () => startLearn(20) }, "Weiterlernen"));
  }
  wrap.appendChild(el("button", { class: "btn btn-ghost", onclick: renderHome }, "Zur Übersicht"));
  return wrap;
}

/* =======================================================================
   KEYBOARD
   ===================================================================== */
document.addEventListener("keydown", (e) => {
  if (!session) return;
  const it = session.items[session.idx];
  if (!it) return;
  if (e.key === "Escape") { confirmExit(); return; }
  if ((e.key === "Enter" || e.key === "ArrowRight") ) {
    const nb = $("#nextBtn"); if (nb && !nb.disabled) { e.preventDefault(); nextItem(); }
    return;
  }
  if (!it.nav && it.picked == null) {
    let idx = -1;
    if (/^[1-4]$/.test(e.key)) idx = parseInt(e.key, 10) - 1;
    else if (/^[a-dA-D]$/.test(e.key)) idx = e.key.toLowerCase().charCodeAt(0) - 97;
    if (idx >= 0 && idx < it.order.length) { e.preventDefault(); answer(it, idx); }
  }
});

/* ----------------------------------------------------------------- boot */
document.getElementById("brand").addEventListener("click", () => { if (!session || confirmAllowed()) renderHome(); });
function confirmAllowed() {
  if (session && session.mode === "exam" && session.items.some((it) => it.picked != null)) {
    return confirm("Prüfung verlassen?");
  }
  return true;
}

// Service Worker registrieren (nur online/Website; in der gebündelten App via file:// nicht nötig)
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

(async function boot() {
  APP.appendChild(el("div", { class: "qcard" }, el("p", { class: "qhint" }, "Lade Fragenkatalog …")));
  await loadCatalog();
  if (CATALOG.length) renderHome();
})();
