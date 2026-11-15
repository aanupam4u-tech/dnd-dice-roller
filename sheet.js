const RACES = ["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Tiefling", "Gnome", "Orc"];
const CLASSES = ["Fighter", "Wizard", "Cleric", "Rogue", "Paladin", "Warlock", "Bard", "Druid", "Ranger", "Sorcerer"];
const STARTER_GEAR = [
  ["Head", ""],
  ["Neck", ""],
  ["Cloak", ""],
  ["Hands", ""],
  ["Ring", ""],
  ["Boots", ""],
];

const KEY = "dnd-character-sheet";

const diceView = document.getElementById("diceView");
const sheetView = document.getElementById("sheetView");
const tabDice = document.getElementById("tabDice");
const tabSheet = document.getElementById("tabSheet");

function load() {
  const blank = {
    name: "",
    race: "Elf",
    className: "Wizard",
    domain: "",
    hp: 12,
    hpMax: 12,
    mana: 6,
    manaMax: 6,
    spells: [],
    cantrips: [],
    accessories: STARTER_GEAR.map(([slot, name]) => ({ id: crypto.randomUUID(), slot, name })),
  };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!saved || typeof saved !== "object") return blank;
    const next = { ...blank, ...saved, accessories: saved.accessories?.length ? saved.accessories : blank.accessories };
    next.spells = (next.spells || []).map((spell) => ({
      count: 1,
      sides: 8,
      adder: 0,
      ...spell,
    }));
    return next;
  } catch {
    return blank;
  }
}

const state = load();

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function show(which) {
  const sheet = which === "sheet";
  diceView.hidden = sheet;
  sheetView.hidden = !sheet;
  tabDice.setAttribute("aria-selected", sheet ? "false" : "true");
  tabSheet.setAttribute("aria-selected", sheet ? "true" : "false");
}

tabDice.addEventListener("click", () => show("dice"));
tabSheet.addEventListener("click", () => show("sheet"));

function choiceRow(container, options, current, onPick) {
  container.replaceChildren();
  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option;
    button.setAttribute("aria-pressed", option === current ? "true" : "false");
    button.addEventListener("click", () => onPick(option));
    container.appendChild(button);
  }
}

const nameInput = document.getElementById("charName");
const raceCustom = document.getElementById("raceCustom");
const classCustom = document.getElementById("classCustom");
const domainInput = document.getElementById("domainInput");

function renderIdentity() {
  nameInput.value = state.name;
  choiceRow(document.getElementById("raceChoices"), RACES, state.race, (value) => {
    state.race = value;
    raceCustom.value = "";
    save();
    renderIdentity();
  });
  choiceRow(document.getElementById("classChoices"), CLASSES, state.className, (value) => {
    state.className = value;
    classCustom.value = "";
    save();
    renderIdentity();
  });
  raceCustom.value = RACES.includes(state.race) ? "" : state.race;
  classCustom.value = CLASSES.includes(state.className) ? "" : state.className;
  domainInput.value = state.domain;
}

nameInput.addEventListener("input", () => {
  state.name = nameInput.value;
  save();
});

function bindCustom(input, key) {
  input.addEventListener("input", () => {
    const value = input.value.trim();
    if (!value) return;
    state[key] = value;
    save();
    renderIdentity();
    input.focus();
  });
}

bindCustom(raceCustom, "race");
bindCustom(classCustom, "className");
domainInput.addEventListener("input", () => {
  state.domain = domainInput.value;
  save();
});

function clampPools() {
  state.hpMax = Math.max(1, Number(state.hpMax) || 1);
  state.manaMax = Math.max(1, Number(state.manaMax) || 1);
  state.hp = Math.min(state.hpMax, Math.max(0, Number(state.hp) || 0));
  state.mana = Math.min(state.manaMax, Math.max(0, Number(state.mana) || 0));
}

function renderVitals() {
  clampPools();
  const hpNow = document.getElementById("hpNow");
  const hpMax = document.getElementById("hpMax");
  const manaNow = document.getElementById("manaNow");
  const manaMax = document.getElementById("manaMax");
  hpNow.value = state.hp;
  hpMax.value = state.hpMax;
  manaNow.value = state.mana;
  manaMax.value = state.manaMax;
  document.getElementById("hpBar").style.width = `${(state.hp / state.hpMax) * 100}%`;
  document.getElementById("manaBar").style.width = `${(state.mana / state.manaMax) * 100}%`;
}

document.querySelectorAll(".nudges button").forEach((button) => {
  button.addEventListener("click", () => {
    const pool = button.dataset.pool;
    const delta = Number(button.dataset.delta);
    state[pool] += delta;
    renderVitals();
    save();
  });
});

function bindPool(id, key) {
  document.getElementById(id).addEventListener("change", (event) => {
    state[key] = Number(event.target.value);
    renderVitals();
    save();
  });
}

bindPool("hpNow", "hp");
bindPool("hpMax", "hpMax");
bindPool("manaNow", "mana");
bindPool("manaMax", "manaMax");

function renderNamedList(listId, items, onChange) {
  const list = document.getElementById(listId);
  list.replaceChildren();
  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "None yet";
    list.appendChild(empty);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    const input = document.createElement("input");
    input.type = "text";
    input.value = item.name;
    input.maxLength = 48;
    input.setAttribute("aria-label", "Name");
    input.addEventListener("change", () => {
      item.name = input.value;
      onChange();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      const index = items.indexOf(item);
      if (index >= 0) items.splice(index, 1);
      onChange();
      renderNamedList(listId, items, onChange);
    });
    li.append(input, remove);
    list.appendChild(li);
  }
}

function renderGear() {
  const list = document.getElementById("gearList");
  list.replaceChildren();
  for (const item of state.accessories) {
    const li = document.createElement("li");
    const slot = document.createElement("input");
    slot.type = "text";
    slot.value = item.slot;
    slot.maxLength = 24;
    slot.className = "gear-slot";
    slot.setAttribute("aria-label", "Slot");
    slot.addEventListener("change", () => {
      item.slot = slot.value;
      save();
    });
    const name = document.createElement("input");
    name.type = "text";
    name.value = item.name;
    name.maxLength = 48;
    name.placeholder = "Empty";
    name.setAttribute("aria-label", `${item.slot} item`);
    name.addEventListener("change", () => {
      item.name = name.value;
      save();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      state.accessories = state.accessories.filter((entry) => entry.id !== item.id);
      save();
      renderGear();
    });
    li.append(slot, name, remove);
    list.appendChild(li);
  }
}

const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];

function dieSelect(spell) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Die");
  for (const sides of DICE_SIDES) {
    const option = document.createElement("option");
    option.value = String(sides);
    option.textContent = `d${sides}`;
    if (sides === spell.sides) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener("change", () => {
    spell.sides = Number(select.value);
    save();
  });
  return select;
}

function numberField(spell, key, label, min, max) {
  const input = document.createElement("input");
  input.type = "number";
  input.value = spell[key];
  input.min = String(min);
  if (max) input.max = String(max);
  input.setAttribute("aria-label", label);
  input.addEventListener("change", () => {
    let value = Number(input.value);
    if (Number.isNaN(value)) value = min;
    value = Math.max(min, value);
    if (max) value = Math.min(max, value);
    spell[key] = value;
    input.value = value;
    save();
  });
  return input;
}

function renderSpells() {
  const list = document.getElementById("spellList");
  list.replaceChildren();
  if (state.spells.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "None yet";
    list.appendChild(empty);
    return;
  }
  for (const spell of state.spells) {
    const li = document.createElement("li");
    li.className = "spell-card";
    const level = document.createElement("span");
    level.className = "spell-level";
    level.textContent = `L${spell.level}`;
    const name = document.createElement("input");
    name.type = "text";
    name.value = spell.name;
    name.maxLength = 48;
    name.setAttribute("aria-label", "Spell name");
    name.addEventListener("change", () => {
      spell.name = name.value;
      save();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      state.spells = state.spells.filter((entry) => entry.id !== spell.id);
      save();
      renderSpells();
    });
    const formula = document.createElement("div");
    formula.className = "spell-formula";
    formula.append(
      numberField(spell, "count", "Number of dice", 1, 40),
      dieSelect(spell),
      numberField(spell, "adder", "Adder", -99, 99),
    );
    const roll = document.createElement("button");
    roll.type = "button";
    roll.textContent = "Roll";
    const result = document.createElement("p");
    result.className = "spell-result";
    result.textContent = "—";
    roll.addEventListener("click", () => rollSpell(spell, result, roll));
    formula.append(roll);
    li.append(level, name, remove, formula, result);
    list.appendChild(li);
  }
}

function rollSpell(spell, result, button) {
  if (button.disabled) return;
  button.disabled = true;
  const count = Math.min(40, Math.max(1, spell.count || 1));
  const sides = spell.sides || 8;
  const adder = Number(spell.adder) || 0;
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
  const total = rolls.reduce((sum, value) => sum + value, 0) + adder;
  const sign = adder < 0 ? "−" : "+";
  const started = performance.now();
  result.classList.remove("landed");
  result.classList.add("rolling");
  function frame(now) {
    if (now - started < 850) {
      const flicker = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
      result.textContent = `${flicker.join(" + ")} ${sign} ${Math.abs(adder)}`;
      requestAnimationFrame(frame);
      return;
    }
    result.classList.remove("rolling");
    result.classList.add("landed");
    result.textContent = `${rolls.join(" + ")} ${sign} ${Math.abs(adder)} = ${total}`;
    button.disabled = false;
  }
  requestAnimationFrame(frame);
}

document.getElementById("spellForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const name = String(data.get("name") || "").trim();
  if (!name) return;
  state.spells.push({
    id: crypto.randomUUID(),
    name,
    level: Math.min(9, Math.max(1, Number(data.get("level")) || 1)),
    count: Math.min(40, Math.max(1, Number(data.get("count")) || 1)),
    sides: Number(data.get("sides")) || 8,
    adder: Number(data.get("adder")) || 0,
  });
  event.currentTarget.reset();
  event.currentTarget.elements.level.value = "1";
  event.currentTarget.elements.count.value = "1";
  event.currentTarget.elements.sides.value = "8";
  event.currentTarget.elements.adder.value = "0";
  save();
  renderSpells();
});

document.getElementById("cantripForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = String(new FormData(event.currentTarget).get("name") || "").trim();
  if (!name) return;
  state.cantrips.push({ id: crypto.randomUUID(), name });
  event.currentTarget.reset();
  save();
  renderNamedList("cantripList", state.cantrips, save);
});

document.getElementById("gearForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const slot = String(data.get("slot") || "").trim();
  const name = String(data.get("name") || "").trim();
  if (!slot || !name) return;
  state.accessories.push({ id: crypto.randomUUID(), slot, name });
  event.currentTarget.reset();
  save();
  renderGear();
});

renderIdentity();
renderVitals();
renderSpells();
renderNamedList("cantripList", state.cantrips, save);
renderGear();
