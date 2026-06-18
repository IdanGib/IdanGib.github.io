import "../styles.css";

// ── Model ────────────────────────────────────────────────────────────────────
// A cartoon is an ordered list of captured frames. Frames are photos, far too
// big for localStorage (~5 MB), so everything lives in IndexedDB instead — the
// DB name and store names below are a stable API: renaming them silently wipes
// every saved cartoon. Nothing is ever written to the device photo library.
interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  fps: number;
  order: string[]; // frame ids, in play order
}
interface FrameRow {
  id: string;
  projectId: string;
  blob: Blob;
  createdAt: number;
}

const TARGET = 800; // captured frames are square, TARGET×TARGET JPEGs
const QUALITY = 0.72;

// ── IndexedDB ────────────────────────────────────────────────────────────────
const DB_NAME = "flipbook";
const DB_VERSION = 1;
const S_PROJECTS = "projects";
const S_FRAMES = "frames";

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(S_PROJECTS)) d.createObjectStore(S_PROJECTS, { keyPath: "id" });
      if (!d.objectStoreNames.contains(S_FRAMES)) {
        d.createObjectStore(S_FRAMES, { keyPath: "id" }).createIndex("projectId", "projectId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function request<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction(store, mode).objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      })
  );
}

const getAllProjects = (): Promise<Project[]> => request<Project[]>(S_PROJECTS, "readonly", (s) => s.getAll());
const getProject = (id: string): Promise<Project | undefined> => request<Project | undefined>(S_PROJECTS, "readonly", (s) => s.get(id));
const putProject = (p: Project): Promise<unknown> => request(S_PROJECTS, "readwrite", (s) => s.put(p));
const getFrame = (id: string): Promise<FrameRow> => request<FrameRow>(S_FRAMES, "readonly", (s) => s.get(id));
const putFrame = (f: FrameRow): Promise<unknown> => request(S_FRAMES, "readwrite", (s) => s.put(f));
const deleteFrameRow = (id: string): Promise<unknown> => request(S_FRAMES, "readwrite", (s) => s.delete(id));

async function deleteProject(id: string): Promise<void> {
  const proj = await getProject(id);
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const t = d.transaction([S_PROJECTS, S_FRAMES], "readwrite");
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.objectStore(S_PROJECTS).delete(id);
    const frames = t.objectStore(S_FRAMES);
    for (const fid of proj?.order ?? []) frames.delete(fid);
  });
}

// ── Object-URL cache (one live set per active view) ──────────────────────────
const urls = new Map<string, string>();
async function frameUrl(id: string): Promise<string> {
  const cached = urls.get(id);
  if (cached) return cached;
  const url = URL.createObjectURL((await getFrame(id)).blob);
  urls.set(id, url);
  return url;
}
function revokeOne(id: string): void {
  const u = urls.get(id);
  if (u) {
    URL.revokeObjectURL(u);
    urls.delete(id);
  }
}
function revokeAll(): void {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const uid = (): string => crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const canvasToBlob = (c: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", QUALITY));
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── Elements ─────────────────────────────────────────────────────────────────
const galleryView = $("galleryView");
const studioView = $("studioView");
const newCartoon = $<HTMLButtonElement>("newCartoon");
const projectList = $("projectList");
const galleryEmpty = $("galleryEmpty");
const backBtn = $<HTMLButtonElement>("backBtn");
const projName = $<HTMLInputElement>("projName");
const frameCount = $("frameCount");
const preview = $<HTMLVideoElement>("preview");
const onion = $<HTMLImageElement>("onion");
const flashEl = $("flash");
const cameraFallback = $("cameraFallback");
const fallbackMsg = $("fallbackMsg");
const fallbackBtn = $<HTMLButtonElement>("fallbackBtn");
const onionToggle = $<HTMLInputElement>("onionToggle");
const shutter = $<HTMLButtonElement>("shutter");
const playBtn = $<HTMLButtonElement>("playBtn");
const filmstrip = $("filmstrip");
const frameActions = $("frameActions");
const moveLeftBtn = $<HTMLButtonElement>("moveLeft");
const moveRightBtn = $<HTMLButtonElement>("moveRight");
const deleteFrameBtn = $<HTMLButtonElement>("deleteFrame");
const fileCapture = $<HTMLInputElement>("fileCapture");
const captureCanvas = $<HTMLCanvasElement>("captureCanvas");
const playerModal = $<HTMLDialogElement>("playerModal");
const playerImg = $<HTMLImageElement>("playerImg");
const playPause = $<HTMLButtonElement>("playPause");
const fpsRange = $<HTMLInputElement>("fps");
const fpsLabel = $("fpsLabel");
const confirmModal = $<HTMLDialogElement>("confirmModal");
const confirmTitle = $("confirmTitle");
const confirmBody = $("confirmBody");
const toast = $("toast");
const toastMsg = $("toastMsg");

// ── State ────────────────────────────────────────────────────────────────────
let current: Project | null = null;
let selectedFrame: string | null = null;
let stream: MediaStream | null = null;
let pendingConfirm: (() => void | Promise<void>) | null = null;
let playUrls: string[] = [];
let playIdx = 0;
let playing = false;
let playTimer: number | undefined;

// ── Feedback ─────────────────────────────────────────────────────────────────
let toastTimer: number | undefined;
function showToast(msg: string): void {
  toastMsg.textContent = msg;
  clearTimeout(toastTimer);
  toast.classList.remove("opacity-0");
  toast.classList.add("opacity-100");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("opacity-100");
    toast.classList.add("opacity-0");
  }, 2000);
}

function flash(): void {
  if (reduceMotion) return;
  flashEl.classList.remove("opacity-0");
  flashEl.classList.add("opacity-60");
  window.setTimeout(() => {
    flashEl.classList.add("opacity-0");
    flashEl.classList.remove("opacity-60");
  }, 120);
}

function askConfirm(title: string, body: string, onYes: () => void | Promise<void>): void {
  confirmTitle.textContent = title;
  confirmBody.textContent = body;
  pendingConfirm = onYes;
  confirmModal.showModal();
}

// ── View switching ───────────────────────────────────────────────────────────
function showGallery(): void {
  galleryView.classList.remove("hidden");
  galleryView.classList.add("flex");
  studioView.classList.add("hidden");
  studioView.classList.remove("flex");
}
function showStudio(): void {
  studioView.classList.remove("hidden");
  studioView.classList.add("flex");
  galleryView.classList.add("hidden");
  galleryView.classList.remove("flex");
}

// ── Gallery ──────────────────────────────────────────────────────────────────
const PLACEHOLDER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-10 w-10 text-base-content/25" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg>`;
const TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>`;

function projectCard(p: Project): HTMLElement {
  const count = p.order.length;
  const el = document.createElement("div");
  el.className = "card relative overflow-hidden border border-base-content/10 bg-base-200 shadow-md";
  el.innerHTML = `
    <button type="button" class="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-label="Open ${esc(p.name)}">
      <span class="flex aspect-square w-full items-center justify-center bg-base-300">
        <img alt="" class="h-full w-full object-cover ${count ? "" : "hidden"}">
        ${count ? "" : PLACEHOLDER}
      </span>
      <span class="block p-3">
        <span class="block truncate font-dm text-sm font-bold">${esc(p.name)}</span>
        <span class="block font-jet text-[10px] uppercase tracking-[0.1em] text-base-content/40">${count} frame${count === 1 ? "" : "s"}</span>
      </span>
    </button>
    <button type="button" class="btn btn-circle btn-xs btn-error absolute right-2 top-2 shadow-md" aria-label="Delete ${esc(p.name)}">${TRASH}</button>`;
  const buttons = el.querySelectorAll<HTMLButtonElement>("button");
  buttons[0].addEventListener("click", () => openStudio(p.id));
  buttons[1].addEventListener("click", () =>
    askConfirm("Delete cartoon?", `“${p.name}” and all its frames will be gone for good.`, async () => {
      await deleteProject(p.id);
      await renderGallery();
      showToast("Cartoon deleted");
    })
  );
  if (count) frameUrl(p.order[0]).then((u) => el.querySelector("img")?.setAttribute("src", u));
  return el;
}

async function renderGallery(): Promise<void> {
  revokeAll();
  const projects = (await getAllProjects()).sort((a, b) => b.updatedAt - a.updatedAt);
  projectList.innerHTML = "";
  galleryEmpty.classList.toggle("hidden", projects.length > 0);
  for (const p of projects) projectList.appendChild(projectCard(p));
}

// ── Camera ───────────────────────────────────────────────────────────────────
function showFallback(msg: string): void {
  stream = null;
  preview.classList.add("hidden");
  fallbackMsg.textContent = msg;
  cameraFallback.classList.remove("hidden");
}

async function startCamera(): Promise<void> {
  cameraFallback.classList.add("hidden");
  preview.classList.remove("hidden");
  if (!navigator.mediaDevices?.getUserMedia) {
    showFallback("This browser can't open the camera. You can still add a photo below.");
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    preview.srcObject = stream;
    preview.muted = true;
    preview.playsInline = true;
    await preview.play().catch(() => {});
  } catch {
    showFallback("Allow camera access to snap drawings — or add a photo below instead.");
  }
}

function stopCamera(): void {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  preview.srcObject = null;
}

// ── Frame capture ────────────────────────────────────────────────────────────
function drawSquare(src: CanvasImageSource, w: number, h: number): boolean {
  const ctx = captureCanvas.getContext("2d");
  if (!ctx || !w || !h) return false;
  const side = Math.min(w, h);
  captureCanvas.width = TARGET;
  captureCanvas.height = TARGET;
  ctx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, TARGET, TARGET);
  return true;
}

async function storeCanvasFrame(): Promise<void> {
  const cur = current;
  if (!cur) return;
  const id = uid();
  await putFrame({ id, projectId: cur.id, blob: await canvasToBlob(captureCanvas), createdAt: Date.now() });
  cur.order.push(id);
  cur.updatedAt = Date.now();
  await putProject(cur);
  selectedFrame = null;
  await renderFilmstrip();
  filmstrip.scrollLeft = filmstrip.scrollWidth;
  updateOnion();
  flash();
  showToast("Frame captured");
}

async function capture(): Promise<void> {
  if (!stream) {
    fileCapture.click();
    return;
  }
  if (!drawSquare(preview, preview.videoWidth, preview.videoHeight)) {
    showToast("Camera not ready");
    return;
  }
  await storeCanvasFrame();
}

async function importFile(file: File): Promise<void> {
  const bmp = await createImageBitmap(file);
  const ok = drawSquare(bmp, bmp.width, bmp.height);
  bmp.close();
  if (ok) await storeCanvasFrame();
}

// ── Filmstrip ────────────────────────────────────────────────────────────────
function updateOnion(): void {
  const cur = current;
  if (!cur) return;
  const n = cur.order.length;
  if (onionToggle.checked && n > 0) {
    frameUrl(cur.order[n - 1]).then((u) => {
      onion.src = u;
      onion.classList.remove("hidden");
    });
  } else {
    onion.classList.add("hidden");
    onion.removeAttribute("src");
  }
}

function updateFrameActions(): void {
  const cur = current;
  if (!cur || selectedFrame == null) {
    frameActions.classList.add("hidden");
    return;
  }
  const i = cur.order.indexOf(selectedFrame);
  if (i < 0) {
    selectedFrame = null;
    frameActions.classList.add("hidden");
    return;
  }
  frameActions.classList.remove("hidden");
  moveLeftBtn.disabled = i <= 0;
  moveRightBtn.disabled = i >= cur.order.length - 1;
}

async function renderFilmstrip(): Promise<void> {
  const cur = current;
  if (!cur) return;
  filmstrip.innerHTML = "";
  frameCount.textContent = String(cur.order.length);
  playBtn.disabled = cur.order.length < 2;
  if (cur.order.length === 0) {
    const hint = document.createElement("p");
    hint.className = "px-1 py-4 text-sm text-base-content/40";
    hint.textContent = "No frames yet — tap the big button to snap your first drawing.";
    filmstrip.appendChild(hint);
  } else {
    cur.order.forEach((id, i) => {
      const selected = id === selectedFrame;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "relative h-16 w-16 flex-none overflow-hidden rounded-box border bg-base-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
        (selected ? "border-primary ring-2 ring-primary" : "border-base-content/10");
      btn.setAttribute("aria-label", `Frame ${i + 1}`);
      btn.setAttribute("aria-pressed", String(selected));
      btn.innerHTML = `<img alt="" class="h-full w-full object-cover"><span class="absolute bottom-0 right-0 rounded-tl-md bg-base-100/80 px-1 font-jet text-[9px] font-bold text-base-content/70">${i + 1}</span>`;
      btn.addEventListener("click", () => {
        selectedFrame = selectedFrame === id ? null : id;
        renderFilmstrip();
      });
      filmstrip.appendChild(btn);
      frameUrl(id).then((u) => btn.querySelector("img")?.setAttribute("src", u));
    });
  }
  updateFrameActions();
}

async function moveSelected(dir: -1 | 1): Promise<void> {
  const cur = current;
  if (!cur || selectedFrame == null) return;
  const i = cur.order.indexOf(selectedFrame);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cur.order.length) return;
  [cur.order[i], cur.order[j]] = [cur.order[j], cur.order[i]];
  cur.updatedAt = Date.now();
  await putProject(cur);
  await renderFilmstrip();
  updateOnion();
}

function deleteSelectedFrame(): void {
  const cur = current;
  if (!cur || selectedFrame == null) return;
  askConfirm("Delete frame?", "This drawing will be removed from the cartoon.", async () => {
    const id = selectedFrame;
    if (!cur || id == null) return;
    const i = cur.order.indexOf(id);
    if (i >= 0) cur.order.splice(i, 1);
    cur.updatedAt = Date.now();
    await putProject(cur);
    await deleteFrameRow(id);
    revokeOne(id);
    selectedFrame = null;
    await renderFilmstrip();
    updateOnion();
    showToast("Frame deleted");
  });
}

// ── Navigation ───────────────────────────────────────────────────────────────
async function openStudio(id: string): Promise<void> {
  const p = await getProject(id);
  if (!p) {
    showToast("Cartoon not found");
    await renderGallery();
    return;
  }
  revokeAll();
  current = p;
  selectedFrame = null;
  projName.value = p.name;
  showStudio();
  await renderFilmstrip();
  updateOnion();
  await startCamera();
}

async function backToGallery(): Promise<void> {
  stopCamera();
  current = null;
  selectedFrame = null;
  await renderGallery();
  showGallery();
}

// ── Playback ─────────────────────────────────────────────────────────────────
function schedulePlay(): void {
  const cur = current;
  if (!cur) return;
  clearTimeout(playTimer);
  playTimer = window.setTimeout(() => {
    if (playUrls.length === 0) return;
    playIdx = (playIdx + 1) % playUrls.length;
    playerImg.src = playUrls[playIdx];
    if (playing) schedulePlay();
  }, 1000 / cur.fps);
}
function startPlay(): void {
  playing = true;
  playPause.textContent = "Pause";
  schedulePlay();
}
function stopPlay(): void {
  playing = false;
  playPause.textContent = "Play";
  clearTimeout(playTimer);
}

async function openPlayer(): Promise<void> {
  const cur = current;
  if (!cur) return;
  if (cur.order.length < 2) {
    showToast("Add at least 2 frames to play");
    return;
  }
  playUrls = [];
  for (const id of cur.order) playUrls.push(await frameUrl(id));
  playIdx = 0;
  fpsRange.value = String(cur.fps);
  fpsLabel.textContent = `${cur.fps} fps`;
  playerImg.src = playUrls[0];
  playerModal.showModal();
  startPlay();
}

// ── Wiring ───────────────────────────────────────────────────────────────────
newCartoon.addEventListener("click", async () => {
  const count = (await getAllProjects()).length;
  const p: Project = { id: uid(), name: `Cartoon ${count + 1}`, createdAt: Date.now(), updatedAt: Date.now(), fps: 6, order: [] };
  await putProject(p);
  await openStudio(p.id);
});
backBtn.addEventListener("click", backToGallery);
projName.addEventListener("change", async () => {
  const cur = current;
  if (!cur) return;
  cur.name = projName.value.trim() || cur.name;
  projName.value = cur.name;
  cur.updatedAt = Date.now();
  await putProject(cur);
});
shutter.addEventListener("click", capture);
fallbackBtn.addEventListener("click", () => fileCapture.click());
fileCapture.addEventListener("change", async () => {
  const file = fileCapture.files?.[0];
  fileCapture.value = "";
  if (!file) return;
  try {
    await importFile(file);
  } catch {
    showToast("Couldn't read that photo");
  }
});
onionToggle.addEventListener("change", updateOnion);
playBtn.addEventListener("click", openPlayer);
moveLeftBtn.addEventListener("click", () => moveSelected(-1));
moveRightBtn.addEventListener("click", () => moveSelected(1));
deleteFrameBtn.addEventListener("click", deleteSelectedFrame);
playPause.addEventListener("click", () => (playing ? stopPlay() : startPlay()));
fpsRange.addEventListener("input", async () => {
  const cur = current;
  if (!cur) return;
  cur.fps = Number(fpsRange.value);
  fpsLabel.textContent = `${cur.fps} fps`;
  await putProject(cur);
  if (playing) schedulePlay();
});
playerModal.addEventListener("close", stopPlay);
confirmModal.addEventListener("close", async () => {
  const yes = confirmModal.returnValue === "confirm";
  confirmModal.returnValue = "";
  const fn = pendingConfirm;
  pendingConfirm = null;
  if (yes && fn) await fn();
});

// ── Init ─────────────────────────────────────────────────────────────────────
(async function init(): Promise<void> {
  await renderGallery();
  showGallery();
})();
