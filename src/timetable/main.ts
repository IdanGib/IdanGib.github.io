import "../styles.css";
import {
  CONFIG,
  type ClassConfig,
  type Item,
  type ItemRef,
  type Labels,
  type Settings,
  type Subject,
  type TextKey,
  type Tone,
} from "./config";

// ── The class on screen ──────────────────────────────────────────────────────
// A class inherits the shared content and overrides what it needs, so the rest
// of the file only ever reads the resolved class.
interface ActiveClass {
  id: string;
  name: string;
  icon: string;
  settings: Settings;
  items: Record<string, Item>;
  daily: string[];
  subjects: Record<string, Subject>;
  schedule: Record<number, string[]>;
  extras: Record<string, ItemRef[]>;
  labels: Labels;
}

const resolveClass = (def: ClassConfig): ActiveClass => ({
  id: def.id,
  name: def.name,
  icon: def.icon,
  settings: { ...CONFIG.settings, ...def.settings },
  items: { ...CONFIG.items, ...def.items },
  daily: def.daily ?? CONFIG.daily,
  subjects: { ...CONFIG.subjects, ...def.subjects },
  schedule: def.schedule,
  extras: def.extras ?? {},
  labels: { ...CONFIG.labels, ...def.labels },
});

// Key is a stable API: changing it silently drops the day's ticks.
const K_DONE = "timetable:done";
const K_CLASS = "timetable:class";

const readStored = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage unavailable — fall back to the default class
  }
};

const classes = CONFIG.classes;
const storedClass = readStored(K_CLASS);
let active = resolveClass(classes.find((c) => c.id === storedClass) ?? classes[0]);

// ── Text ─────────────────────────────────────────────────────────────────────
const t = (key: TextKey, vars: Record<string, string | number> = {}): string =>
  active.labels[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

// ── Date helpers ─────────────────────────────────────────────────────────────
// Local time throughout: an ISO/UTC key would roll over mid-evening in Israel
// and hand the child tomorrow's list while they are still packing today's.
const dateKey = (d: Date): string => {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// ── Which day is on screen ───────────────────────────────────────────────────
interface Day {
  key: string;
  name: string;
  isSchoolDay: boolean;
  subjects: string[];
  extras: ItemRef[];
}

const now = new Date();
let offset = now.getHours() >= active.settings.switchToTomorrowAtHour ? 1 : 0;

function dayFor(off: number): Day {
  const date = addDays(now, off);
  const weekday = date.getDay();
  return {
    key: dateKey(date),
    name: active.labels.weekdays[weekday],
    isSchoolDay: active.settings.schoolDays.includes(weekday),
    subjects: active.schedule[weekday] ?? [],
    extras: active.extras[dateKey(date)] ?? [],
  };
}

// ── Building the list ────────────────────────────────────────────────────────
interface ResolvedItem extends Item {
  id: string;
  tone: Tone;
}

interface Group {
  title: string;
  note?: string;
  highlight?: boolean;
  items: ResolvedItem[];
}

function resolve(ref: ItemRef, fallback: Tone = "warning"): ResolvedItem | null {
  const base = typeof ref === "string" ? active.items[ref] : ref;
  if (!base) return null; // key missing from the catalogue — skip it
  const id = typeof ref === "string" ? ref : base.name;
  return { ...base, id, tone: base.tone ?? fallback };
}

function buildGroups(day: Day): Group[] {
  const groups: Group[] = [];

  const dailyItems = active.daily
    .map((id) => resolve(id))
    .filter((x): x is ResolvedItem => x !== null);
  if (dailyItems.length) groups.push({ title: active.labels.groupDaily, items: dailyItems });

  const subjectItems: ResolvedItem[] = [];
  const names: string[] = [];
  day.subjects.forEach((key) => {
    const subject = active.subjects[key];
    if (!subject) return;
    names.push(subject.name);
    subject.items.forEach((id) => {
      const item = resolve(id, subject.tone);
      if (item && !subjectItems.some((x) => x.id === item.id)) subjectItems.push(item);
    });
  });
  if (subjectItems.length) {
    groups.push({
      title: active.labels.groupSubjects,
      note: names.join(" · "),
      items: subjectItems,
    });
  }

  const extraItems = day.extras
    .map((ref) => resolve(ref))
    .filter((x): x is ResolvedItem => x !== null);
  if (extraItems.length) {
    groups.push({
      title: active.labels.groupExtras,
      note: active.labels.extrasSource,
      highlight: true,
      items: extraItems,
    });
  }

  return groups;
}

// ── Storage (localStorage with in-memory fallback) ───────────────────────────
// `timetable:done` now holds one date map per class,
// `{ classId: { "YYYY-MM-DD": ["itemId", …] } }`. A single-class file written
// by an older build — `{ "YYYY-MM-DD": [...] }` — is read as the first class's
// history, so nobody's ticks are lost on the upgrade.
const KEEP_DAYS = 14;

type DoneMap = Record<string, string[]>;
type StoredDone = Record<string, DoneMap | string[]>;

const done: Record<string, Record<string, Set<string>>> = {};

const isLegacy = (raw: StoredDone): boolean =>
  Object.values(raw).some((value) => Array.isArray(value));

function loadDone(): void {
  let raw: StoredDone = {};
  try {
    const v = readStored(K_DONE);
    if (v) raw = JSON.parse(v) as StoredDone;
  } catch {
    /* corrupt JSON — start empty */
  }
  const byClass: Record<string, DoneMap> = isLegacy(raw)
    ? { [classes[0].id]: raw as DoneMap }
    : (raw as Record<string, DoneMap>);

  const cutoff = dateKey(addDays(now, -KEEP_DAYS));
  for (const [classId, days] of Object.entries(byClass)) {
    if (!days || typeof days !== "object") continue;
    for (const [key, ids] of Object.entries(days)) {
      if (key >= cutoff && Array.isArray(ids)) (done[classId] ??= {})[key] = new Set(ids);
    }
  }
}

function saveDone(): void {
  const raw: Record<string, DoneMap> = {};
  for (const [classId, days] of Object.entries(done)) {
    const kept: DoneMap = {};
    for (const [key, set] of Object.entries(days)) {
      if (set.size) kept[key] = [...set];
    }
    if (Object.keys(kept).length) raw[classId] = kept;
  }
  try {
    localStorage.setItem(K_DONE, JSON.stringify(raw));
  } catch {
    /* storage unavailable — the in-memory copy still drives this session */
  }
}

const doneFor = (day: Day): Set<string> => ((done[active.id] ??= {})[day.key] ??= new Set());

// ── Audio ────────────────────────────────────────────────────────────────────
// Recorded clips win; anything without one is read out by the browser voice,
// so every row can be heard even before its clip exists.
const canSpeak = "speechSynthesis" in window;
const audioCache = new Map<string, HTMLAudioElement>();
let currentAudio: HTMLAudioElement | null = null;
let playingId: string | null = null;

const ICON_PLAY = `<svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5z"/></svg>`;
const ICON_STOP = `<svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>`;

const canHear = (item: ResolvedItem): boolean => !!item.audioUrl || canSpeak;

function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (canSpeak) speechSynthesis.cancel();
  playingId = null;
  document.querySelectorAll<HTMLButtonElement>("button[data-playing]").forEach((b) => {
    b.classList.remove("bg-warning", "text-warning-content");
    b.classList.add("bg-base-300/70");
    b.removeAttribute("data-playing");
    b.setAttribute("aria-label", t("playItem", { name: b.dataset.name ?? "" }));
    b.innerHTML = ICON_PLAY;
  });
}

function play(item: ResolvedItem, onend: () => void): void {
  if (item.audioUrl) {
    const src = item.audioUrl;
    let audio = audioCache.get(src);
    if (!audio) {
      audio = new Audio(src);
      audioCache.set(src, audio);
    }
    currentAudio = audio;
    audio.currentTime = 0;
    audio.onended = onend;
    audio.onerror = onend;
    void audio.play().catch(onend);
    return;
  }
  const utterance = new SpeechSynthesisUtterance(item.name);
  utterance.lang = "he-IL";
  utterance.rate = 0.9;
  utterance.onend = onend;
  utterance.onerror = onend;
  speechSynthesis.speak(utterance);
}

// ── Rendering ────────────────────────────────────────────────────────────────
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const els = {
  classpick: $("classpick"),
  tabs: $("tabs"),
  headline: $("headline"),
  subline: $("subline"),
  count: $("count"),
  fill: $<HTMLElement>("fill"),
  list: $("list"),
};

const TAB_BASE =
  "flex-1 cursor-pointer rounded-full border-0 bg-transparent px-2 py-2.5 font-rubik text-base font-medium text-neutral transition-colors duration-150 aria-pressed:bg-base-content aria-pressed:text-base-100 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-warning motion-reduce:transition-none";

const TILE: Record<Tone, string> = {
  primary: "bg-primary/15",
  secondary: "bg-secondary/15",
  accent: "bg-accent/15",
  info: "bg-info/15",
  success: "bg-success/15",
  warning: "bg-warning/15",
  error: "bg-error/15",
  neutral: "bg-neutral/15",
};

const ROW_BASE =
  "relative flex min-h-[76px] w-full items-center gap-2.5 rounded-box p-2.5 transition-opacity duration-200 motion-reduce:transition-none";
const ROW_PLAIN = "bg-base-200 shadow-[0_3px_0_var(--color-base-300)]";
const ROW_NOTE = "bg-warning/15 shadow-[0_3px_0_var(--color-warning)]";

const CLASS_SUMMARY =
  "flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-base-200 px-3 py-1.5 font-rubik text-[13px] font-medium text-base-content shadow-[0_2px_0_var(--color-base-300)] transition-colors duration-150 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-warning motion-reduce:transition-none";
const CLASS_OPTION =
  "flex w-full cursor-pointer items-center gap-2 text-start font-rubik text-[15px] text-base-content aria-pressed:bg-base-200 aria-pressed:font-medium focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-warning";
const ICON_CHEVRON = `<svg viewBox="0 0 24 24" aria-hidden="true" class="h-3.5 w-3.5 fill-none stroke-current stroke-[3] [stroke-linecap:round] [stroke-linejoin:round]"><path d="M6 9l6 6 6-6"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true" class="ms-auto h-4 w-4 fill-none stroke-success stroke-[3.5] [stroke-linecap:round] [stroke-linejoin:round]"><path d="M4 13l6 6L20 5"/></svg>`;

function switchClass(def: ClassConfig): void {
  if (def.id === active.id) return;
  active = resolveClass(def);
  try {
    localStorage.setItem(K_CLASS, def.id);
  } catch {
    /* storage unavailable — the choice still holds for this session */
  }
  stopAudio();
  render();
}

/** One class needs no picker; the header stays as it was. */
function renderClassPicker(): void {
  els.classpick.replaceChildren();
  const many = classes.length > 1;
  els.classpick.classList.toggle("hidden", !many);
  if (!many) return;

  const box = document.createElement("details");
  box.className = "dropdown dropdown-start";

  const summary = document.createElement("summary");
  summary.className = CLASS_SUMMARY;
  summary.setAttribute("aria-label", active.labels.classPicker);
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = active.icon;
  summary.append(icon, active.name);
  summary.insertAdjacentHTML("beforeend", ICON_CHEVRON);
  box.appendChild(summary);

  const menu = document.createElement("ul");
  menu.className =
    "dropdown-content menu mt-2 w-48 rounded-box bg-base-100 p-1.5 shadow-[0_6px_24px_var(--color-base-300)]";
  classes.forEach((def) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = CLASS_OPTION;
    b.setAttribute("aria-pressed", String(def.id === active.id));
    b.setAttribute("aria-label", t("pickClass", { name: def.name }));
    const emoji = document.createElement("span");
    emoji.setAttribute("aria-hidden", "true");
    emoji.className = "text-lg";
    emoji.textContent = def.icon;
    b.append(emoji, def.name);
    if (def.id === active.id) b.insertAdjacentHTML("beforeend", ICON_CHECK);
    b.addEventListener("click", () => {
      box.open = false;
      switchClass(def);
    });
    li.appendChild(b);
    menu.appendChild(li);
  });
  box.appendChild(menu);

  els.classpick.appendChild(box);
}

function renderTabs(): void {
  els.tabs.replaceChildren();
  [0, 1].forEach((off) => {
    const day = dayFor(off);
    const b = document.createElement("button");
    b.type = "button";
    b.className = TAB_BASE;
    const tab = off === 0 ? active.labels.tabToday : active.labels.tabTomorrow;
    b.textContent = `${tab} · ${day.name}`;
    b.setAttribute("aria-pressed", String(off === offset));
    b.addEventListener("click", () => {
      offset = off;
      stopAudio();
      render();
    });
    els.tabs.appendChild(b);
  });
}

function itemRow(
  item: ResolvedItem,
  marked: boolean,
  highlight: boolean,
  onToggle: () => void
): HTMLElement {
  const row = document.createElement("div");
  row.className = `${ROW_BASE} ${highlight ? ROW_NOTE : ROW_PLAIN}`;

  if (highlight) {
    const tape = document.createElement("span");
    tape.setAttribute("aria-hidden", "true");
    tape.className = "absolute -top-2 end-6 h-[17px] w-14 -rotate-3 rounded-[2px] bg-warning/45";
    row.appendChild(tape);
  }

  // Icon + label — the row's main toggle target.
  const pick = document.createElement("button");
  pick.type = "button";
  pick.className =
    "group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[14px] border-0 bg-transparent py-1.5 text-start focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-warning";
  pick.setAttribute("aria-pressed", String(marked));
  pick.setAttribute(
    "aria-label",
    t(marked ? "unmarkItem" : "markItem", { name: item.name })
  );

  const tile = document.createElement("span");
  tile.setAttribute("aria-hidden", "true");
  tile.className = `grid h-13 w-13 flex-none place-items-center rounded-[14px] text-[27px] transition-transform duration-200 ease-fluid group-active:scale-90 motion-reduce:transition-none ${TILE[item.tone]} ${marked ? "scale-90" : "scale-100"}`;
  tile.textContent = item.icon;
  pick.appendChild(tile);

  const label = document.createElement("span");
  label.className = `min-w-0 text-xl leading-snug font-medium ${marked ? "text-base-content/40 line-through decoration-2" : "text-base-content"}`;
  label.append(item.name);
  if (item.note) {
    const small = document.createElement("small");
    small.className = "mt-0.5 block text-[13px] font-normal text-neutral";
    small.textContent = item.note;
    label.appendChild(small);
  }
  pick.appendChild(label);
  pick.addEventListener("click", onToggle);
  row.appendChild(pick);

  // Hear the item read out.
  if (canHear(item)) {
    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className =
      "ms-auto grid h-12 w-12 flex-none cursor-pointer place-items-center rounded-full border-0 bg-base-300/70 text-base-content transition-colors duration-150 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-warning motion-reduce:transition-none";
    playBtn.dataset.name = item.name;
    playBtn.setAttribute("aria-label", t("playItem", { name: item.name }));
    playBtn.innerHTML = ICON_PLAY;
    playBtn.addEventListener("click", () => {
      if (playingId === item.id) {
        stopAudio();
        return;
      }
      stopAudio();
      playingId = item.id;
      playBtn.dataset.playing = "true";
      playBtn.classList.remove("bg-base-300/70");
      playBtn.classList.add("bg-warning", "text-warning-content");
      playBtn.setAttribute("aria-label", active.labels.stopItem);
      playBtn.innerHTML = ICON_STOP;
      play(item, () => {
        if (playingId === item.id) stopAudio();
      });
    });
    row.appendChild(playBtn);
  }

  // Big tick target. Duplicates `pick`, so it is hidden from screen readers.
  const tick = document.createElement("button");
  tick.type = "button";
  tick.tabIndex = -1;
  tick.setAttribute("aria-hidden", "true");
  tick.className = `relative grid h-9 w-9 flex-none cursor-pointer place-items-center rounded-full border-[3px] ${marked ? "border-success bg-success" : "border-base-300 bg-base-200"} ${canHear(item) ? "" : "ms-auto"}`;
  tick.innerHTML = marked
    ? `<svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13l6 6L20 5"/></svg>`
    : "";
  if (marked) tick.classList.add("text-success-content");
  tick.addEventListener("click", onToggle);
  row.appendChild(tick);

  return row;
}

function celebrate(el: HTMLElement): void {
  const ring = document.createElement("span");
  ring.setAttribute("aria-hidden", "true");
  ring.className =
    "pointer-events-none absolute inset-0 rounded-full border-2 border-success motion-safe:animate-ping";
  el.appendChild(ring);
  setTimeout(() => ring.remove(), 600);
}

function render(celebrateId?: string): void {
  const day = dayFor(offset);
  const marked = doneFor(day);
  renderClassPicker();
  renderTabs();
  els.list.replaceChildren();

  const groups = day.isSchoolDay ? buildGroups(day) : [];
  const all = groups.flatMap((g) => g.items);

  if (!all.length) {
    els.headline.textContent = active.labels.noSchoolTitle;
    els.subline.textContent = t("noSchoolSub", { day: day.name });
    els.count.classList.add("hidden");
    els.fill.setAttribute("height", "0");
    return;
  }
  els.count.classList.remove("hidden");

  groups.forEach((group) => {
    const sec = document.createElement("section");
    sec.className = "mb-5.5";

    const h = document.createElement("h2");
    h.className =
      "mb-2 flex items-center gap-2 ps-0.5 font-secular text-[17px] font-normal text-base-content";
    h.append(group.title);
    if (group.note) {
      const s = document.createElement("span");
      s.className = "font-rubik text-[13px] font-normal text-neutral";
      s.textContent = group.note;
      h.appendChild(s);
    }
    sec.appendChild(h);

    const rows = document.createElement("div");
    rows.className = "flex flex-col gap-2.5";
    group.items.forEach((item) => {
      const row = itemRow(item, marked.has(item.id), !!group.highlight, () => {
        const nowMarked = !marked.has(item.id);
        if (nowMarked) marked.add(item.id);
        else marked.delete(item.id);
        saveDone();
        render(nowMarked ? item.id : undefined);
      });
      row.dataset.item = item.id;
      rows.appendChild(row);
    });
    sec.appendChild(rows);

    els.list.appendChild(sec);
  });

  const total = all.length;
  const left = total - all.filter((i) => marked.has(i.id)).length;
  const ratio = (total - left) / total;

  // The bag fills up as items are ticked — geometry attributes, not styles.
  els.fill.setAttribute("height", String(94 * ratio));
  els.fill.setAttribute("y", String(132 - 94 * ratio));
  els.fill.classList.toggle("fill-success", left === 0);
  els.fill.classList.toggle("fill-warning", left !== 0);

  els.headline.textContent =
    left === 0
      ? active.labels.allDone
      : left === 1
        ? active.labels.remainingOne
        : t("remainingMany", { n: left });
  els.subline.textContent = left === 0 ? active.labels.sublineDone : active.labels.subline;
  els.count.textContent = t("progress", { done: total - left, total });

  if (left === 0) {
    const banner = document.createElement("div");
    banner.className =
      "mt-1.5 rounded-[24px] bg-success px-4.5 py-5.5 text-center font-secular text-[26px] text-success-content shadow-[0_4px_0_color-mix(in_oklab,var(--color-success)_65%,black)]";
    banner.append(active.labels.bannerTitle);
    const sub = document.createElement("p");
    sub.className = "mt-1.5 font-rubik text-[15px] font-normal opacity-90";
    sub.textContent = t("bannerSub", { day: day.name });
    banner.appendChild(sub);
    els.list.appendChild(banner);
  }

  if (celebrateId) {
    const el = els.list.querySelector<HTMLElement>(
      `[data-item="${CSS.escape(celebrateId)}"] button[aria-hidden="true"]`
    );
    if (el) celebrate(el);
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────
const closePicker = (target?: Node): void => {
  const box = els.classpick.querySelector<HTMLDetailsElement>("details[open]");
  if (box && (!target || !box.contains(target))) box.open = false;
};
document.addEventListener("pointerdown", (e) => closePicker(e.target as Node));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePicker();
});

loadDone();
render();
