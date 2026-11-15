const DICE = [
  { id: "d4", sides: 4 },
  { id: "d6", sides: 6 },
  { id: "d8", sides: 8 },
  { id: "d10", sides: 10 },
  { id: "d12", sides: 12 },
  { id: "d20", sides: 20 },
  { id: "d100", sides: 100 },
];

const glyphs = {
  d4: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8 L54 50 H10 Z" fill="#24262e" stroke="#e4c56a" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
  d6: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="12" width="40" height="40" rx="6" fill="#24262e" stroke="#e4c56a" stroke-width="2.2"/></svg>`,
  d8: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6 L56 32 L32 58 L8 32 Z" fill="#24262e" stroke="#e4c56a" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
  d10: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6 L54 24 L46 54 H18 L10 24 Z" fill="#24262e" stroke="#e4c56a" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
  d12: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 L50 14 L58 32 L50 50 L32 59 L14 50 L6 32 L14 14 Z" fill="#24262e" stroke="#e4c56a" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
  d20: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 L54 18 L58 40 L44 57 H20 L6 40 L10 18 Z" fill="#24262e" stroke="#e4c56a" stroke-width="2.2" stroke-linejoin="round"/><path d="M32 5 L32 32 L6 40 M32 32 L58 40 M32 32 L20 57 M32 32 L44 57" fill="none" stroke="#e4c56a" stroke-width="1.2" opacity="0.7"/></svg>`,
  d100: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="#24262e" stroke="#e4c56a" stroke-width="2.2"/><text x="32" y="37" text-anchor="middle" font-size="14" font-family="Segoe UI, sans-serif" fill="#f6f4ef">%</text></svg>`,
};

const selector = document.getElementById("selector");
const dieSpin = document.getElementById("dieSpin");
const dieGlyph = document.getElementById("dieGlyph");
const dieFace = document.getElementById("dieFace");
const formula = document.getElementById("formula");
const resultEl = document.getElementById("result");
const callout = document.getElementById("callout");
const rollBtn = document.getElementById("roll");
const historyEl = document.getElementById("history");

let selected = DICE.find((d) => d.id === "d20");
let rolling = false;
const history = [];

function renderSelector() {
  selector.replaceChildren();
  for (const die of DICE) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "die-btn";
    button.dataset.id = die.id;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", die.id === selected.id ? "true" : "false");
    button.innerHTML = `${glyphs[die.id]}<span>${die.id}</span>`;
    button.addEventListener("click", () => choose(die.id));
    selector.appendChild(button);
  }
}

function choose(id) {
  if (rolling) return;
  selected = DICE.find((d) => d.id === id);
  formula.textContent = `1${selected.id}`;
  dieGlyph.innerHTML = glyphs[selected.id];
  dieFace.textContent = "";
  renderSelector();
}

function setCallout(value, sides) {
  callout.className = "callout";
  if (sides === 20 && value === 20) {
    callout.textContent = "Natural 20";
    callout.classList.add("crit");
  } else if (sides === 20 && value === 1) {
    callout.textContent = "Natural 1";
    callout.classList.add("fail");
  } else if (value === sides) {
    callout.textContent = "Maximum";
  } else if (value === 1) {
    callout.textContent = "Minimum";
  } else {
    callout.textContent = "";
  }
}

function renderHistory() {
  historyEl.replaceChildren();
  if (history.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No rolls yet";
    historyEl.appendChild(empty);
    return;
  }
  for (const item of history) {
    const li = document.createElement("li");
    li.innerHTML = `${item.id}<b>${item.value}</b>`;
    historyEl.appendChild(li);
  }
}

function pushHistory(die, value) {
  history.unshift({ id: die.id, value });
  if (history.length > 8) history.pop();
  renderHistory();
}

function roll() {
  if (rolling) return;
  rolling = true;
  rollBtn.disabled = true;
  const sides = selected.sides;
  const finalValue = 1 + Math.floor(Math.random() * sides);
  const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 950;

  dieSpin.classList.remove("landed", "tumbling");
  void dieSpin.offsetWidth;
  if (duration > 0) dieSpin.classList.add("tumbling");
  resultEl.classList.add("rolling");
  callout.textContent = "";
  callout.className = "callout";

  const started = performance.now();
  function frame(now) {
    const elapsed = now - started;
    if (elapsed < duration) {
      const flicker = 1 + Math.floor(Math.random() * sides);
      dieFace.textContent = flicker;
      resultEl.textContent = flicker;
      requestAnimationFrame(frame);
      return;
    }
    dieFace.textContent = finalValue;
    resultEl.textContent = finalValue;
    resultEl.classList.remove("rolling");
    dieSpin.classList.remove("tumbling");
    if (duration > 0) {
      dieSpin.classList.add("landed");
    }
    setCallout(finalValue, sides);
    pushHistory(selected, finalValue);
    rolling = false;
    rollBtn.disabled = false;
  }
  requestAnimationFrame(frame);
}

rollBtn.addEventListener("click", roll);

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    roll();
    return;
  }
  const index = Number(event.key) - 1;
  if (index >= 0 && index < DICE.length && event.key !== " ") choose(DICE[index].id);
});

choose("d20");
resultEl.textContent = "—";
renderHistory();
