/* =========================================================
   MatricLab — app shell
   Handles navigation, the dashboard, and the in-memory
   progress store shared by the Quiz Room.
   ========================================================= */

const AppState = (() => {
  const results = [];

  function recordResult(subjectId, paper, pct) {
    results.push({ subjectId, paper, pct, date: new Date() });
    Dashboard.refresh();
  }

  return { results, recordResult };
})();

/* ---------------------------------------------------------
   Navigation
   --------------------------------------------------------- */
function switchView(viewId) {
  document.querySelectorAll(".view").forEach(section => {
    section.hidden = section.dataset.view !== viewId;
  });
  document.querySelectorAll(".nav__link").forEach(link => {
    if (link.dataset.nav === viewId) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
  document.getElementById("primaryNav").classList.remove("is-open");
  document.getElementById("navToggle").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initNavigation() {
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-nav]");
    if (!trigger) return;
    e.preventDefault();
    switchView(trigger.dataset.nav);
  });

  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("primaryNav");
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

/* ---------------------------------------------------------
   Matric Clock — countdown ring on the dashboard hero
   --------------------------------------------------------- */
function initMatricClock() {
  const RING_CIRCUMFERENCE = 540; // matches stroke-dasharray in CSS

  function render() {
    const now = new Date();
    const msRemaining = EXAM_TARGET_DATE - now;
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / 86400000));

    const yearStart = new Date(EXAM_TARGET_DATE.getFullYear(), 0, 1);
    const totalSpan = EXAM_TARGET_DATE - yearStart;
    const elapsed = Math.min(totalSpan, Math.max(0, now - yearStart));
    const fraction = totalSpan > 0 ? elapsed / totalSpan : 0;

    document.getElementById("clockDays").textContent = msRemaining <= 0 ? "0" : daysRemaining;
    document.getElementById("clockProgress").style.strokeDashoffset =
      RING_CIRCUMFERENCE * (1 - fraction);
    document.getElementById("clockDate").textContent = EXAM_TARGET_DATE.toLocaleDateString("en-ZA", {
      day: "numeric", month: "short", year: "numeric"
    });

    if (msRemaining <= 0) {
      document.querySelector(".clock-readout__label").textContent = "Paper 1 has started — good luck";
    }
  }

  render();
  setInterval(render, 1000 * 60 * 30); // refresh every 30 min, no need for anything faster
}

/* ---------------------------------------------------------
   Dashboard
   --------------------------------------------------------- */
const Dashboard = (() => {
  function renderSubjects() {
    document.getElementById("dashboardSubjects").innerHTML = SUBJECTS.map(s => `
      <button class="subject-card" data-subject="${s.id}">
        <span class="subject-card__icon icon--${s.color}">${s.icon}</span>
        <span class="subject-card__name">${s.name}</span>
        <span class="subject-card__meta">${s.blurb}</span>
      </button>
    `).join("");

    document.getElementById("dashboardSubjects").querySelectorAll("[data-subject]").forEach(btn => {
      btn.addEventListener("click", () => {
        switchView("quiz");
        QuizRoom.goToSubject(btn.dataset.subject);
      });
    });
  }

  function renderStats() {
    const results = AppState.results;
    document.getElementById("statQuizzes").textContent = results.length;

    if (results.length === 0) {
      document.getElementById("statAvg").textContent = "—";
      document.getElementById("statStreak").textContent = "0";
      document.getElementById("statSubject").textContent = "—";
      return;
    }

    const avg = Math.round(results.reduce((sum, r) => sum + r.pct, 0) / results.length);
    document.getElementById("statAvg").textContent = `${avg}%`;

    const uniqueDays = new Set(results.map(r => r.date.toDateString())).size;
    document.getElementById("statStreak").textContent = uniqueDays;

    const bySubject = {};
    results.forEach(r => {
      bySubject[r.subjectId] = bySubject[r.subjectId] || [];
      bySubject[r.subjectId].push(r.pct);
    });
    let bestSubjectId = null, bestAvg = -1;
    Object.entries(bySubject).forEach(([id, pcts]) => {
      const a = pcts.reduce((s, v) => s + v, 0) / pcts.length;
      if (a > bestAvg) { bestAvg = a; bestSubjectId = id; }
    });
    const bestSubject = SUBJECTS.find(s => s.id === bestSubjectId);
    document.getElementById("statSubject").textContent = bestSubject ? bestSubject.name : "—";
  }

  function renderRecent() {
    const list = document.getElementById("recentResults");
    const recent = [...AppState.results].reverse().slice(0, 5);

    if (recent.length === 0) {
      list.innerHTML = `<li class="result-list__empty">Nothing marked yet — write a paper to see it here.</li>`;
      return;
    }

    list.innerHTML = recent.map(r => {
      const subject = SUBJECTS.find(s => s.id === r.subjectId);
      return `
        <li class="result-item">
          <span>${subject ? subject.name : r.subjectId} — ${r.paper}</span>
          <span class="result-item__score">${r.pct}%</span>
        </li>`;
    }).join("");
  }

  function refresh() {
    renderStats();
    renderRecent();
  }

  function init() {
    renderSubjects();
    refresh();
  }

  return { init, refresh };
})();

/* ---------------------------------------------------------
   Boot
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initMatricClock();
  Dashboard.init();
  Tutor.init();
  QuizRoom.init();
  VarsityHub.init();
});
