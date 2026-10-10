/* =========================================================
   MatricLab — Quiz Room engine
   ========================================================= */

const QuizRoom = (() => {
  let state = {
    subjectId: null,
    paperIndex: 0,
    questionIndex: 0,
    selected: null,
    correctCount: 0,
    total: 0
  };

  const els = {};

  function cacheEls() {
    els.picker = document.getElementById("quizPicker");
    els.subjectsGrid = document.getElementById("quizSubjects");
    els.runner = document.getElementById("quizRunner");
    els.results = document.getElementById("quizResults");
    els.tag = document.getElementById("quizTag");
    els.count = document.getElementById("quizCount");
    els.progressBar = document.getElementById("quizProgressBar");
    els.card = document.getElementById("quizCard");
    els.next = document.getElementById("quizNext");
    els.quit = document.getElementById("quizQuit");
  }

  // Must match FREE_UNLOCKED_SUBJECTS in backend/config.js
  const FREE_UNLOCKED_SUBJECTS = ["mathematics"];

  function isLocked(subjectId) {
    return !Auth.isPlus() && !FREE_UNLOCKED_SUBJECTS.includes(subjectId);
  }

  function renderSubjectPicker() {
    els.subjectsGrid.innerHTML = SUBJECTS.map(s => {
      const papers = QUIZ_BANK[s.id] || [];
      const locked = isLocked(s.id);
      return `
        <button class="subject-card ${locked ? "subject-card--locked" : ""}" data-subject="${s.id}">
          <span class="subject-card__icon icon--${s.color}">${s.icon}</span>
          <span class="subject-card__name">${s.name}${locked ? ' <span class="lock-badge">Plus</span>' : ""}</span>
          <span class="subject-card__meta">${papers.length} paper${papers.length === 1 ? "" : "s"} available</span>
        </button>`;
    }).join("");

    els.subjectsGrid.querySelectorAll("[data-subject]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (isLocked(btn.dataset.subject)) {
          Auth.showUpgrade(
            "This subject is part of MatricLab Plus. Upgrade to unlock every subject and past paper.",
            "Unlock every subject"
          );
          return;
        }
        renderPaperPicker(btn.dataset.subject);
      });
    });
  }

  function renderPaperPicker(subjectId) {
    if (isLocked(subjectId)) {
      Auth.showUpgrade(
        "This subject is part of MatricLab Plus. Upgrade to unlock every subject and past paper.",
        "Unlock every subject"
      );
      renderSubjectPicker();
      return;
    }
    const subject = SUBJECTS.find(s => s.id === subjectId);
    const papers = QUIZ_BANK[subjectId] || [];

    els.subjectsGrid.innerHTML = `
      <button class="prompt-chip" id="backToSubjects" style="grid-column: 1 / -1;">← All subjects</button>
      ${papers.map((p, i) => `
        <button class="subject-card" data-paper="${i}">
          <span class="subject-card__icon icon--${subject.color}">${subject.icon}</span>
          <span class="subject-card__name">${p.title}</span>
          <span class="subject-card__meta">${p.questions.length} questions · instant marking</span>
        </button>`).join("")}
    `;

    document.getElementById("backToSubjects").addEventListener("click", renderSubjectPicker);
    els.subjectsGrid.querySelectorAll("[data-paper]").forEach(btn => {
      btn.addEventListener("click", () => start(subjectId, Number(btn.dataset.paper)));
    });
  }

  function start(subjectId, paperIndex) {
    state = { subjectId, paperIndex, questionIndex: 0, selected: null, correctCount: 0,
      total: QUIZ_BANK[subjectId][paperIndex].questions.length };

    els.picker.hidden = true;
    els.results.hidden = true;
    els.runner.hidden = false;

    const subject = SUBJECTS.find(s => s.id === subjectId);
    els.tag.textContent = `${subject.name} · ${QUIZ_BANK[subjectId][paperIndex].title}`;

    renderQuestion();
  }

  function currentPaper() {
    return QUIZ_BANK[state.subjectId][state.paperIndex];
  }

  function renderQuestion() {
    const paper = currentPaper();
    const q = paper.questions[state.questionIndex];
    state.selected = null;

    els.count.textContent = `${state.questionIndex + 1} / ${state.total}`;
    els.progressBar.style.width = `${(state.questionIndex / state.total) * 100}%`;
    els.next.disabled = true;
    els.next.textContent = state.questionIndex === state.total - 1 ? "See results" : "Next question";

    els.card.innerHTML = `
      <p class="quiz-card__question">${q.q}</p>
      <div id="quizOptions">
        ${q.options.map((opt, i) => `
          <button class="quiz-option" data-i="${i}">
            <span class="quiz-option__letter">${String.fromCharCode(65 + i)}</span>
            <span>${opt}</span>
          </button>`).join("")}
      </div>
    `;

    document.querySelectorAll("#quizOptions .quiz-option").forEach(btn => {
      btn.addEventListener("click", () => selectOption(Number(btn.dataset.i), q));
    });
  }

  function selectOption(i, q) {
    if (state.selected !== null) return; // already answered
    state.selected = i;
    const isCorrect = i === q.correct;
    if (isCorrect) state.correctCount += 1;

    document.querySelectorAll("#quizOptions .quiz-option").forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === q.correct) btn.classList.add("quiz-option--correct");
      if (idx === i && !isCorrect) btn.classList.add("quiz-option--wrong");
    });

    const explainEl = document.createElement("div");
    explainEl.className = "quiz-explain";
    explainEl.textContent = q.explain;
    els.card.appendChild(explainEl);

    els.next.disabled = false;
  }

  function next() {
    if (state.questionIndex < state.total - 1) {
      state.questionIndex += 1;
      renderQuestion();
    } else {
      finish();
    }
  }

  function nscLevel(pct) {
    if (pct >= 80) return { level: 7, label: "Outstanding (Level 7)" };
    if (pct >= 70) return { level: 6, label: "Meritorious (Level 6)" };
    if (pct >= 60) return { level: 5, label: "Substantial (Level 5)" };
    if (pct >= 50) return { level: 4, label: "Adequate (Level 4)" };
    if (pct >= 40) return { level: 3, label: "Moderate (Level 3)" };
    if (pct >= 30) return { level: 2, label: "Elementary (Level 2)" };
    return { level: 1, label: "Not yet achieved (Level 1)" };
  }

  function finish() {
    els.progressBar.style.width = "100%";
    els.runner.hidden = true;
    els.results.hidden = false;

    const pct = Math.round((state.correctCount / state.total) * 100);
    const level = nscLevel(pct);
    const subject = SUBJECTS.find(s => s.id === state.subjectId);
    const paperTitle = currentPaper().title;

    els.results.innerHTML = `
      <p class="eyebrow">${subject.name} · ${paperTitle}</p>
      <div class="quiz-results__score">${pct}%</div>
      <p class="quiz-results__level">${state.correctCount} / ${state.total} correct · NSC ${level.label}</p>
      <div class="quiz-results__actions">
        <button class="btn btn--ghost" id="resultRetry">Try this paper again</button>
        <button class="btn btn--primary" id="resultMore">Choose another paper</button>
      </div>
    `;

    document.getElementById("resultRetry").addEventListener("click", () => start(state.subjectId, state.paperIndex));
    document.getElementById("resultMore").addEventListener("click", () => {
      els.results.hidden = true;
      els.picker.hidden = false;
      renderSubjectPicker();
    });

    if (window.AppState) {
      window.AppState.recordResult(state.subjectId, paperTitle, pct, state.correctCount, state.total);
    }
  }

  function exit() {
    els.runner.hidden = true;
    els.results.hidden = true;
    els.picker.hidden = false;
    renderSubjectPicker();
  }

  function goToSubject(subjectId) {
    els.runner.hidden = true;
    els.results.hidden = true;
    els.picker.hidden = false;
    renderPaperPicker(subjectId);
  }

  function init() {
    cacheEls();
    renderSubjectPicker();
    els.next.addEventListener("click", next);
    els.quit.addEventListener("click", exit);
  }

  return { init, renderSubjectPicker, goToSubject };
})();