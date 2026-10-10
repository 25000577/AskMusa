
const VarsityHub = (() => {
  const DEFAULT_ROWS = [
    "Home Language", "First Additional Language", "Mathematics",
    "Life Orientation", "Elective subject 5", "Elective subject 6"
  ];

  const els = {};

  function cacheEls() {
    els.apsGrid = document.getElementById("apsGrid");
    els.apsTotal = document.getElementById("apsTotal");
    els.dateList = document.getElementById("dateList");
    els.checklist = document.getElementById("checklist");
    els.checklistProgress = document.getElementById("checklistProgress");
  }

  function levelFromPercent(pct) {
    if (pct >= 80) return 7;
    if (pct >= 70) return 6;
    if (pct >= 60) return 5;
    if (pct >= 50) return 4;
    if (pct >= 40) return 3;
    if (pct >= 30) return 2;
    return 1;
  }

  function renderAps() {
    els.apsGrid.innerHTML = `
      <div class="aps-row" style="color: var(--chalk-faint); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.05em;">
        <span>Subject</span><span style="text-align:center;">Mark %</span><span style="text-align:center;">Level</span>
      </div>
      ${DEFAULT_ROWS.map((name, i) => `
        <div class="aps-row" data-row="${i}">
          <input type="text" value="${name}" aria-label="Subject ${i + 1} name" data-field="name">
          <input type="number" min="0" max="100" placeholder="0" aria-label="Subject ${i + 1} mark" data-field="pct">
          <span class="aps-row__level" data-field="level">—</span>
        </div>
      `).join("")}
    `;

    els.apsGrid.addEventListener("input", recalcTotal);
  }

  function recalcTotal() {
    let total = 0;
    els.apsGrid.querySelectorAll("[data-row]").forEach(row => {
      const pctInput = row.querySelector('[data-field="pct"]');
      const levelEl = row.querySelector('[data-field="level"]');
      const pct = Number(pctInput.value);

      if (pctInput.value === "" || Number.isNaN(pct)) {
        levelEl.textContent = "—";
        return;
      }
      const clamped = Math.max(0, Math.min(100, pct));
      const level = levelFromPercent(clamped);
      levelEl.textContent = `L${level}`;
      total += level;
    });
    els.apsTotal.textContent = total;
  }

  function renderDates() {
    els.dateList.innerHTML = KEY_DATES.map(d => `
      <li class="date-item">
        <span class="date-item__when">${d.when}</span>
        <span class="date-item__what">${d.what}</span>
      </li>
    `).join("");
  }

  function renderChecklist() {
    els.checklist.innerHTML = CHECKLIST_ITEMS.map((item, i) => `
      <li class="checklist-item" data-i="${i}">
        <input type="checkbox" id="chk-${i}">
        <label for="chk-${i}">${item}</label>
      </li>
    `).join("");

    els.checklist.querySelectorAll(".checklist-item").forEach(li => {
      const checkbox = li.querySelector("input");
      checkbox.addEventListener("change", () => {
        li.classList.toggle("checklist-item--done", checkbox.checked);
        updateChecklistProgress();
      });
    });

    updateChecklistProgress();
  }

  function updateChecklistProgress() {
    const total = els.checklist.querySelectorAll(".checklist-item").length;
    const done = els.checklist.querySelectorAll(".checklist-item--done").length;
    els.checklistProgress.textContent = `${done} / ${total} done`;
  }

  function init() {
    cacheEls();
    renderAps();
    renderDates();
    renderChecklist();
  }

  return { init };
})();
