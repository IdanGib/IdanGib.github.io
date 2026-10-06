type Gender = "boy" | "girl";

interface Rect { x: number; y: number; width: number; height: number; }

export interface ToolbarMetrics {
  width: number;
  height: number;
  left: number;
  select: Rect;
  settings: Rect;
  endTime: Rect | null;
}

interface ShellOptions {
  onChooseDay(index: number): void;
  onEditProfile(): void;
  onSaveProfile(name: string, gender: Gender): void;
  onStartDay(): void;
  onInstall(): void;
  onDismissInstall(): void;
}

type Modal =
  | { kind: "profile"; name: string; gender: Gender | undefined; firstVisit: boolean }
  | { kind: "day"; title: string; message: string }
  | { kind: "install"; message: string; confirmLabel: string };

interface Palette {
  ink: string; strong: string; soft: string; accent: string; dark: string;
  pale: string; hover: string; page: string; dialogBorder: string; fieldBorder: string;
  surfaceBorder: string; shadow: string; strongShadow: string; backdrop: string;
}

const FONT = 'Arial, "Noto Sans Hebrew", sans-serif';
const GIRL: Palette = {
  ink: "#51425f", strong: "#5f4976", soft: "#80698f", accent: "#9d73df", dark: "#68439b",
  pale: "#f1e7ff", hover: "#f7efff", page: "#fff8fd", dialogBorder: "#ffadd2", fieldBorder: "#d8c6e8",
  surfaceBorder: "#e3d4ef", shadow: "rgba(83,52,103,.18)", strongShadow: "rgba(83,52,103,.3)", backdrop: "rgba(74,53,87,.48)",
};
const BOY: Palette = {
  ink: "#24465f", strong: "#24516f", soft: "#527087", accent: "#2789c7", dark: "#12628f",
  pale: "#dff3ff", hover: "#eaf8ff", page: "#f4fbff", dialogBorder: "#60c8dd", fieldBorder: "#afd5e8",
  surfaceBorder: "#c6e3ef", shadow: "rgba(27,83,112,.18)", strongShadow: "rgba(27,83,112,.3)", backdrop: "rgba(22,60,80,.48)",
};
const GEAR = "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915";

function optionsFor(select: HTMLSelectElement, days: string[], selectedDay: number): void {
  select.replaceChildren();
  if (days.length) {
    const placeholder = new Option("בחרו יום ✨", "");
    placeholder.disabled = true;
    select.add(placeholder);
    days.forEach((day, index) => select.add(new Option(`יום ${day}`, String(index))));
    select.value = selectedDay < 0 ? "" : String(selectedDay);
  }
}

/** Measure only the browser's intrinsic select/flex sizes; every visible pixel is drawn by Phaser. */
export function measureToolbar(
  viewportWidth: number, contentInset: number, days: string[], selectedDay: number, endsAt: string | undefined,
): ToolbarMetrics {
  const width = Math.min(1440, viewportWidth - contentInset * 2);
  const left = (viewportWidth - width) / 2;
  const root = document.createElement("div");
  root.dir = "rtl";
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = `position:fixed;left:${left}px;top:0;width:${width}px;display:flex;align-items:center;justify-content:space-between;gap:8px;font:16px ${FONT};opacity:0;pointer-events:none;z-index:-1;`;
  const select = document.createElement("select");
  select.style.cssText = `box-sizing:border-box;font:700 18px ${FONT};padding:8px 12px;border:3px solid #9d73df;border-radius:18px;`;
  optionsFor(select, days, selectedDay);
  const endTime = document.createElement("span");
  endTime.style.cssText = "box-sizing:border-box;border:2px solid #e3d4ef;padding:7px 12px;border-radius:14px;";
  endTime.append("סיום הלימודים: ");
  const output = document.createElement("output");
  output.style.fontWeight = "bold";
  output.textContent = days.length ? endsAt ?? "לא נמסרה שעת סיום" : "";
  endTime.append(output);
  if (days.length && selectedDay < 0) endTime.style.display = "none";
  const settings = document.createElement("button");
  settings.style.cssText = "box-sizing:border-box;display:inline-grid;place-items:center;width:42px;height:42px;padding:0;border:0;border-radius:14px;font:21px Arial;";
  root.append(select, endTime, settings);
  document.body.append(root);
  const rect = (node: HTMLElement): Rect => {
    const box = node.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  };
  const metrics: ToolbarMetrics = { width, height: root.getBoundingClientRect().height, left, select: rect(select), settings: rect(settings), endTime: endTime.style.display === "none" ? null : rect(endTime) };
  root.remove();
  return metrics;
}

const lineHeights = new Map<string, number>();
function normalLineHeight(size: number, bold: boolean, sample = "אבג"): number {
  const key = `${size}|${bold}|${sample}`;
  const previous = lineHeights.get(key);
  if (previous !== undefined) return previous;
  const element = document.createElement("span");
  element.textContent = sample;
  element.style.cssText = `position:fixed;top:0;left:0;display:block;white-space:pre;font:${bold ? "700" : "400"} ${size}px ${FONT};opacity:0;pointer-events:none;`;
  document.body.append(element);
  const height = element.getBoundingClientRect().height;
  element.remove();
  lineHeights.set(key, height);
  return height;
}

function font(context: CanvasRenderingContext2D, size: number, bold = false): void {
  context.font = `${bold ? "700" : "400"} ${size}px ${FONT}`;
  context.direction = "rtl";
  context.textBaseline = "alphabetic";
}

function wrapped(context: CanvasRenderingContext2D, text: string, width: number, size: number, bold = false): string[] {
  font(context, size, bold);
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

function text(
  context: CanvasRenderingContext2D, value: string | string[], x: number, y: number, size: number,
  color: string, bold = false, align: CanvasTextAlign = "center", lineHeight = normalLineHeight(size, bold),
): void {
  font(context, size, bold);
  context.textAlign = align;
  context.fillStyle = color;
  const lines = typeof value === "string" ? [value] : value;
  for (let index = 0; index < lines.length; index += 1) {
    const metrics = context.measureText(lines[index]);
    const ascent = metrics.fontBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent;
    context.fillText(lines[index], x, y + index * lineHeight + (lineHeight - ascent - descent) / 2 + ascent);
  }
}

function rounded(context: CanvasRenderingContext2D, rect: Rect, radius: number, fill: string, border?: string, borderWidth = 0): void {
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.width, rect.height, Math.min(radius, rect.width / 2, rect.height / 2));
  context.fillStyle = fill;
  context.fill();
  if (border && borderWidth) {
    context.beginPath();
    context.roundRect(rect.x + borderWidth / 2, rect.y + borderWidth / 2, rect.width - borderWidth, rect.height - borderWidth, Math.max(0, radius - borderWidth / 2));
    context.lineWidth = borderWidth;
    context.strokeStyle = border;
    context.stroke();
  }
}

/** Canvas-rendered toolbar and dialogs, with invisible native controls for accessibility and the mobile keyboard. */
export class CanvasShell {
  private readonly key: string;
  private readonly toolbarKey: string;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly toolbarTexture: Phaser.Textures.CanvasTexture;
  private readonly image: Phaser.GameObjects.Image;
  private readonly toolbarImage: Phaser.GameObjects.Image;
  private readonly toolbarRoot = document.createElement("div");
  private readonly modalRoot = document.createElement("div");
  private readonly daySelect = document.createElement("select");
  private readonly settings = document.createElement("button");
  private readonly profileForm = document.createElement("form");
  private readonly nameInput = document.createElement("input");
  private readonly boys = document.createElement("input");
  private readonly girls = document.createElement("input");
  private readonly saveProfile = document.createElement("button");
  private readonly cancelProfile = document.createElement("button");
  private readonly startDay = document.createElement("button");
  private readonly install = document.createElement("button");
  private readonly dismissInstall = document.createElement("button");
  private readonly modalTitle = document.createElement("h2");
  private readonly modalMessage = document.createElement("p");
  private toolbarObjects: Phaser.GameObjects.GameObject[] = [];
  private modalObjects: Phaser.GameObjects.GameObject[] = [];
  private toolbar: { viewportWidth: number; contentInset: number; top: number; days: string[]; selectedDay: number; endsAt: string | undefined } | null = null;
  private currentModal: Modal | null = null;
  private palette = GIRL;
  private viewportWidth = window.innerWidth;
  private viewportHeight = window.innerHeight;
  private dropdownOpen = false;
  private dayDisabled = false;
  private toolbarTargets: Record<string, Rect> = {};
  private modalTargets: Record<string, Rect> = {};
  private modalPanel: Rect | null = null;
  private focused: HTMLElement | null = null;
  private hovered = "";
  private preserveHitAreas = false;
  private caretVisible = true;
  private readonly caretTimer: number;
  private backdrop: HTMLCanvasElement | null = null;
  private modalGeneration = 0;
  private previousFocus: HTMLElement | null = null;
  private previousKeyboardState: { element: HTMLElement; inert: boolean; ariaHidden: string | null } | null = null;
  private readonly keyHandler: (event: KeyboardEvent) => void;
  private readonly pointerHandler: (event: PointerEvent) => void;

  constructor(private readonly scene: Phaser.Scene, private readonly resolution: number, private readonly options: ShellOptions) {
    this.key = `magic-bag-modal-${Math.random().toString(36).slice(2)}`;
    this.toolbarKey = `${this.key}-toolbar`;
    this.texture = scene.textures.createCanvas(this.key, 1, 1)!;
    this.toolbarTexture = scene.textures.createCanvas(this.toolbarKey, 1, 1)!;
    this.image = scene.add.image(0, 0, this.key).setOrigin(0, 0).setDepth(200).setVisible(false);
    this.toolbarImage = scene.add.image(0, 0, this.toolbarKey).setOrigin(0, 0).setDepth(100);
    this.setupBridges();
    this.keyHandler = (event) => this.handleKey(event);
    this.pointerHandler = (event) => {
      if (this.dropdownOpen && event.target !== this.daySelect) {
        const bounds = this.toolbar ? measureToolbar(this.toolbar.viewportWidth, this.toolbar.contentInset, this.toolbar.days, this.toolbar.selectedDay, this.toolbar.endsAt).select : null;
        if (bounds && (event.clientX < bounds.x || event.clientX > bounds.x + bounds.width || event.clientY < this.toolbar!.top + bounds.y || event.clientY > this.toolbar!.top + bounds.y + bounds.height + (this.toolbar!.days.length + 1) * 40)) {
          this.dropdownOpen = false;
          this.redrawToolbar();
        }
      }
    };
    document.addEventListener("keydown", this.keyHandler, true);
    document.addEventListener("pointerdown", this.pointerHandler, true);
    this.caretTimer = window.setInterval(() => {
      if (this.currentModal?.kind === "profile" && document.activeElement === this.nameInput) {
        this.caretVisible = !this.caretVisible;
        this.redrawModal();
      }
    }, 500);
  }

  get modalOpen(): boolean { return this.currentModal !== null; }

  get toolbarMetrics(): ToolbarMetrics | null {
    if (!this.toolbar) return null;
    const { viewportWidth, contentInset, days, selectedDay, endsAt, top } = this.toolbar;
    const result = measureToolbar(viewportWidth, contentInset, days, selectedDay, endsAt);
    return { ...result, select: { ...result.select, y: result.select.y + top }, settings: { ...result.settings, y: result.settings.y + top }, endTime: result.endTime && { ...result.endTime, y: result.endTime.y + top } };
  }

  get modalMetrics(): { panel: Rect; controls: Record<string, Rect> } | null {
    return this.currentModal && this.modalPanel ? { panel: { ...this.modalPanel }, controls: { ...this.modalTargets } } : null;
  }

  get hitTargets(): Record<string, Rect> { return { ...this.toolbarTargets, ...this.modalTargets }; }

  setDayDisabled(disabled: boolean): void {
    this.dayDisabled = disabled;
    this.daySelect.disabled = disabled || this.modalOpen;
    if (disabled) this.dropdownOpen = false;
    this.redrawToolbar();
  }

  drawToolbar(viewportWidth: number, contentInset: number, toolbarTop: number, days: string[], selectedDay: number, endsAt: string | undefined, gender: Gender): void {
    this.palette = gender === "boy" ? BOY : GIRL;
    this.viewportWidth = viewportWidth;
    this.toolbar = { viewportWidth, contentInset, top: toolbarTop, days, selectedDay, endsAt };
    optionsFor(this.daySelect, days, selectedDay);
    this.redrawToolbar();
    if (this.currentModal) this.redrawModal(false);
  }

  openProfile(name: string, gender: Gender | undefined, firstVisit: boolean): void {
    this.openModal({ kind: "profile", name, gender, firstVisit });
    this.nameInput.value = name;
    this.boys.checked = gender === "boy";
    this.girls.checked = gender === "girl";
    this.cancelProfile.hidden = firstVisit;
    this.redrawModal();
    requestAnimationFrame(() => {
      if (this.currentModal?.kind === "profile") this.nameInput.focus({ preventScroll: true });
    });
  }

  openDayStart(title: string, message: string): void {
    this.openModal({ kind: "day", title, message });
    requestAnimationFrame(() => {
      if (this.currentModal?.kind === "day") this.startDay.focus({ preventScroll: true });
    });
  }

  openInstall(message: string, confirmLabel: string): void {
    this.openModal({ kind: "install", message, confirmLabel });
    requestAnimationFrame(() => {
      if (this.currentModal?.kind === "install") this.install.focus({ preventScroll: true });
    });
  }

  closeModal(): void {
    this.currentModal = null;
    this.modalGeneration += 1;
    this.modalRoot.hidden = true;
    this.image.setVisible(false);
    this.clearObjects(this.modalObjects);
    this.daySelect.disabled = this.dayDisabled;
    this.settings.disabled = false;
    this.nameInput.blur();
    this.focused = null;
    this.backdrop = null;
    this.modalPanel = null;
    this.modalTargets = {};
    this.hovered = "";
    this.redrawToolbar();
    this.restoreBackgroundControls();
    const previousFocus = this.previousFocus;
    this.previousFocus = null;
    requestAnimationFrame(() => {
      if (!this.modalOpen && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    });
  }

  onResize(viewportWidth: number, viewportHeight: number): void {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    if (this.toolbar) this.toolbar.viewportWidth = viewportWidth;
    this.redrawToolbar();
    if (this.currentModal) this.redrawModal(false);
  }

  destroy(): void {
    window.clearInterval(this.caretTimer);
    document.removeEventListener("keydown", this.keyHandler, true);
    document.removeEventListener("pointerdown", this.pointerHandler, true);
    this.clearObjects(this.toolbarObjects);
    this.clearObjects(this.modalObjects);
    this.image.destroy();
    this.toolbarImage.destroy();
    this.scene.textures.remove(this.key);
    this.scene.textures.remove(this.toolbarKey);
    this.toolbarRoot.remove();
    this.modalRoot.remove();
    this.modalGeneration += 1;
    this.restoreBackgroundControls();
  }

  private setupBridges(): void {
    for (const root of [this.toolbarRoot, this.modalRoot]) {
      root.dir = "rtl";
      root.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;opacity:0;pointer-events:none;";
      document.body.append(root);
    }
    this.toolbarRoot.setAttribute("aria-label", "אפשרויות תיק הקסם");
    this.daySelect.id = "school-day";
    this.daySelect.setAttribute("aria-label", "יום הלימודים");
    this.daySelect.addEventListener("change", () => {
      const index = Number(this.daySelect.value);
      if (this.daySelect.value !== "") {
        this.dropdownOpen = false;
        this.options.onChooseDay(index);
      }
    });
    this.daySelect.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (!this.modalOpen && !this.dayDisabled) {
        this.daySelect.focus({ preventScroll: true });
        this.dropdownOpen = !this.dropdownOpen;
        this.redrawToolbar();
      }
    });
    this.daySelect.addEventListener("mousedown", (event) => event.preventDefault());
    this.daySelect.addEventListener("click", (event) => {
      event.preventDefault();
      if (event.detail === 0 && !this.modalOpen && !this.dayDisabled) { this.dropdownOpen = !this.dropdownOpen; this.redrawToolbar(); }
    });
    this.daySelect.addEventListener("keydown", (event) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (!this.modalOpen && !this.dayDisabled) { this.dropdownOpen = !this.dropdownOpen; this.redrawToolbar(); }
      }
    });
    this.settings.id = "open-settings";
    this.settings.type = "button";
    this.settings.setAttribute("aria-label", "הגדרות ילד או ילדה");
    this.settings.addEventListener("click", () => this.options.onEditProfile());
    this.toolbarRoot.append(this.daySelect, this.settings);
    this.modalRoot.setAttribute("role", "dialog");
    this.modalRoot.setAttribute("aria-modal", "true");
    this.modalRoot.setAttribute("aria-labelledby", `${this.key}-title`);
    this.modalRoot.setAttribute("aria-describedby", `${this.key}-message`);
    this.modalTitle.id = `${this.key}-title`;
    this.modalMessage.id = `${this.key}-message`;
    this.profileForm.id = "profile-form";
    this.profileForm.noValidate = true;
    this.nameInput.id = "kid-name";
    this.nameInput.name = "kidName";
    this.nameInput.type = "text";
    this.nameInput.maxLength = 30;
    this.nameInput.autocomplete = "name";
    this.nameInput.required = true;
    this.nameInput.setAttribute("aria-label", "שם הילד או הילדה");
    this.nameInput.addEventListener("input", () => {
      if (this.currentModal?.kind === "profile") {
        this.currentModal.name = this.nameInput.value;
        this.caretVisible = true;
        this.redrawModal();
      }
    });
    this.nameInput.addEventListener("select", () => this.redrawModal());
    for (const [radio, value, label] of [[this.boys, "boy", "👦 ילד"], [this.girls, "girl", "👧 ילדה"]] as const) {
      radio.type = "radio";
      radio.name = "gender";
      radio.value = value;
      radio.required = true;
      radio.setAttribute("aria-label", label);
      radio.addEventListener("change", () => {
        if (radio.checked && this.currentModal?.kind === "profile") { this.currentModal.gender = value; this.redrawModal(); }
      });
    }
    this.saveProfile.type = "submit";
    this.saveProfile.className = "save-profile";
    this.saveProfile.textContent = "מתחילים ✨";
    this.profileForm.addEventListener("submit", (event) => { event.preventDefault(); this.submitProfile(); });
    this.cancelProfile.id = "cancel-settings";
    this.cancelProfile.type = "button";
    this.cancelProfile.textContent = "ביטול";
    this.cancelProfile.addEventListener("click", () => this.closeModal());
    this.profileForm.append(this.nameInput, this.boys, this.girls, this.saveProfile, this.cancelProfile);
    this.startDay.id = "day-start-button";
    this.startDay.type = "button";
    this.startDay.textContent = "בואו נתחיל ✨";
    this.startDay.addEventListener("click", () => this.options.onStartDay());
    this.install.id = "install-app";
    this.install.type = "button";
    this.install.addEventListener("click", () => this.options.onInstall());
    this.dismissInstall.id = "dismiss-install";
    this.dismissInstall.type = "button";
    this.dismissInstall.textContent = "לא עכשיו";
    this.dismissInstall.addEventListener("click", () => this.options.onDismissInstall());
    this.modalRoot.append(this.modalTitle, this.modalMessage, this.profileForm, this.startDay, this.install, this.dismissInstall);
    for (const control of [this.daySelect, this.settings, this.nameInput, this.boys, this.girls, this.saveProfile, this.cancelProfile, this.startDay, this.install, this.dismissInstall]) {
      control.style.cssText = "position:fixed;width:1px;height:1px;padding:0;border:0;opacity:0;pointer-events:auto;font-size:16px;";
      control.addEventListener("focus", () => { this.focused = control; this.redrawToolbar(); this.redrawModal(); });
      control.addEventListener("blur", () => { if (this.focused === control) this.focused = null; this.redrawToolbar(); this.redrawModal(); });
    }
    this.modalTitle.style.cssText = this.modalMessage.style.cssText = "position:fixed;width:1px;height:1px;overflow:hidden;";
    this.modalRoot.hidden = true;
  }

  private submitProfile(): void {
    if (this.currentModal?.kind !== "profile") return;
    const name = this.nameInput.value.trim();
    const gender = this.boys.checked ? "boy" : this.girls.checked ? "girl" : undefined;
    if (!name) { this.nameInput.focus({ preventScroll: true }); return; }
    if (!gender) { this.boys.focus({ preventScroll: true }); return; }
    this.options.onSaveProfile(name, gender);
  }

  private handleKey(event: KeyboardEvent): void {
    if (this.currentModal) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (this.currentModal.kind === "install") this.options.onDismissInstall();
        else if (this.currentModal.kind === "profile" && !this.currentModal.firstVisit) this.closeModal();
      } else if (event.key === "Tab") {
        const controls = this.currentModal.kind === "profile"
          ? [this.nameInput, this.currentModal.gender === "girl" ? this.girls : this.boys, this.saveProfile, ...this.currentModal.firstVisit ? [] : [this.cancelProfile]]
          : this.currentModal.kind === "day" ? [this.startDay] : [this.install, this.dismissInstall];
        const index = controls.indexOf(document.activeElement as HTMLInputElement | HTMLButtonElement);
        const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        controls[next].focus({ preventScroll: true });
        event.preventDefault();
        event.stopPropagation();
      } else if (event.key === "Enter" && document.activeElement === this.nameInput) {
        event.preventDefault();
        this.submitProfile();
      }
    } else if (event.key === "Escape" && this.dropdownOpen) {
      event.preventDefault();
      this.dropdownOpen = false;
      this.redrawToolbar();
    }
  }

  private openModal(modal: Modal): void {
    if (!this.currentModal) {
      this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const controls = document.getElementById("keyboard-controls");
      if (controls) {
        this.previousKeyboardState = { element: controls, inert: controls.inert, ariaHidden: controls.getAttribute("aria-hidden") };
        controls.inert = true;
        controls.setAttribute("aria-hidden", "true");
      }
    }
    this.currentModal = modal;
    this.modalGeneration += 1;
    this.dropdownOpen = false;
    this.hovered = "";
    this.daySelect.disabled = true;
    this.settings.disabled = true;
    this.profileForm.hidden = modal.kind !== "profile";
    this.startDay.hidden = modal.kind !== "day";
    this.install.hidden = this.dismissInstall.hidden = modal.kind !== "install";
    this.modalTitle.textContent = modal.kind === "profile" ? "למי מכינים את תיק הקסם?" : modal.kind === "day" ? modal.title : "רוצים להגיע ישר לתיק הקסם?";
    this.modalMessage.textContent = modal.kind === "profile" ? "שם הילד או הילדה. איך לפנות אליך?" : modal.message;
    if (modal.kind === "install") this.install.textContent = modal.confirmLabel;
    this.modalRoot.hidden = false;
    this.image.setVisible(false);
    this.clearObjects(this.modalObjects);
    this.modalTargets = {};
    this.redrawToolbar();
    this.captureBackdrop();
    this.redrawModal();
  }

  private restoreBackgroundControls(): void {
    const state = this.previousKeyboardState;
    if (!state) return;
    state.element.inert = state.inert;
    if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
    else state.element.setAttribute("aria-hidden", state.ariaHidden);
    this.previousKeyboardState = null;
  }

  private captureBackdrop(): void {
    const canvas = document.createElement("canvas");
    canvas.width = this.scene.game.canvas.width;
    canvas.height = this.scene.game.canvas.height;
    canvas.getContext("2d")!.drawImage(this.scene.game.canvas, 0, 0);
    this.backdrop = canvas;
    const generation = this.modalGeneration;
    // Phaser snapshots after rendering, so temporarily hide only this overlay for that frame.
    this.image.setVisible(false);
    this.scene.game.renderer.snapshot((snapshot: HTMLImageElement) => {
      if (generation !== this.modalGeneration || !this.currentModal) return;
      const context = canvas.getContext("2d")!;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(snapshot, 0, 0, canvas.width, canvas.height);
      this.backdrop = canvas;
      this.redrawModal();
    });
    this.scene.events.once("postupdate", () => {
      if (generation === this.modalGeneration && this.currentModal) this.image.setVisible(false);
    });
  }

  private clearObjects(objects: Phaser.GameObjects.GameObject[]): void {
    for (const object of objects) object.destroy();
    objects.length = 0;
  }

  private hit(rect: Rect, action: () => void, objects: Phaser.GameObjects.GameObject[], name = "", depth = 210): void {
    if (this.preserveHitAreas) return;
    if (name) (objects === this.modalObjects ? this.modalTargets : this.toolbarTargets)[name] = { ...rect };
    const area = this.scene.add.rectangle(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height, 0, 0).setDepth(depth).setInteractive({ useHandCursor: Boolean(name) });
    area.on("pointerdown", action);
    if (name) {
      // Hover only repaints the texture. Preserve input objects while Phaser dispatches its events.
      area.on("pointerover", () => {
        if (this.hovered === name) return;
        this.hovered = name;
        this.currentModal ? this.redrawModal(true) : this.redrawToolbar(true);
      });
      area.on("pointerout", () => {
        if (this.hovered !== name) return;
        this.hovered = "";
        this.currentModal ? this.redrawModal(true) : this.redrawToolbar(true);
      });
    }
    objects.push(area);
  }

  private positionBridge(control: HTMLElement, rect: Rect): void {
    control.style.left = `${rect.x + rect.width / 2}px`;
    control.style.top = `${rect.y + rect.height / 2}px`;
  }

  private focusRing(context: CanvasRenderingContext2D, rect: Rect, radius: number, control: HTMLElement): void {
    if (this.focused !== control || !control.matches(":focus-visible")) return;
    context.beginPath();
    context.roundRect(rect.x - 4.5, rect.y - 4.5, rect.width + 9, rect.height + 9, radius + 4.5);
    context.strokeStyle = this.palette.dark;
    context.lineWidth = 3;
    context.stroke();
  }

  private redrawToolbar(preserveHitAreas = false): void {
    if (!this.toolbar) return;
    this.preserveHitAreas = preserveHitAreas;
    const { viewportWidth, contentInset, top, days, selectedDay, endsAt } = this.toolbar;
    const metrics = measureToolbar(viewportWidth, contentInset, days, selectedDay, endsAt);
    const textureHeight = top + metrics.height + (this.dropdownOpen ? (days.length + 1) * 40 + 16 : 35);
    this.toolbarTexture.setSize(Math.max(1, Math.ceil(viewportWidth * this.resolution)), Math.max(1, Math.ceil(textureHeight * this.resolution)));
    const context = this.toolbarTexture.context;
    context.setTransform(this.resolution, 0, 0, this.resolution, 0, 0);
    context.clearRect(0, 0, viewportWidth, textureHeight);
    if (!preserveHitAreas) {
      this.clearObjects(this.toolbarObjects);
      this.toolbarTargets = {};
    }
    const palette = this.palette;
    const selectHovered = this.hovered === "day-select";
    const select = { ...metrics.select, y: metrics.select.y + top - (selectHovered ? 1 : 0) };
    const settings = { ...metrics.settings, y: metrics.settings.y + top };
    context.save();
    context.shadowColor = palette.shadow;
    context.shadowOffsetY = (selectHovered ? 9 : 6) * this.resolution;
    context.shadowBlur = (selectHovered ? 22 : 18) * this.resolution;
    rounded(context, select, 18, "#fff");
    context.restore();
    rounded(context, select, 18, "#fff", palette.accent, 3);
    if (days.length) {
      const label = selectedDay < 0 ? "בחרו יום ✨" : `יום ${days[selectedDay]}`;
      const lineHeight = normalLineHeight(18, true, label);
      text(context, label, select.x + select.width - 15, select.y + (select.height - lineHeight) / 2, 18, palette.strong, true, "right", lineHeight);
    }
    context.fillStyle = "#222";
    context.beginPath();
    context.moveTo(select.x + 10, select.y + select.height / 2 - 2);
    context.lineTo(select.x + 17, select.y + select.height / 2 - 2);
    context.lineTo(select.x + 13.5, select.y + select.height / 2 + 2);
    context.fill();
    rounded(context, settings, 14, this.hovered === "settings" ? palette.hover : "#fff");
    context.save();
    context.translate(settings.x + (settings.width - 24) / 2, settings.y + 9);
    context.strokeStyle = palette.strong;
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke(new Path2D(GEAR));
    context.beginPath();
    context.arc(12, 12, 3, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    if (metrics.endTime) this.paintEndTime(context, { ...metrics.endTime, y: metrics.endTime.y + top }, days.length ? endsAt ?? "לא נמסרה שעת סיום" : "");
    this.positionBridge(this.daySelect, select);
    this.positionBridge(this.settings, settings);
    this.focusRing(context, select, 18, this.daySelect);
    this.focusRing(context, settings, 14, this.settings);
    if (!this.modalOpen) {
      if (!this.dayDisabled) this.hit(select, () => { this.daySelect.focus({ preventScroll: true }); this.dropdownOpen = !this.dropdownOpen; this.redrawToolbar(); }, this.toolbarObjects, "day-select", 110);
      this.hit(settings, () => { this.settings.focus({ preventScroll: true }); this.options.onEditProfile(); }, this.toolbarObjects, "settings", 110);
    }
    if (this.dropdownOpen && !this.modalOpen && !this.dayDisabled) {
      const popup = { x: select.x, y: select.y + select.height + 6, width: select.width, height: (days.length + 1) * 40 };
      context.save();
      context.shadowColor = palette.strongShadow;
      context.shadowBlur = 20 * this.resolution;
      context.shadowOffsetY = 8 * this.resolution;
      rounded(context, popup, 14, "#fff");
      context.restore();
      rounded(context, popup, 14, "#fff", palette.fieldBorder, 2);
      ["בחרו יום ✨", ...days.map((day) => `יום ${day}`)].forEach((label, row) => {
        const rect = { x: popup.x + 3, y: popup.y + row * 40 + 2, width: popup.width - 6, height: 36 };
        if (row - 1 === selectedDay || this.hovered === `day-${row}`) rounded(context, rect, 10, palette.pale);
        text(context, label, rect.x + rect.width - 12, rect.y + 7, 18, row ? palette.strong : palette.soft, true, "right");
        if (row) this.hit(rect, () => { this.dropdownOpen = false; this.daySelect.value = String(row - 1); this.options.onChooseDay(row - 1); }, this.toolbarObjects, `day-${row}`, 120);
      });
    }
    this.toolbarTexture.refresh();
    this.toolbarImage.setDisplaySize(viewportWidth, textureHeight);
    this.preserveHitAreas = false;
  }

  private paintEndTime(context: CanvasRenderingContext2D, rect: Rect, end: string): void {
    const palette = this.palette;
    rounded(context, rect, 14, "#fff", palette.surfaceBorder, 2);
    const prefix = "סיום הלימודים:";
    const width = rect.width - 28;
    font(context, 16);
    const prefixWidth = context.measureText(prefix).width;
    const spaceWidth = context.measureText(" ").width;
    font(context, 16, true);
    const endWidth = context.measureText(end).width;
    const right = rect.x + rect.width - 14;
    if (prefixWidth + spaceWidth + endWidth <= width + .1) {
      text(context, prefix, right, rect.y + 9, 16, palette.strong, false, "right");
      text(context, end, right - prefixWidth - spaceWidth - endWidth, rect.y + 9, 16, palette.ink, true, "left");
    } else {
      text(context, prefix, right, rect.y + 9, 16, palette.strong, false, "right");
      text(context, wrapped(context, end, width, 16, true), right, rect.y + 27, 16, palette.ink, true, "right", 18);
    }
  }

  private redrawModal(preserveHitAreas = this.modalObjects.length > 0): void {
    if (!this.currentModal) return;
    this.preserveHitAreas = preserveHitAreas;
    const width = this.viewportWidth;
    const height = this.viewportHeight;
    this.texture.setSize(Math.max(1, Math.ceil(width * this.resolution)), Math.max(1, Math.ceil(height * this.resolution)));
    const context = this.texture.context;
    context.setTransform(this.resolution, 0, 0, this.resolution, 0, 0);
    context.clearRect(0, 0, width, height);
    if (this.backdrop) {
      context.save();
      context.filter = `blur(${(this.currentModal.kind === "profile" ? 5 : 7) * this.resolution}px)`;
      context.drawImage(this.backdrop, 0, 0, width, height);
      context.restore();
    }
    context.fillStyle = this.palette.backdrop;
    context.fillRect(0, 0, width, height);
    if (!preserveHitAreas) {
      this.clearObjects(this.modalObjects);
      this.modalTargets = {};
    }
    this.hit({ x: 0, y: 0, width, height }, () => {}, this.modalObjects, "", 205);
    if (this.currentModal.kind === "profile") this.paintProfile(context, this.currentModal);
    else if (this.currentModal.kind === "day") this.paintDayStart(context, this.currentModal);
    else this.paintInstall(context, this.currentModal);
    this.texture.refresh();
    this.image.setDisplaySize(width, height).setVisible(true);
    this.preserveHitAreas = false;
  }

  private panel(context: CanvasRenderingContext2D, width: number, height: number): Rect {
    const rect = { x: (this.viewportWidth - width) / 2, y: Math.max(0, (this.viewportHeight - height) / 2), width, height };
    context.save();
    context.shadowColor = this.palette.strongShadow;
    context.shadowOffsetY = 28 * this.resolution;
    context.shadowBlur = 80 * this.resolution;
    rounded(context, rect, 36, "#fff");
    context.restore();
    rounded(context, rect, 36, "#fff", this.palette.dialogBorder, 4);
    this.modalPanel = rect;
    return rect;
  }

  private button(context: CanvasRenderingContext2D, rect: Rect, label: string, size: number, control: HTMLButtonElement, action: () => void, name: string, pale = false, shadow = false): void {
    const palette = this.palette;
    const hovered = name === "start" && this.hovered === name;
    const visual = hovered ? { ...rect, y: rect.y - 1 } : rect;
    const fill = pale ? palette.pale : hovered ? `#${[1, 3, 5].map((offset) => Math.min(255, Math.round(parseInt(palette.accent.slice(offset, offset + 2), 16) * 1.06)).toString(16).padStart(2, "0")).join("")}` : palette.accent;
    context.save();
    if (shadow) { context.shadowColor = `${palette.accent}4d`; context.shadowOffsetY = 8 * this.resolution; context.shadowBlur = 20 * this.resolution; }
    rounded(context, visual, 999, fill);
    context.restore();
    const lineHeight = normalLineHeight(size, true, label);
    const lines = wrapped(context, label, rect.width - 12, size, true);
    text(context, lines, visual.x + visual.width / 2, visual.y + (visual.height - lineHeight * lines.length) / 2, size, pale ? palette.strong : "#fff", true, "center", lineHeight);
    this.positionBridge(control, visual);
    this.focusRing(context, visual, visual.height / 2, control);
    this.hit(rect, action, this.modalObjects, name);
  }

  private paintProfile(context: CanvasRenderingContext2D, modal: Extract<Modal, { kind: "profile" }>): void {
    const width = Math.min(440, this.viewportWidth - 38);
    const contentWidth = width - 68;
    const iconHeight = normalLineHeight(48, false, "✨🎒✨");
    const titleLines = wrapped(context, "למי מכינים את תיק הקסם?", contentWidth, 30, true);
    const titleLineHeight = normalLineHeight(30, true);
    const saveHeight = normalLineHeight(18, true, "מתחילים ✨") + 26;
    const cancelHeight = normalLineHeight(16, false) + 2;
    const height = 68 + iconHeight + titleLines.length * titleLineHeight + 72 + 100 + saveHeight + 88 + (modal.firstVisit ? 0 : cancelHeight + 22);
    const panel = this.panel(context, width, height);
    const center = this.viewportWidth / 2;
    const left = panel.x + 34;
    let top = panel.y + 34;
    text(context, "✨🎒✨", center, top, 48, this.palette.ink, false, "center", iconHeight);
    top += iconHeight + 22;
    text(context, titleLines, center, top, 30, this.palette.strong, true, "center", titleLineHeight);
    top += titleLines.length * titleLineHeight + 22;
    text(context, "שם הילד או הילדה", left + contentWidth, top, 16, this.palette.ink, true, "right");
    const input = { x: left, y: top + 26, width: contentWidth, height: 46 };
    rounded(context, input, 14, "#fff", this.palette.fieldBorder, 2);
    context.save();
    context.beginPath();
    context.rect(input.x + 16, input.y + 2, input.width - 32, input.height - 4);
    context.clip();
    text(context, modal.name, input.x + input.width - 16, input.y + 14, 16, this.palette.ink, true, "right");
    if (document.activeElement === this.nameInput && this.caretVisible) {
      font(context, 16, true);
      const hasHebrew = /^[^A-Za-z\u0590-\u05ff]*[\u0590-\u05ff]/.test(modal.name);
      const caretX = input.x + input.width - 16 - (hasHebrew ? context.measureText(modal.name.slice(0, this.nameInput.selectionStart ?? modal.name.length)).width : 0);
      context.fillStyle = this.palette.ink;
      context.fillRect(Math.max(input.x + 16, caretX), input.y + 14, 1, 18);
    }
    context.restore();
    this.positionBridge(this.nameInput, input);
    this.focusRing(context, input, 14, this.nameInput);
    this.hit(input, () => this.nameInput.focus({ preventScroll: true }), this.modalObjects, "name");
    top += 72 + 22;
    // The original fieldset legend keeps the browser's 2px inline padding.
    text(context, "איך לפנות אליך?", left + contentWidth - 2, top, 16, this.palette.ink, true, "right");
    const optionWidth = (contentWidth - 12) / 2;
    for (const [gender, label, control, x] of [["boy", "👦 ילד", this.boys, left + optionWidth + 12], ["girl", "👧 ילדה", this.girls, left]] as const) {
      const rect = { x, y: top + 28, width: optionWidth, height: 72 };
      const checked = modal.gender === gender;
      if (checked) {
        context.save();
        context.beginPath();
        context.roundRect(rect.x - 1, rect.y - 1, rect.width + 2, rect.height + 2, 19);
        context.strokeStyle = `${this.palette.accent}29`;
        context.lineWidth = 2;
        context.stroke();
        context.restore();
      }
      rounded(context, rect, 18, checked ? this.palette.pale : this.palette.page, checked ? this.palette.accent : this.palette.fieldBorder, 2);
      const lineHeight = normalLineHeight(18, true, label);
      text(context, label, rect.x + rect.width / 2, rect.y + (72 - lineHeight) / 2, 18, this.palette.ink, true, "center", lineHeight);
      this.positionBridge(control, rect);
      this.focusRing(context, rect, 18, control);
      this.hit(rect, () => { control.checked = true; control.dispatchEvent(new Event("change", { bubbles: true })); control.focus({ preventScroll: true }); }, this.modalObjects, gender);
    }
    top += 100 + 22;
    this.button(context, { x: left, y: top, width: contentWidth, height: saveHeight }, "מתחילים ✨", 18, this.saveProfile, () => this.submitProfile(), "save");
    if (!modal.firstVisit) {
      top += saveHeight + 22;
      const rect = { x: left, y: top, width: contentWidth, height: cancelHeight };
      text(context, "ביטול", center, top + 1, 16, this.palette.strong);
      this.positionBridge(this.cancelProfile, rect);
      this.focusRing(context, rect, 0, this.cancelProfile);
      this.hit(rect, () => this.closeModal(), this.modalObjects, "cancel");
    }
  }

  private paintDayStart(context: CanvasRenderingContext2D, modal: Extract<Modal, { kind: "day" }>): void {
    const width = Math.min(500, this.viewportWidth - 38);
    const contentWidth = width - 68;
    const titleSize = Math.max(28, Math.min(38, this.viewportWidth * .07));
    const titleLineHeight = normalLineHeight(titleSize, true);
    const titleLines = wrapped(context, modal.title, contentWidth, titleSize, true);
    const messageLines = wrapped(context, modal.message, contentWidth, 20);
    const height = 72 + 64 + titleLines.length * titleLineHeight + messageLines.length * 30 + 54 + 4 + 64;
    const panel = this.panel(context, width, height);
    const center = this.viewportWidth / 2;
    let top = panel.y + 38;
    text(context, "✨🎒✨", center, top, 64, this.palette.ink, false, "center", 64);
    top += 64 + 18;
    text(context, titleLines, center, top, titleSize, this.palette.strong, true, "center", titleLineHeight);
    top += titleLines.length * titleLineHeight + 18;
    text(context, messageLines, center, top, 20, this.palette.soft, false, "center", 30);
    top += messageLines.length * 30 + 22;
    this.button(context, { x: panel.x + 34, y: top, width: contentWidth, height: 64 }, "בואו נתחיל ✨", 24, this.startDay, () => this.options.onStartDay(), "start", false, true);
  }

  private paintInstall(context: CanvasRenderingContext2D, modal: Extract<Modal, { kind: "install" }>): void {
    const width = Math.min(440, this.viewportWidth - 38);
    const contentWidth = width - 68;
    const titleLines = wrapped(context, "רוצים להגיע ישר לתיק הקסם?", contentWidth, 28, true);
    const titleLineHeight = normalLineHeight(28, true);
    const messageLines = wrapped(context, modal.message, contentWidth, 18);
    const height = 68 + 64 + titleLines.length * titleLineHeight + messageLines.length * 27 + 48 + 50;
    const panel = this.panel(context, width, height);
    const center = this.viewportWidth / 2;
    let top = panel.y + 34;
    text(context, "📲", center, top, 64, this.palette.ink, false, "center", 64);
    top += 64 + 16;
    text(context, titleLines, center, top, 28, this.palette.strong, true, "center", titleLineHeight);
    top += titleLines.length * titleLineHeight + 16;
    text(context, messageLines, center, top, 18, this.palette.soft, false, "center", 27);
    top += messageLines.length * 27 + 16;
    const buttonWidth = (contentWidth - 10) / 2;
    this.button(context, { x: panel.x + 34 + buttonWidth + 10, y: top, width: buttonWidth, height: 50 }, modal.confirmLabel, 16, this.install, () => this.options.onInstall(), "install");
    this.button(context, { x: panel.x + 34, y: top, width: buttonWidth, height: 50 }, "לא עכשיו", 16, this.dismissInstall, () => this.options.onDismissInstall(), "dismiss", true);
  }
}
