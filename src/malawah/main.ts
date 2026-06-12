import "../styles.css";

// ── Recipe model ─────────────────────────────────────────────────────────────
// A Malawah recipe is the flour weight (Fw, grams) times a ratio vector:
// (honey g, salt g, water ml) per 1 g of flour.
const INGREDIENTS = ["honey", "salt", "water"] as const;
type Ingredient = (typeof INGREDIENTS)[number];
type RatioVector = Record<Ingredient, number>;

const DEFAULT_RATIOS: RatioVector = { honey: 0.16, salt: 0.032, water: 0.72 };
const DEFAULT_FLOUR = 500;

// ── Storage (localStorage with in-memory fallback) ───────────────────────────
// Keys are stable API: changing them silently wipes the user's tuned recipe.
const K_RATIOS = "malawah:ratios";
const K_FLOUR = "malawah:flour";

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
let RATIOS: RatioVector = { ...DEFAULT_RATIOS };
let FLOUR = DEFAULT_FLOUR;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const ratioInput = (ing: Ingredient): HTMLInputElement => $<HTMLInputElement>(`${ing}Ratio`);

// ── Formatting ───────────────────────────────────────────────────────────────
const fmtAmount = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 1 });
const fmtRatio = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 4, useGrouping: false });

/** Parse an input's value; null when empty or not a non-negative number. */
const toNonNegative = (raw: string): number | null => {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// ── Rendering ────────────────────────────────────────────────────────────────
function renderRecipe(): void {
  for (const ing of INGREDIENTS) {
    $(`${ing}Out`).textContent = fmtAmount(FLOUR * RATIOS[ing]);
  }
}
function renderVector(): void {
  $("vector").textContent = `(${INGREDIENTS.map((ing) => fmtRatio(RATIOS[ing])).join(", ")})`;
}
function syncRatioInputs(): void {
  for (const ing of INGREDIENTS) ratioInput(ing).value = String(RATIOS[ing]);
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

// ── Wiring ───────────────────────────────────────────────────────────────────
const flourInput = $<HTMLInputElement>("flour");
flourInput.addEventListener("input", async () => {
  const v = toNonNegative(flourInput.value);
  FLOUR = v ?? 0;
  renderRecipe();
  if (v !== null) await sset(K_FLOUR, FLOUR);
});

document.querySelectorAll<HTMLButtonElement>("button[data-fw]").forEach((b) =>
  b.addEventListener("click", async () => {
    FLOUR = Number(b.dataset.fw!);
    flourInput.value = String(FLOUR);
    renderRecipe();
    await sset(K_FLOUR, FLOUR);
  })
);

for (const ing of INGREDIENTS) {
  ratioInput(ing).addEventListener("input", async () => {
    const v = toNonNegative(ratioInput(ing).value);
    if (v === null) return; // keep the last valid value until the field makes sense again
    RATIOS[ing] = v;
    renderVector();
    renderRecipe();
    await sset(K_RATIOS, RATIOS);
  });
}

$("reset").addEventListener("click", () => $<HTMLDialogElement>("resetModal").showModal());
$<HTMLDialogElement>("resetModal").addEventListener("close", async () => {
  const modal = $<HTMLDialogElement>("resetModal");
  if (modal.returnValue !== "confirm") return;
  modal.returnValue = "";
  RATIOS = { ...DEFAULT_RATIOS };
  syncRatioInputs();
  renderVector();
  renderRecipe();
  await sset(K_RATIOS, RATIOS);
  showToast("Default ratios restored");
});

// ── Init ─────────────────────────────────────────────────────────────────────
(async function init(): Promise<void> {
  const r = await sget<Record<string, unknown>>(K_RATIOS);
  if (r && typeof r === "object" && !Array.isArray(r)) {
    for (const ing of INGREDIENTS) {
      const v = r[ing];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) RATIOS[ing] = v;
    }
  }
  const f = await sget<number>(K_FLOUR);
  if (typeof f === "number" && Number.isFinite(f) && f >= 0) FLOUR = f;
  flourInput.value = String(FLOUR);
  syncRatioInputs();
  renderVector();
  renderRecipe();
})();
