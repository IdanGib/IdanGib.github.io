import "../styles.css";

// ── Cycle model ──────────────────────────────────────────────────────────────
const TRAIN_DAYS = 5;
const WEEK_LEN = 7;
const TRAIN_WEEKS = 5;
const CYCLE_WEEKS = TRAIN_WEEKS + 1;
const CYCLE_LEN = CYCLE_WEEKS * WEEK_LEN;
const SESSIONS_PER_CYCLE = TRAIN_WEEKS * TRAIN_DAYS;

type Phase = "pre" | "train" | "rest" | "deload";

interface DayInfo {
  phase: Phase;
  cycleNum?: number;
  weekInCycle?: number;
  dayInWeek?: number;
}

type DoneMap = Record<string, boolean>;

// ── Date helpers ─────────────────────────────────────────────────────────────
const fmt = (d: Date): string => {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
const parse = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const dayDiff = (a: string, b: string): number =>
  Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
const lastMonday = (): string => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const off = (t.getDay() + 6) % 7;
  return fmt(addDays(t, -off));
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DOW_SHORT = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];

function prettyDate(s: string): string {
  const d = parse(s);
  return `${DAYS_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function classify(dateStr: string, startStr: string): DayInfo {
  const diff = dayDiff(startStr, dateStr);
  if (diff < 0) return { phase: "pre" };
  const cycleNum = Math.floor(diff / CYCLE_LEN) + 1;
  const inCycle = diff % CYCLE_LEN;
  const weekInCycle = Math.floor(inCycle / WEEK_LEN);
  const dayInWeek = inCycle % WEEK_LEN;
  if (weekInCycle === TRAIN_WEEKS) return { phase: "deload", cycleNum, weekInCycle, dayInWeek };
  if (dayInWeek < TRAIN_DAYS) return { phase: "train", cycleNum, weekInCycle, dayInWeek };
  return { phase: "rest", cycleNum, weekInCycle, dayInWeek };
}

// ── Storage (localStorage with in-memory fallback) ───────────────────────────
// Keys are stable API: changing them silently wipes the user's history.
const K_START = "tracker:start";
const K_DONE = "tracker:completions";
const K_LOCKED = "tracker:locked";

const mem: Record<string, unknown> = {};
async function sget<T>(k: string): Promise<T | null> {
  try {
    const v = localStorage.getItem(k);
    if (v != null) return JSON.parse(v) as T;
  } catch {
    /* storage unavailable — fall through to memory */
  }
  return k in mem ? (mem[k] as T) : null;
}
async function sset(k: string, v: unknown): Promise<void> {
  mem[k] = v;
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable — memory copy already kept */
  }
}

// ── State ────────────────────────────────────────────────────────────────────
let START = lastMonday();
let DONE: DoneMap = {};
let viewCycle = 1;
let LOCKED = true;

const getToday = (): string => fmt(new Date());

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function currentCycleNum(): number {
  const d = dayDiff(START, getToday());
  return d < 0 ? 1 : Math.floor(d / CYCLE_LEN) + 1;
}

function cycleStats(cycleNum: number): { done: number; total: number } {
  const s0 = addDays(parse(START), (cycleNum - 1) * CYCLE_LEN);
  let done = 0;
  for (let i = 0; i < CYCLE_LEN; i++) {
    const ds = fmt(addDays(s0, i));
    if (classify(ds, START).phase === "train" && DONE[ds]) done++;
  }
  return { done, total: SESSIONS_PER_CYCLE };
}

function streak(): number {
  const today = getToday();
  let s = 0;
  let cur = parse(today);
  const limit = Math.max(0, dayDiff(START, today)) + 1;
  for (let i = 0; i < limit; i++) {
    const ds = fmt(cur);
    if (dayDiff(START, ds) < 0) break;
    const c = classify(ds, START);
    // today doesn't break the streak while it's still unlogged — logging it extends the run
    if (c.phase === "train") {
      if (DONE[ds]) s++;
      else if (ds !== today) break;
    }
    cur = addDays(cur, -1);
  }
  return s;
}

function autoMarkRecent(n: number): void {
  let cur = addDays(parse(getToday()), -1);
  let count = 0;
  while (count < n) {
    const ds = fmt(cur);
    if (dayDiff(START, ds) < 0) break;
    if (classify(ds, START).phase === "train") {
      DONE[ds] = true;
      count++;
    }
    cur = addDays(cur, -1);
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────
const PHASE_DOT: Record<Phase, string> = {
  pre: "bg-neutral",
  train: "bg-primary",
  rest: "bg-secondary",
  deload: "bg-accent",
};

function renderStatus(today: string): void {
  const c = classify(today, START);
  let name: string;
  let pres: string;
  if (c.phase === "pre") {
    name = "Not started";
    pres = "Starts " + prettyDate(START);
  } else if (c.phase === "train") {
    name = "Training day";
    pres = `Week ${c.weekInCycle! + 1} · Session ${c.dayInWeek! + 1} of ${TRAIN_DAYS}`;
  } else if (c.phase === "rest") {
    name = "Rest day";
    pres = `Week ${c.weekInCycle! + 1} · Recovery`;
  } else {
    name = "Deload week";
    pres = "Full week off — let it adapt";
  }
  const cur = currentCycleNum();
  const st = cycleStats(cur);
  const pct = Math.round((st.done / st.total) * 100);
  const statCard = (k: string, v: string, sub: string) => `
    <div class="card border border-base-content/10 bg-base-200 shadow-md">
      <div class="card-body gap-0 px-3 pt-3.5 pb-3">
        <p class="mb-1.5 font-jet text-[9px] font-bold tracking-[0.14em] uppercase text-base-content/40">${k}</p>
        <p class="font-anton text-[26px] leading-[0.9] tracking-[0.01em]">${v}<span class="font-dm text-xs font-medium tracking-normal text-base-content/60">${sub}</span></p>
      </div>
    </div>`;
  $("status").innerHTML = `
    <div class="card border border-base-content/10 bg-base-200 shadow-md">
      <div class="card-body gap-0 px-[18px] pt-[18px] pb-4">
        <p class="mb-2.5 font-jet text-[10px] font-bold tracking-[0.12em] uppercase text-base-content/40">${prettyDate(today)}</p>
        <p class="mb-1 flex items-center gap-2.5"><span aria-hidden="true" class="h-2.5 w-2.5 flex-none rounded-full ${PHASE_DOT[c.phase]}"></span><span class="text-[21px] leading-none font-bold">${name}</span></p>
        <p class="mb-3.5 pl-5 text-[13px] leading-tight font-medium text-base-content/60">${pres}</p>
        <progress class="progress progress-primary h-1" value="${pct}" max="100" aria-label="Cycle progress"></progress>
      </div>
    </div>
    <div class="grid grid-cols-3 gap-2">
      ${statCard("Cycle", String(cur), "/∞")}
      ${statCard("Sessions", String(st.done), `/${st.total}`)}
      ${statCard("Streak", String(streak()), " sessions")}
    </div>`;
}

const CELL_BASE =
  "relative flex aspect-square select-none items-center justify-center rounded-full font-jet text-xs";

function trainButton(ds: string, n: number, done: boolean, isToday: boolean): string {
  const state = done
    ? "border-[1.5px] border-primary bg-primary font-extrabold text-primary-content"
    : "border-[1.5px] border-primary/60 bg-transparent font-bold text-base-content hover:border-primary hover:bg-primary/10";
  const ring = isToday
    ? done
      ? " ring-2 ring-primary-content/55 ring-inset"
      : " ring-2 ring-base-content ring-inset"
    : "";
  const fx =
    " cursor-pointer transition-transform duration-100 ease-fluid active:scale-[0.88] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none";
  const label = `${prettyDate(ds)} — training day${done ? ", logged" : ""}`;
  return `<button type="button" class="${CELL_BASE} ${state}${ring}${fx}" data-d="${ds}" aria-pressed="${done}" aria-label="${label}">${n}</button>`;
}

function trainLockedCell(n: number, done: boolean, isToday: boolean): string {
  const state = done
    ? "border-[1.5px] border-primary bg-primary font-extrabold text-primary-content"
    : "border-[1.5px] border-neutral font-bold text-neutral opacity-75";
  const ring = isToday ? " ring-2 ring-base-content ring-inset" : "";
  return `<div class="${CELL_BASE} ${state}${ring}">${n}</div>`;
}

function renderWeeks(today: string): void {
  $("cycleLabel").innerHTML = `Macrocycle <em class="not-italic text-primary">#${viewCycle}</em>`;
  $<HTMLButtonElement>("prev").disabled = viewCycle <= 1;
  const s0 = addDays(parse(START), (viewCycle - 1) * CYCLE_LEN);
  const row = "grid grid-cols-[22px_repeat(7,1fr)] items-center gap-[5px]";
  let html = `<div class="${row} mb-1.5"><div></div>`;
  for (let d = 0; d < 7; d++) {
    const date = addDays(s0, d);
    html += `<div class="text-center font-jet text-[10px] font-bold tracking-[0.04em] uppercase text-base-content/30">${DOW_SHORT[date.getDay()]}</div>`;
  }
  html += "</div>";
  for (let w = 0; w < CYCLE_WEEKS; w++) {
    const isDeload = w === TRAIN_WEEKS;
    html += `<div class="${row}${isDeload ? " mt-[5px] border-t border-base-content/10 pt-1.5" : ""}"><div class="text-center font-jet text-[10px] font-extrabold ${isDeload ? "text-accent" : "text-base-content/30"}">${isDeload ? "D" : w + 1}</div>`;
    for (let d = 0; d < WEEK_LEN; d++) {
      const date = addDays(s0, w * WEEK_LEN + d);
      const ds = fmt(date);
      const c = classify(ds, START);
      const n = date.getDate();
      // positive = past, 0 = today, negative = future
      const diff = dayDiff(ds, today);
      const isToday = diff === 0;
      if (c.phase === "train") {
        const done = !!DONE[ds];
        if (isToday || (diff > 0 && !LOCKED)) {
          html += trainButton(ds, n, done, isToday);
        } else if (diff > 0) {
          html += trainLockedCell(n, done, isToday);
        } else {
          html += `<div class="${CELL_BASE} border-[1.5px] border-dashed border-neutral font-bold text-neutral opacity-75">${n}</div>`;
        }
      } else if (c.phase === "deload") {
        html += `<div class="${CELL_BASE} text-[11px] font-bold ${isToday ? "text-accent ring-2 ring-base-content/35 ring-inset" : "text-accent/60"}">${n}</div>`;
      } else {
        html += `<div class="${CELL_BASE} text-[11px] font-normal text-base-content/30${isToday ? " ring-2 ring-base-content/35 ring-inset" : ""}">${n}</div>`;
      }
    }
    html += "</div>";
  }
  const el = $("weeks");
  el.innerHTML = html;
  el.querySelectorAll<HTMLButtonElement>("button[data-d]").forEach((b) =>
    b.addEventListener("click", () => toggle(b.dataset.d!))
  );
}

function renderAll(): void {
  const today = getToday();
  renderStatus(today);
  renderWeeks(today);
  $<HTMLInputElement>("start").value = START;
}

// ── Feedback ─────────────────────────────────────────────────────────────────
let toastTimer: number | undefined;
function showToast(msg: string): void {
  const toast = $("toast");
  $("toastMsg").textContent = msg;
  clearTimeout(toastTimer);
  toast.classList.remove("opacity-0");
  toast.classList.add("opacity-100");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("opacity-100");
    toast.classList.add("opacity-0");
  }, 2000);
}

function celebrate(btn: HTMLElement): void {
  const ring = document.createElement("span");
  ring.className =
    "pointer-events-none absolute inset-0 rounded-full border-2 border-primary motion-safe:animate-ping";
  btn.appendChild(ring);
  setTimeout(() => ring.remove(), 600);
}

async function toggle(ds: string): Promise<void> {
  const wasEmpty = !DONE[ds];
  if (DONE[ds]) delete DONE[ds];
  else DONE[ds] = true;
  await sset(K_DONE, DONE);
  renderAll();
  if (wasEmpty) {
    const btn = document.querySelector<HTMLButtonElement>(`button[data-d="${ds}"]`);
    if (btn) celebrate(btn);
    showToast("Session logged!");
  }
}

// ── Wiring ───────────────────────────────────────────────────────────────────
$("prev").addEventListener("click", () => {
  if (viewCycle > 1) {
    viewCycle--;
    renderWeeks(getToday());
  }
});
$("next").addEventListener("click", () => {
  viewCycle++;
  renderWeeks(getToday());
});
$("now").addEventListener("click", () => {
  viewCycle = currentCycleNum();
  renderWeeks(getToday());
});
$<HTMLInputElement>("start").addEventListener("change", async (e) => {
  START = (e.target as HTMLInputElement).value || lastMonday();
  await sset(K_START, START);
  viewCycle = currentCycleNum();
  renderAll();
});
$("reset").addEventListener("click", () => $<HTMLDialogElement>("resetModal").showModal());
$<HTMLDialogElement>("resetModal").addEventListener("close", async () => {
  const modal = $<HTMLDialogElement>("resetModal");
  if (modal.returnValue !== "confirm") return;
  modal.returnValue = "";
  DONE = {};
  await sset(K_DONE, DONE);
  renderAll();
});
$<HTMLInputElement>("lockToggle").addEventListener("change", async () => {
  LOCKED = $<HTMLInputElement>("lockToggle").checked;
  await sset(K_LOCKED, LOCKED);
  renderWeeks(getToday());
});

// ── Init ─────────────────────────────────────────────────────────────────────
(async function init(): Promise<void> {
  const s = await sget<string>(K_START);
  if (s) {
    START = s;
    if (dayDiff(START, getToday()) < 0) {
      START = lastMonday();
      await sset(K_START, START);
    }
  } else {
    await sset(K_START, START);
  }
  const d = await sget<DoneMap>(K_DONE);
  if (d && typeof d === "object" && !Array.isArray(d)) DONE = d;
  else if (!d) {
    autoMarkRecent(3);
    await sset(K_DONE, DONE);
  }
  const l = await sget<boolean>(K_LOCKED);
  if (l !== null) LOCKED = l;
  viewCycle = currentCycleNum();
  $<HTMLInputElement>("lockToggle").checked = LOCKED;
  renderAll();
})();
