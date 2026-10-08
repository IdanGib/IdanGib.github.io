import { MONSTER, MonsterBag, preloadMonster } from "./monster-bag";
import {
  packingListFor,
  resolveMediaUrl,
  validateSchoolData,
  type PackingItem,
  type SchoolData,
} from "./school-data";

type Gender = "boy" | "girl";
interface Profile { name: string; gender: Gender }
type CardPhase = "ready" | "dragging" | "returning" | "packing" | "packed";
interface CardState {
  item: PackingItem;
  container: Phaser.GameObjects.Container;
  button: HTMLButtonElement;
  phase: CardPhase;
  prepared?: boolean;
  homeX: number;
  homeY: number;
  dragOffsetX: number;
  dragOffsetY: number;
}
interface PendingDrag { card: CardState; pointerId: number; x: number; y: number }
interface SceneRestartData { packedIds?: string[] }
interface Point { x: number; y: number }
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredInstallPrompt: InstallPromptEvent | null = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event as InstallPromptEvent;
});

const GIRL_PALETTE = {
  page: "#fff8fd", pageNumber: 0xfff8fd, blobOne: 0xffd9eb,
  blobTwo: 0xded7ff, sparkleOne: "#e5b6d1", sparkleTwo: "#bfb4ee",
  heading: "#5f4976", copy: "#7f6d92", label: "#745c87",
  overlay: 0x4a3557, dialogBorder: 0xffadd2, dialogTitle: "#72548b",
  dialogCopy: "#927ba1", accent: 0x9d73df,
};

const BOY_PALETTE: typeof GIRL_PALETTE = {
  page: "#f4fbff", pageNumber: 0xf4fbff, blobOne: 0xcdefff,
  blobTwo: 0xd5e6ff, sparkleOne: "#79c9e6", sparkleTwo: "#8faee5",
  heading: "#24516f", copy: "#527087", label: "#31647f",
  overlay: 0x163c50, dialogBorder: 0x60c8dd, dialogTitle: "#24516f",
  dialogCopy: "#527087", accent: 0x2789c7,
};

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as T;
}

      (async () => {
        const appLifetime = new AbortController();
        const PROFILE_STORAGE_KEY = "magic-bag-kid-profile";
        // Load the recording metadata before profile setup. On a first visit,
        // submitting that form is the browser-approved gesture that lets the
        // welcome recording start as the bag screen is revealed.
        const dataUrl = new URL("magic-school-bag/ori-data.json", new URL(import.meta.env.BASE_URL, location.href));
        const DATA: SchoolData = await fetch(dataUrl).then(async (response) => {
          if (!response.ok)
            throw new Error(`School bag data could not be loaded (${response.status})`);
          return validateSchoolData(await response.json());
        });
        const profileDialog = requiredElement<HTMLDialogElement>("profile-dialog");
        const profileForm = requiredElement<HTMLFormElement>("profile-form");
        const kidNameInput = requiredElement<HTMLInputElement>("kid-name");
        const cancelSettings = requiredElement<HTMLButtonElement>("cancel-settings");
        const openSettings = requiredElement<HTMLButtonElement>("open-settings");
        const dayStartDialog = requiredElement<HTMLDialogElement>("day-start-dialog");
        const dayStartTitle = requiredElement<HTMLHeadingElement>("day-start-title");
        const dayStartMessage = requiredElement<HTMLParagraphElement>("day-start-message");
        const dayStartButton = requiredElement<HTMLButtonElement>("day-start-button");
        const installDialog = requiredElement<HTMLDialogElement>("install-dialog");
        const installMessage = requiredElement<HTMLParagraphElement>("install-message");
        const installApp = requiredElement<HTMLButtonElement>("install-app");
        const dismissInstall = requiredElement<HTMLButtonElement>("dismiss-install");
        let hasInteracted = false;
        // Keep one media element for every spoken prompt. Mobile Safari grants
        // playback permission to the element used during a user gesture, not
        // necessarily to new Audio instances created later from a timer. The
        // completion prompt runs after the final packing animation, so reusing
        // this unlocked player lets it reliably play when the modal appears.
        const voicePlayer = new Audio();
        voicePlayer.preload = "auto";
        let voicePlaybackId = 0;
        let activeVoice: HTMLAudioElement | null = null;
        let appEntryVoice: HTMLAudioElement | null = null;
        let appEntryVoiceDay: number | null = null;
        let appEntryPlayedDay: number | null = null;
        let appEntryStarting = false;

        function appEntryIsPlaying(): boolean {
          return !!appEntryVoice && !appEntryVoice.ended && !appEntryVoice.paused;
        }

        function stopVoice(force = false): void {
          if (!activeVoice || (!force && activeVoice === appEntryVoice)) return;
          activeVoice.pause();
          activeVoice.currentTime = 0;
          activeVoice = null;
          voicePlaybackId += 1;
        }

        async function startAppEntry(day: number): Promise<boolean> {
          if (appEntryVoice && appEntryVoiceDay !== day) {
            appEntryVoice.pause();
            appEntryVoice.currentTime = 0;
            if (activeVoice === appEntryVoice) activeVoice = null;
            appEntryVoice = null;
            appEntryVoiceDay = null;
          }
          if (appEntryPlayedDay === day || appEntryStarting || appEntryIsPlaying())
            return appEntryPlayedDay === day;
          const audioUrl = DATA.generalAudio.appEntry.humanAudioByWeekday[String(day)]?.trim();
          if (!audioUrl) return false;

          appEntryStarting = true;
          const playbackId = ++voicePlaybackId;
          const voice = voicePlayer;
          voice.src = resolveMediaUrl(audioUrl, dataUrl);
          voice.currentTime = 0;
          appEntryVoice = voice;
          appEntryVoiceDay = day;
          activeVoice = voice;
          voice.onended = () => {
            if (playbackId !== voicePlaybackId) return;
            if (activeVoice === voice) activeVoice = null;
            if (appEntryVoice === voice) {
              appEntryVoice = null;
              appEntryVoiceDay = null;
            }
          };
          try {
            await voice.play();
            if (playbackId !== voicePlaybackId) return false;
            appEntryPlayedDay = day;
            return true;
          } catch (_) {
            if (playbackId !== voicePlaybackId) return false;
            if (activeVoice === voice) activeVoice = null;
            if (appEntryVoice === voice) {
              appEntryVoice = null;
              appEntryVoiceDay = null;
            }
            return false;
          } finally {
            appEntryStarting = false;
          }
        }
        let resolveInitialProfile: (() => void) | undefined;
        const initialProfileReady = new Promise<void>((resolve) => {
          resolveInitialProfile = resolve;
        });

        function loadProfile(): Profile | null {
          try {
            const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
            if (!stored) return null;
            const profile: unknown = JSON.parse(stored);
            if (
              typeof profile === "object" && profile !== null &&
              "name" in profile && typeof profile.name === "string" && profile.name.trim() &&
              "gender" in profile && (profile.gender === "boy" || profile.gender === "girl")
            ) {
              return { name: profile.name.trim(), gender: profile.gender };
            }
          } catch (_) {
            // Treat unavailable or malformed browser storage as a first visit.
          }
          return null;
        }

        let kidProfile = loadProfile();

        function applyProfileColors(profile: Profile): void {
          document.documentElement.dataset.gender = profile.gender;
          document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
            ?.setAttribute("content", profile.gender === "boy" ? "#2789c7" : "#9d73df");
        }

        function editProfile(firstVisit = false): void {
          kidNameInput.value = kidProfile?.name ?? "";
          profileForm.querySelectorAll<HTMLInputElement>('[name="gender"]').forEach((input) => {
            input.checked = input.value === kidProfile?.gender;
          });
          cancelSettings.hidden = firstVisit;
          profileDialog.showModal();
          requestAnimationFrame(() => kidNameInput.focus());
        }

        profileForm.addEventListener("submit", (event) => {
          event.preventDefault();
          const formData = new FormData(profileForm);
          const name = String(formData.get("kidName") ?? "").trim();
          const gender = formData.get("gender");
          if (!name || (gender !== "boy" && gender !== "girl")) return;
          hasInteracted = true;
          kidProfile = { name, gender };
          applyProfileColors(kidProfile);
          try {
            localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(kidProfile));
          } catch (_) {
            // The current session can still be personalized without persistence.
          }
          document.title = `תיק הקסם ✨ | ${kidProfile.name}`;
          requiredElement("page-title").textContent =
            `משימת תיק הקסם עם ${kidProfile.name}`;
          resolveInitialProfile?.();
          resolveInitialProfile = undefined;
          profileDialog.close();
          const scene = window.magicBagGame?.scene.getScene("MagicBag") as MagicBagScene | undefined;
          if (scene?.scene.isActive()) scene.scene.restart({});
        });
        cancelSettings.addEventListener("click", () => profileDialog.close());
        profileDialog.addEventListener("cancel", (event) => {
          if (!kidProfile) event.preventDefault();
        });
        openSettings.addEventListener("click", () => editProfile(false));

        if (!kidProfile) {
          editProfile(true);
          // Profile validity, rather than the dialog's UI lifecycle, controls
          // when the game can safely start and read `kidProfile`.
          await initialProfileReady;
        }
        if (!kidProfile) throw new Error("Profile setup ended without a valid profile");
        applyProfileColors(kidProfile);

        const INSTALL_DISMISSED_KEY = "magic-bag-install-suggestion-dismissed";
        const standalone = window.matchMedia("(display-mode: standalone)").matches ||
          ("standalone" in navigator && navigator.standalone === true);
        const mobileBrowser = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
        let installSuggestionDismissed = false;
        try {
          installSuggestionDismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === "true";
        } catch (_) {
          // Storage is optional; the suggestion can still be shown for this session.
        }

        const dismissInstallSuggestion = (): void => {
          try {
            localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
          } catch (_) {
            // Closing the dialog still works when browser storage is unavailable.
          }
          installDialog.close();
        };

        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        const showInstallSuggestion = (): void => {
          if (!deferredInstallPrompt) {
            installMessage.textContent = isIos
              ? "לחצו על כפתור השיתוף בדפדפן, ואז בחרו ״הוספה למסך הבית״ כדי לפתוח את תיק הקסם ישירות."
              : "פתחו את תפריט הדפדפן ובחרו ״הוספה למסך הבית״ כדי לפתוח את תיק הקסם ישירות.";
            installApp.textContent = "הבנתי";
          }
          installDialog.showModal();
        };

        installApp.addEventListener("click", async () => {
          if (!deferredInstallPrompt) {
            dismissInstallSuggestion();
            return;
          }
          await deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
          dismissInstallSuggestion();
        });
        dismissInstall.addEventListener("click", dismissInstallSuggestion);
        installDialog.addEventListener("cancel", dismissInstallSuggestion);

        if (mobileBrowser && !standalone && !installSuggestionDismissed) {
          window.setTimeout(() => {
            if (!profileDialog.open && !dayStartDialog.open && !installDialog.open) {
              showInstallSuggestion();
            }
          }, 900);
        }

        if ("serviceWorker" in navigator) {
          const serviceWorkerUrl = new URL(
            "magic-bag-sw.js",
            new URL(import.meta.env.BASE_URL, location.href),
          );
          void navigator.serviceWorker.register(serviceWorkerUrl, {
            scope: new URL(import.meta.env.BASE_URL, location.href).pathname,
          });
        }
        document.title = `תיק הקסם ✨ | ${kidProfile.name}`;
        requiredElement("page-title").textContent =
          `משימת תיק הקסם עם ${kidProfile.name}`;
        const currentProfile = (): Profile => {
          if (!kidProfile) throw new Error("A profile is required before starting the game");
          return kidProfile;
        };
        const genderText = (girlText: string, boyText: string): string =>
          currentProfile().gender === "girl" ? girlText : boyText;
        const palette = () => currentProfile().gender === "boy" ? BOY_PALETTE : GIRL_PALETTE;

        const portraitQuery = window.matchMedia("(max-width: 760px)");
        let portrait = portraitQuery.matches;
        let W = portrait ? 420 : 1100;
        const H = 800;
        // Phaser 4 has no game-level resolution option. Render a larger surface
        // and zoom the camera so world coordinates and hit areas stay unchanged.
        // Cap supersampling to keep GPU memory reasonable on mobile devices.
        const renderScale = Math.min(
          3,
          Math.max(2, Math.ceil(window.devicePixelRatio || 1)),
        );
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const controls = requiredElement<HTMLDivElement>("keyboard-controls");
        const liveStatus = requiredElement<HTMLParagraphElement>("game-status");

        // This JSON is the single source for lesson order, equipment, dismissal time and recorded voice.
        const DAYS = DATA.days.map((day) => day.label);

        const daySelect = requiredElement<HTMLSelectElement>("school-day");
        const endTime = requiredElement<HTMLOutputElement>("end-time");
        const timetableButton = requiredElement<HTMLButtonElement>("toggle-timetable");
        const closeTimetableButton = requiredElement<HTMLButtonElement>("close-timetable");
        const timetablePanel = requiredElement<HTMLElement>("timetable-panel");
        const timetableHeading = requiredElement<HTMLHeadingElement>("timetable-heading");
        const timetableLessons = requiredElement<HTMLOListElement>("timetable-lessons");
        // Deliberately start without guessing a day for the child. A day only
        // becomes active after an explicit choice in the selector.
        let selectedDay = -1;
        let ITEMS: PackingItem[] = [];
        const promptOption = document.createElement("option");
        promptOption.value = "";
        promptOption.textContent = "בחרו יום ✨";
        promptOption.disabled = true;
        promptOption.selected = true;
        daySelect.append(promptOption);
        DAYS.forEach((day, index) => {
          const option = document.createElement("option");
          option.value = String(index);
          option.textContent = `יום ${day}`;
          daySelect.append(option);
        });

        function setTimetableOpen(open: boolean): void {
          const expanded = open && !!DATA.days[selectedDay];
          timetableButton.setAttribute("aria-expanded", String(expanded));
          timetablePanel.dataset.open = String(expanded);
          timetablePanel.setAttribute("aria-hidden", String(!expanded));
          timetablePanel.inert = !expanded;
        }

        timetableButton.addEventListener("click", () => {
          setTimetableOpen(timetableButton.getAttribute("aria-expanded") !== "true");
        }, { signal: appLifetime.signal });
        closeTimetableButton.addEventListener("click", () => {
          setTimetableOpen(false);
          timetableButton.focus({ preventScroll: true });
        }, { signal: appLifetime.signal });
        document.addEventListener("keydown", (event) => {
          if (
            event.key !== "Escape" || event.defaultPrevented ||
            timetableButton.getAttribute("aria-expanded") !== "true" ||
            document.querySelector("dialog[open]")
          ) return;
          event.preventDefault();
          setTimetableOpen(false);
          timetableButton.focus();
        }, { signal: appLifetime.signal });

        function renderDayInfo(): void {
          const day = DATA.days[selectedDay];
          timetableButton.disabled = !day;
          if (!day) {
            setTimetableOpen(false);
            timetableHeading.textContent = "";
            timetableLessons.replaceChildren();
            endTime.textContent = "";
            return;
          }
          timetableHeading.textContent = `המערכת ליום ${day.label}`;
          timetableLessons.replaceChildren(...day.lessons.map((lesson, index) => {
            const row = document.createElement("li");
            const number = document.createElement("span");
            number.className = "lesson-number";
            number.textContent = `שיעור ${index + 1}`;
            const label = document.createElement("span");
            label.textContent = lesson.label;
            row.append(number, label);
            return row;
          }));
          endTime.textContent = day.endsAt
            ? `סיום הלימודים: ${day.endsAt}`
            : "לא נמסרה שעת סיום";
          endTime.setAttribute(
            "aria-label",
            day.endsAt
              ? `הלימודים מסתיימים בשעה ${day.endsAt}`
              : "שעת הסיום עדיין לא נמסרה",
          );
        }
        renderDayInfo();

        function showDayStart(): void {
          const profile = currentProfile();
          const message = DATA.generalAudio.appEntry;
          daySelect.blur();
          daySelect.disabled = true;
          dayStartTitle.textContent = `מתכוננים ליום ${DAYS[selectedDay]}!`;
          dayStartMessage.textContent = `${profile.name}, הגיע הזמן להכין יחד את תיק הקסם ליום ${DAYS[selectedDay]}.`;
          liveStatus.textContent = message.textTemplate.replace("{day}", DAYS[selectedDay]);
          if (!dayStartDialog.open) dayStartDialog.showModal();
          void startAppEntry(selectedDay);
          requestAnimationFrame(() => dayStartButton.focus());
        }

        class MagicBagScene extends Phaser.Scene {
          cards: CardState[] = [];
          finished = false;
          activeDragCard: CardState | null = null;
          activeDragPointerId: number | null = null;
          pendingDrag: PendingDrag | null = null;
          returningCard: CardState | null = null;
          suppressClickUntil = 0;
          dragPreview: HTMLButtonElement | null = null;
          monster!: MonsterBag;
          packingCard: CardState | null = null;
          progressMeter: HTMLDivElement | null = null;
          daySelectionPrompt: HTMLParagraphElement | null = null;
          progressText: HTMLSpanElement | null = null;
          progressBar: HTMLProgressElement | null = null;
          stackPanel: HTMLDivElement | null = null;
          replayButton: HTMLButtonElement | null = null;
          private pendingPackResolutions = new Set<(completed: boolean) => void>();

          get packed(): number {
            return this.cards.filter((card) => card.phase === "packed").length;
          }

          constructor() {
            super("MagicBag");
          }

          preload(): void {
            preloadMonster(this, new URL("assets/monster/", dataUrl));
          }

          update(_time: number, delta: number): void {
            const card = this.activeDragCard ?? (this.packingCard?.phase === "packing" ? this.packingCard : null);
            this.monster?.trackTarget(card?.container ?? null);
            this.monster?.update(delta);
          }

          crispText(x: number, y: number, text: string, style: Record<string, unknown> = {}): Phaser.GameObjects.Text {
            // Text and emoji use their own canvas textures; supersample those too.
            return this.add.text(x, y, text, {
              ...style,
              resolution: renderScale,
            });
          }

          create(data: SceneRestartData = {}): void {
            // scene.restart() reuses the same Scene instance, so reset all
            // per-run state here instead of relying only on the constructor.
            stopVoice();
            this.cards = [];
            this.finished = false;
            this.activeDragCard = null;
            this.activeDragPointerId = null;
            this.pendingDrag = null;
            this.returningCard = null;
            this.packingCard = null;
            this.suppressClickUntil = 0;
            this.dragPreview = null;
            daySelect.disabled = false;

            this.cameras.main
              .setZoom(renderScale)
              .centerOn(W / 2, H / 2)
              .setBackgroundColor(palette().page);

            this.drawBackground();
            this.drawHeader();
            this.drawMonster();
            this.drawCards();
            this.setupDrag();
            this.setupKeyboardControls();
            this.drawProgress();
            this.updateProgress();
            this.scale.on("resize", this.positionControls, this);
            const cleanup = () => {
              this.events.off("shutdown", cleanup);
              this.events.off("destroy", cleanup);
              this.scale.off("resize", this.positionControls, this);
              stopVoice();
              this.monster.destroy();
              this.cards.forEach((card) => this.tweens.killTweensOf(card.container));
              controls.replaceChildren();
              controls.removeAttribute("role");
              controls.removeAttribute("aria-modal");
              controls.removeAttribute("aria-label");
              this.clearDragPreview();
              this.pendingPackResolutions.forEach((resolve) => resolve(false));
              this.pendingPackResolutions.clear();
            };
            this.events.once("shutdown", cleanup);
            this.events.once("destroy", cleanup);
            if (data.packedIds?.length) {
              for (const card of this.cards) {
                if (!data.packedIds.includes(card.item.id)) continue;
                card.phase = "packed";
                card.container.setVisible(false).disableInteractive();
                card.button.hidden = true;
              }
              this.refreshDeck();
              this.updateProgress();
              if (this.packed === ITEMS.length) this.finish();
            }
            requiredElement("loading").hidden = true;
            this.game.canvas.setAttribute("aria-hidden", "true");
            requestAnimationFrame(() => this.positionControls());

            this.time.delayedCall(850, () => this.playAppEntry());
          }

          drawBackground() {
            const g = this.add.graphics();
            g.fillStyle(palette().pageNumber);
            g.fillRect(0, 0, W, H);

            const blobs = [
              [85, 90, 190, palette().blobOne, 0.65],
              [1030, 75, 230, palette().blobTwo, 0.58],
              [1010, 660, 250, 0xd9f8ed, 0.55],
              [70, 650, 220, 0xffefbf, 0.62],
            ];

            blobs.forEach(([x, y, r, c, a]) => {
              g.fillStyle(c, a);
              g.fillCircle(x, y, r);
            });

            for (let i = 0; i < (reducedMotion ? 0 : 42); i++) {
              const x = Phaser.Math.Between(25, W - 25);
              const y = Phaser.Math.Between(25, H - 25);
              const s = this.crispText(x, y, Math.random() > 0.5 ? "✦" : "•", {
                fontFamily: "Arial",
                fontSize: Phaser.Math.Between(10, 20),
                color: Math.random() > 0.5 ? palette().sparkleOne : palette().sparkleTwo,
              })
                .setOrigin(0.5)
                .setAlpha(Phaser.Math.FloatBetween(0.25, 0.65));

              this.tweens.add({
                targets: s,
                alpha: 0.1,
                scale: 1.35,
                duration: Phaser.Math.Between(1400, 2600),
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 900),
              });
            }

            if (!portrait) {
              this.cloud(130, 168, 0.65);
              this.cloud(960, 165, 0.52);
            }
          }

          cloud(x: number, y: number, scale: number): void {
            const c = this.add.container(x, y);
            const g = this.add.graphics();
            g.fillStyle(0xffffff, 0.72);
            g.fillCircle(-45, 5, 34);
            g.fillCircle(-7, -15, 47);
            g.fillCircle(41, 5, 36);
            g.fillRoundedRect(-78, 0, 155, 40, 20);
            c.add(g);
            c.setScale(scale);

            this.tweens.add({
              targets: c,
              x: x + 18,
              duration: 3000,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut",
            });
          }

          drawHeader() {
            this.crispText(W / 2, 42, "✨ משימת תיק הקסם ✨", {
              fontFamily: "Arial",
              fontSize: portrait ? 29 : 36,
              fontStyle: "bold",
              color: palette().heading,
            }).setOrigin(0.5);

          }

          drawMonster(): void {
            this.monster = new MonsterBag(this, currentProfile().gender, W / 2, reducedMotion);
          }

          drawProgress() {
            const daySelectionPrompt = document.createElement("p");
            daySelectionPrompt.className = "day-selection-prompt";
            daySelectionPrompt.textContent = "בחרו יום";
            controls.append(daySelectionPrompt);

            const meter = document.createElement("div");
            meter.className = "magic-meter";
            meter.setAttribute("role", "group");

            const summary = document.createElement("div");
            summary.className = "magic-meter-summary";
            const star = document.createElement("span");
            star.className = "magic-meter-star";
            star.textContent = "★";
            star.setAttribute("aria-hidden", "true");
            const text = document.createElement("span");
            summary.append(star, text);

            const progress = document.createElement("progress");
            progress.className = "magic-meter-bar";
            progress.setAttribute("aria-label", "התקדמות אריזת התיק");
            meter.append(summary, progress);
            controls.append(meter);
            this.daySelectionPrompt = daySelectionPrompt;
            this.progressMeter = meter;
            this.progressText = text;
            this.progressBar = progress;
            this.positionControls();
          }

          updateProgress() {
            const packed = this.packed;
            const total = ITEMS.length;
            const waitingForDay = selectedDay < 0;
            if (this.daySelectionPrompt)
              this.daySelectionPrompt.hidden = !waitingForDay;
            if (this.progressMeter) this.progressMeter.hidden = waitingForDay;
            if (this.progressText)
              this.progressText.textContent = `${packed} מתוך ${total} פריטים בתיק`;
            if (this.progressBar) {
              // A max of one keeps an empty session determinate without dividing by zero.
              this.progressBar.max = total || 1;
              this.progressBar.value = packed;
              this.progressBar.setAttribute(
                "aria-valuetext",
                `${packed} מתוך ${total} פריטים בתיק`,
              );
            }
            liveStatus.textContent = selectedDay < 0
              ? "בחרו יום"
              : `יום ${DAYS[selectedDay]}: ${packed} מתוך ${total} פריטים בתיק`;
          }

          drawCards() {
            ITEMS.forEach((item) => {
              this.cards.push({
                item,
                container: this.createCard(item),
                button: document.createElement("button"),
                phase: "ready",
                homeX: 0,
                homeY: 0,
                dragOffsetX: 0,
                dragOffsetY: 0,
              });
            });
          }

          createCard(_item: PackingItem): Phaser.GameObjects.Container {
            // A hidden scene object carries drag coordinates and animation state.
            // The same full-size DOM card is visible at rest, in flight, and returning.
            return this.add.container(0, 0).setVisible(false);
          }

          setupKeyboardControls() {
            controls.replaceChildren();
            this.replayButton = null;
            const panel = document.createElement("div");
            panel.className = "packing-panel";
            panel.setAttribute("role", "region");
            panel.setAttribute(
              "aria-label",
              `ערימת הציוד ליום ${DAYS[selectedDay]}, לפי סדר השיעורים`,
            );
            this.stackPanel = panel;
            controls.append(panel);

            this.cards.forEach((card) => {
              const item = card.item;
              const button = document.createElement("button");
              button.type = "button";
              button.className = "item-button";
              const color = `#${item.color.toString(16).padStart(6, "0")}`;
              button.style.setProperty("--item-color", color);
              button.style.setProperty("--item-border", `${color}88`);
              button.style.setProperty("--item-tint", `${color}22`);
              button.setAttribute(
                "aria-label",
                `${item.label}, ${item.subject}, ${this.lessonLabel(item)}. ${genderText("גררי", "גרור")} לתיק או לחצו לאריזה. חץ מטה אורז מהמקלדת`,
              );
              button.setAttribute("aria-keyshortcuts", "ArrowDown");
              const icon = document.createElement("span");
              icon.className = "item-icon";
              icon.setAttribute("aria-hidden", "true");
              const fallbackIcon = document.createElement("span");
              fallbackIcon.textContent = item.icon;
              icon.append(fallbackIcon);
              if (item.imageUrl?.trim()) {
                const image = document.createElement("img");
                image.alt = "";
                image.decoding = "async";
                // Keep native image gestures from taking over the card drag.
                image.draggable = false;
                image.addEventListener("load", () => {
                  fallbackIcon.hidden = true;
                  icon.classList.add("has-image");
                }, { once: true });
                image.addEventListener("error", () => image.remove(), { once: true });
                image.src = resolveMediaUrl(item.imageUrl, dataUrl);
                icon.append(image);
              }
              const label = document.createElement("span");
              label.className = "item-label";
              label.textContent = item.label;
              const action = document.createElement("span");
              action.className = "item-action";
              action.textContent = genderText("גררי לתיק או לחצי לאריזה", "גרור לתיק או לחץ לאריזה");
              const copy = document.createElement("span");
              copy.className = "item-copy";
              copy.append(label, action);
              button.append(icon, copy);
              button.addEventListener("pointerdown", (event) => {
                if (
                  !this.canPack(card) ||
                  this.pendingDrag ||
                  this.activeDragCard ||
                  event.button !== 0
                )
                  return;
                this.pendingDrag = {
                  card,
                  pointerId: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                };
                button.setPointerCapture(event.pointerId);
              });
              button.addEventListener("click", () => {
                if (
                  !this.canPack(card) ||
                  this.activeDragCard ||
                  performance.now() < (this.suppressClickUntil || 0)
                )
                  return;
                hasInteracted = true;
                const audioUrl = item.audioUrl?.trim();
                // A card tap is an explicit request from the child. Do not drop
                // it just because the longer welcome recording is still playing.
                if (audioUrl) this.speak(audioUrl, true);
                void this.pack(card);
              });
              button.addEventListener("keydown", (event) => {
                if (event.key !== "ArrowDown" || !this.canPack(card)) return;
                event.preventDefault();
                hasInteracted = true;
                void this.pack(card);
              });
              panel.append(button);
              card.button = button;
            });
            this.refreshDeck();
          }

          canPack(card: CardState): boolean {
            return (
              !this.finished &&
              !this.returningCard &&
              !this.packingCard &&
              !this.activeDragCard &&
              card.phase === "ready" &&
              card === this.cards.find((entry) => entry.phase !== "packed")
            );
          }

          lessonLabel(item: PackingItem): string {
            if (!item.lessons.length) return "";
            return `${item.lessons.length === 1 ? "שיעור" : "שיעורים"} ${item.lessons.join(", ")}`;
          }

          refreshDeck() {
            const remaining = this.cards.filter((card) => card.phase !== "packed");
            this.cards.forEach((card) => {
              const depth = remaining.indexOf(card);
              const visible = depth >= 0 && depth < 3;
              const front = depth === 0;
              card.button.hidden = !visible;
              card.button.disabled = !front || !this.canPack(card);
              card.button.tabIndex = front ? 0 : -1;
              card.button.setAttribute("aria-hidden", String(!front));
              card.button.setAttribute("data-deck-front", String(front));
              card.button.setAttribute("data-deck-depth", String(depth));
              if (card.phase === "packing" || card.phase === "packed") card.button.hidden = true;
              card.button.style.zIndex = String(3 - depth);
              card.button.style.setProperty(
                "--deck-y",
                `${-18 * Math.max(0, depth)}px`,
              );
              card.button.style.setProperty(
                "--deck-scale",
                String(1 - 0.07 * Math.max(0, depth)),
              );
            });
          }

          positionControls() {
            const canvas = this.game.canvas.getBoundingClientRect();
            const bounds = controls.getBoundingClientRect();
            const sx = canvas.width / W;
            const sy = canvas.height / H;
            if (this.progressMeter) {
              Object.assign(this.progressMeter.style, {
                left: `${canvas.left - bounds.left + W / 2 * sx}px`,
                top: `${canvas.top - bounds.top + 91 * sy}px`,
                width: `${(portrait ? 304 : 380) * sx}px`,
              });
            }
            if (this.daySelectionPrompt) {
              Object.assign(this.daySelectionPrompt.style, {
                left: `${canvas.left - bounds.left + W / 2 * sx}px`,
                top: `${canvas.top - bounds.top + 91 * sy}px`,
                width: `${(portrait ? 304 : 380) * sx}px`,
              });
            }
            if (this.stackPanel) {
              Object.assign(this.stackPanel.style, {
                left: `${canvas.left - bounds.left + (W / 2 - (portrait ? 152 : 190)) * sx}px`,
                top: `${canvas.top - bounds.top + 240 * sy}px`,
                width: `${(portrait ? 304 : 380) * sx}px`,
                height: `${210 * sy}px`,
              });
            }
            if (this.replayButton) {
              Object.assign(this.replayButton.style, {
                left: `${canvas.left - bounds.left + (W / 2) * sx}px`,
                top: `${canvas.top - bounds.top + (H / 2 + 141) * sy}px`,
                width: `${190 * sx}px`,
                height: `${58 * sy}px`,
              });
            }
          }

          pointerPosition(event: Pick<PointerEvent, "clientX" | "clientY">): Point {
            const canvas = this.game.canvas.getBoundingClientRect();
            return {
              x: ((event.clientX - canvas.left) * W) / canvas.width,
              y: ((event.clientY - canvas.top) * H) / canvas.height,
            };
          }

          prepareCard(card: CardState): void {
            const bounds = card.button.getBoundingClientRect();
            const position = this.pointerPosition({
              clientX: bounds.left + bounds.width / 2,
              clientY: bounds.top + bounds.height / 2,
            });
            card.homeX = position.x;
            card.homeY = position.y;
            card.prepared = true;
            card.container
              .setPosition(position.x, position.y)
              .setScale(1)
              .setAngle(0)
              .setAlpha(1)
              .setVisible(false);
            this.children.bringToTop(card.container);
            card.button.style.visibility = "hidden";
          }

          showDragPreview(card: CardState): void {
            const preview = card.button.cloneNode(true) as HTMLButtonElement;
            preview.classList.add("drag-preview");
            preview.style.visibility = "";
            const bounds = card.button.getBoundingClientRect();
            preview.style.width = `${bounds.width}px`;
            preview.style.height = `${bounds.height}px`;
            preview.hidden = false;
            preview.setAttribute("aria-hidden", "true");
            preview.tabIndex = -1;
            preview.disabled = true;
            controls.append(preview);
            this.dragPreview = preview;
            card.container.setVisible(false);
            this.positionDragPreview(card);
          }

          positionDragPreview(card: CardState): void {
            if (!this.dragPreview) return;
            const canvas = this.game.canvas.getBoundingClientRect();
            const bounds = controls.getBoundingClientRect();
            this.dragPreview.style.left = `${canvas.left - bounds.left + (card.container.x * canvas.width) / W}px`;
            this.dragPreview.style.top = `${canvas.top - bounds.top + (card.container.y * canvas.height) / H}px`;
            this.dragPreview.style.transform = `translate(-50%, -50%) scale(${card.container.scaleX}, ${card.container.scaleY}) rotate(${card.container.angle}deg)`;
            this.dragPreview.style.opacity = String(card.container.alpha);
          }

          clearDragPreview() {
            this.dragPreview?.remove();
            this.dragPreview = null;
          }

          restartGame() {
            hasInteracted = true;
            this.scene.restart({});
            this.events.once("create", () =>
              this.cards[0]?.button.focus({ preventScroll: true }),
            );
          }

          dragScaleAt(x: number, y: number): number {
            const distance = this.monster.distance({ x, y });
            const proximity = Math.max(0, Math.min(1,
              (MONSTER.proximity.shrinkDistance - distance) / (MONSTER.proximity.shrinkDistance - 1),
            ));
            const eased = proximity * proximity * (3 - 2 * proximity);
            return 1 - 0.55 * eased;
          }

          updateDraggedCard(card: CardState, pointer: Point): void {
            // Measure proximity before scaling so the effect cannot feed back
            // into itself. Scale the grab offset to keep that point under the pointer.
            const scale = this.dragScaleAt(
              pointer.x - card.dragOffsetX,
              pointer.y - card.dragOffsetY,
            );
            card.container.setScale(scale);
            card.container.x = pointer.x - card.dragOffsetX * scale;
            card.container.y = pointer.y - card.dragOffsetY * scale;
            this.positionDragPreview(card);
          }

          setupDrag() {
            const lifetime = new AbortController();
            const options = { signal: lifetime.signal };
            const abort = () => {
              lifetime.abort();
              this.events.off("shutdown", abort);
              this.events.off("destroy", abort);
            };
            this.events.once("shutdown", abort);
            this.events.once("destroy", abort);
            const releaseCapture = (pending: PendingDrag | null) => {
              if (pending?.card.button.hasPointerCapture(pending.pointerId))
                pending.card.button.releasePointerCapture(pending.pointerId);
            };
            const cancelDrag = () => {
              const pending = this.pendingDrag;
              const card = this.activeDragCard;
              this.pendingDrag = null;
              this.activeDragCard = null;
              this.activeDragPointerId = null;
              releaseCapture(pending);
              if (!card) return;
              this.suppressClickUntil = performance.now() + 400;
              this.monster.anticipate(false);
              this.returnHome(card);
            };
            window.addEventListener(
              "pointermove",
              (event) => {
                const pending = this.pendingDrag;
                if (
                  !pending ||
                  event.pointerId !== pending.pointerId ||
                  this.finished
                )
                  return;
                const pointer = this.pointerPosition(event);
                if (!this.activeDragCard) {
                  if (
                    Math.hypot(
                      event.clientX - pending.x,
                      event.clientY - pending.y,
                    ) < 7
                  )
                    return;
                  hasInteracted = true;
                  this.prepareCard(pending.card);
                  this.showDragPreview(pending.card);
                  this.activeDragCard = pending.card;
                  pending.card.phase = "dragging";
                  this.monster.anticipate(true);
                  this.activeDragPointerId = event.pointerId;
                  const start = this.pointerPosition({
                    clientX: pending.x,
                    clientY: pending.y,
                  });
                  pending.card.dragOffsetX = start.x - pending.card.homeX;
                  pending.card.dragOffsetY = start.y - pending.card.homeY;
                  daySelect.disabled = true;
                }
                const card = this.activeDragCard;
                this.updateDraggedCard(card, pointer);
              },
              options,
            );
            window.addEventListener(
              "pointerup",
              (event) => {
                const pending = this.pendingDrag;
                if (!pending || event.pointerId !== pending.pointerId) return;
                const card = this.activeDragCard;
                this.pendingDrag = null;
                this.activeDragCard = null;
                this.activeDragPointerId = null;
                releaseCapture(pending);
                if (!card) return;
                this.suppressClickUntil = performance.now() + 400;
                const pointer = this.pointerPosition(event);
                this.updateDraggedCard(card, pointer);
                if (this.monster.canInsert(card.container)) void this.pack(card);
                else this.returnHome(card);
              },
              options,
            );
            window.addEventListener("pointercancel", (event) => {
              if (event.pointerId === this.pendingDrag?.pointerId) cancelDrag();
            }, options);
            window.addEventListener("blur", cancelDrag, options);
            controls.addEventListener(
              "lostpointercapture",
              (event) => {
                if (event.pointerId === this.pendingDrag?.pointerId)
                  cancelDrag();
              },
              options,
            );
          }

          eatingCard(card: CardState): Phaser.GameObjects.Container {
            // Dragging keeps the accessible DOM card. Accepted items enter the
            // Phaser character's food layer so its mouth can actually occlude them.
            const food = this.add.container(0, 0);
            const width = portrait ? 304 : 380;
            const background = this.add.graphics();
            background.fillStyle(0xffffff);
            background.fillRoundedRect(-width / 2, -105, width, 210, 28);
            background.lineStyle(2, card.item.color);
            background.strokeRoundedRect(-width / 2, -105, width, 210, 28);
            food.add(background);
            const image = card.button.querySelector("img");
            const imageKey = `packing-image:${image?.src ?? ""}`;
            if (image?.complete && image.naturalWidth && new URL(image.src).origin === location.origin) {
              if (!this.textures.exists(imageKey)) this.textures.addImage(imageKey, image);
              const picture = this.add.image(width / 2 - 76, 0, imageKey);
              picture.setScale(Math.min(112 / image.naturalWidth, 166 / image.naturalHeight));
              food.add(picture);
            } else {
              food.add(this.crispText(width / 2 - 76, 0, card.item.icon, {
                fontFamily: "Arial", fontSize: 64,
              }).setOrigin(0.5));
            }
            food.add(this.crispText(-62, 0, card.item.label, {
              fontFamily: "Arial", fontSize: 22, fontStyle: "bold", color: palette().heading,
              align: "center", rtl: true, wordWrap: { width: width - 170 },
            }).setOrigin(0.5));
            this.monster.foodLayer.add(food);
            return food;
          }

          pack(card: CardState): Promise<boolean> {
            const acceptedDrag = card.phase === "dragging" &&
              card === this.cards.find((entry) => entry.phase !== "packed") &&
              !this.finished && !this.packingCard && !this.returningCard;
            if (!this.canPack(card) && !acceptedDrag) return Promise.resolve(false);
            // Arrow Down can arrive while a pointer is still held on the card.
            // Release that pending gesture before it can start a second flight.
            const pending = this.pendingDrag;
            this.pendingDrag = null;
            this.activeDragCard = null;
            this.activeDragPointerId = null;
            if (pending?.card.button.hasPointerCapture(pending.pointerId))
              pending.card.button.releasePointerCapture(pending.pointerId);
            let settle!: (completed: boolean) => void;
            const result = new Promise<boolean>((resolve) => { settle = resolve; });
            this.pendingPackResolutions.add(settle);
            this.packingCard = card;
            this.tweens.killTweensOf(card.container);
            if (!card.prepared) this.prepareCard(card);
            if (!this.dragPreview) this.showDragPreview(card);
            card.phase = "packing";
            daySelect.disabled = true;
            this.refreshDeck();

            this.monster.eat(() => {
              this.clearDragPreview();
              const food = this.eatingCard(card);
              const positionFood = () => {
                const point = this.monster.toLocal(card.container);
                food.setPosition(point.x, point.y)
                  .setScale(card.container.scaleX / this.monster.container.scaleX)
                  .setAngle(card.container.angle).setAlpha(card.container.alpha);
              };
              positionFood();
              this.sparkles(card.container.x, card.container.y, card.item.color);
              const target = this.monster.target;
              this.tweens.add({
                targets: card.container,
                x: target.x, y: target.y,
                scale: 0.015, alpha: 0,
                angle: reducedMotion ? 0 : Phaser.Math.Between(-12, 12),
                duration: reducedMotion ? 100 : MONSTER.eatingMs,
                ease: "Cubic.easeIn",
                onUpdate: positionFood,
                onComplete: () => {
                  food.destroy();
                  card.container.setVisible(false);
                  // This remains the only place an insertion advances gameplay.
                  card.phase = "packed";
                  this.refreshDeck();
                  this.updateProgress();
                  this.starPop();
                  this.monster.chew(() => {
                    if (this.packed === ITEMS.length) {
                      this.time.delayedCall(MONSTER.completionPauseMs, () => {
                        this.packingCard = null;
                        this.finish();
                        this.pendingPackResolutions.delete(settle);
                        settle(true);
                      });
                    } else {
                      this.packingCard = null;
                      this.refreshDeck();
                      daySelect.disabled = false;
                      this.time.delayedCall(250, () => {
                        if (!this.packingCard) this.speakCurrent();
                      });
                      this.pendingPackResolutions.delete(settle);
                      settle(true);
                    }
                  });
                },
              });
            });
            return result;
          }

          returnHome(card: CardState): void {
            this.monster.anticipate(false);
            this.tweens.killTweensOf(card.container);
            this.returningCard = card;
            card.phase = "returning";
            this.refreshDeck();
            this.tweens.add({
              targets: card.container,
              x: card.homeX,
              y: card.homeY,
              scale: 1,
              duration: 420,
              ease: "Bounce.easeOut",
              onUpdate: () => this.positionDragPreview(card),
              onComplete: () => {
                this.clearDragPreview();
                this.returningCard = null;
                card.phase = "ready";
                card.container.setVisible(false);
                card.button.style.visibility = "";
                card.prepared = false;
                this.refreshDeck();
                daySelect.disabled =
                  !!this.activeDragCard;
              },
            });

            this.tweens.add({
              targets: card.container,
              angle: { from: -4, to: 4 },
              duration: 65,
              yoyo: true,
              repeat: 3,
              onComplete: () => card.container.setAngle(0),
            });
          }

          currentItem() {
            return this.cards.find((c) => c.phase !== "packed")?.item;
          }

          speakCurrent() {
            const item = this.currentItem();
            if (item?.audioUrl) this.speak(item.audioUrl);
          }

          playAppEntry(): void {
            if (selectedDay < 0 || appEntryPlayedDay === selectedDay || !hasInteracted) return;
            const message = DATA.generalAudio.appEntry;
            const text = message.textTemplate.replace("{day}", DAYS[selectedDay]);
            liveStatus.textContent = text;
            void startAppEntry(selectedDay);
          }

          speak(audioUrl?: string, interruptAppEntry = false): void {
            if (!hasInteracted) return;
            // Automatic prompts wait for the welcome message, while direct card
            // taps and the completion dialog take priority over it.
            if (!interruptAppEntry && (appEntryIsPlaying() || appEntryStarting)) return;
            const url = audioUrl?.trim();
            if (typeof url !== "string" || !url.trim()) return;
            stopVoice(interruptAppEntry);
            const playbackId = ++voicePlaybackId;
            const voice = voicePlayer;
            voice.src = resolveMediaUrl(url, dataUrl);
            voice.currentTime = 0;
            activeVoice = voice;
            voice.onended = () => {
              if (playbackId !== voicePlaybackId) return;
              if (activeVoice === voice) activeVoice = null;
            };
            void voice.play().catch(() => {
              if (playbackId !== voicePlaybackId) return;
              if (activeVoice === voice) activeVoice = null;
            });
          }

          sparkles(x: number, y: number, color: number): void {
            for (let i = 0; i < 18; i++) {
              const p = this.add.circle(
                x,
                y,
                Phaser.Math.Between(3, 7),
                i % 3 === 0 ? 0xffd95d : color,
              );

              const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
              const d = Phaser.Math.Between(45, 120);

              this.tweens.add({
                targets: p,
                x: x + Math.cos(a) * d,
                y: y + Math.sin(a) * d,
                scale: 0,
                alpha: 0,
                duration: Phaser.Math.Between(380, 650),
                ease: "Quad.easeOut",
                onComplete: () => p.destroy(),
              });
            }
          }

          starPop() {
            const canvas = this.game.canvas.getBoundingClientRect();
            const bounds = controls.getBoundingClientRect();
            const sx = canvas.width / W;
            const sy = canvas.height / H;
            const star = document.createElement("span");
            star.className = "jumping-star";
            star.textContent = "⭐";
            star.setAttribute("aria-hidden", "true");
            star.style.left = `${canvas.left - bounds.left + this.monster.target.x * sx}px`;
            star.style.top = `${canvas.top - bounds.top + (this.monster.container.y - MONSTER.height / 2) * sy}px`;
            star.style.setProperty("--star-size", `${54 * sy}px`);
            star.style.setProperty("--star-mid", `${48 * sy}px`);
            star.style.setProperty("--star-rise", `${72 * sy}px`);
            star.addEventListener("animationend", () => star.remove(), {
              once: true,
            });
            controls.append(star);
          }

          finish() {
            if (this.finished) return;
            this.finished = true;
            if (this.stackPanel) this.stackPanel.hidden = true;
            daySelect.disabled = false;
            const finalMessage = DATA.generalAudio.finalDialog;
            liveStatus.textContent = `${finalMessage.text} ${currentProfile().name}! התיק מוכן!`;
            // Completion must always announce "כל הכבוד", even when a welcome
            // or item recording has not finished yet.
            this.speak(finalMessage.humanAudioUrl, true);
            this.confetti();

            // Modal is built with top-level objects. In Phaser this is much more
            // reliable for pointer input than putting an interactive hit area on
            // a scaled Container.
            const cx = W / 2;
            const cy = H / 2;

            this.add
              .rectangle(cx, cy, W, H, palette().overlay, 0.28)
              .setDepth(100)
              .setInteractive();

            // Slightly larger modal for more breathing room,
            // with a genuinely rounded card instead of a sharp Rectangle.
            const modalCard = this.add
              .graphics()
              .setPosition(cx, cy)
              .setDepth(101);

            modalCard.fillStyle(0xffffff, 0.98);
            const modalWidth = portrait ? 374 : 550;
            modalCard.fillRoundedRect(
              -modalWidth / 2,
              -190,
              modalWidth,
              380,
              54,
            );

            modalCard.lineStyle(5, palette().dialogBorder, 1);
            modalCard.strokeRoundedRect(
              -modalWidth / 2,
              -190,
              modalWidth,
              380,
              54,
            );

            const crown = this.crispText(cx, cy - 120, "👑", {
              fontFamily: "Arial",
              fontSize: 74,
            })
              .setOrigin(0.5)
              .setDepth(102);

            const title = this.crispText(cx, cy - 34, `${finalMessage.text} ${currentProfile().name}`, {
              fontFamily: "Arial",
              fontSize: portrait ? 34 : 40,
              fontStyle: "bold",
              color: palette().dialogTitle,
            })
              .setOrigin(0.5)
              .setDepth(102);

            const stars = this.crispText(cx, cy + 27, "⭐ ⭐ ⭐", {
              fontFamily: "Arial",
              fontSize: 38,
            })
              .setOrigin(0.5)
              .setDepth(102);

            const subtitle = this.crispText(
              cx,
              cy + 78,
              `הכול מוכן ליום ${DAYS[selectedDay]}`,
              {
                fontFamily: "Arial",
                fontSize: 21,
                color: palette().dialogCopy,
              },
            )
              .setOrigin(0.5)
              .setDepth(102);

            // Keep the exact same rectangular interactive area and behavior,
            // but draw a much rounder pill-shaped visual button on top.
            const btnBg = this.add
              .rectangle(cx, cy + 141, 190, 58, palette().accent, 0)
              .setDepth(103)
              .setInteractive({ useHandCursor: true });

            const btnVisual = this.add
              .graphics()
              .setPosition(cx, cy + 141)
              .setDepth(103);

            btnVisual.fillStyle(palette().accent, 1);
            btnVisual.fillRoundedRect(-95, -29, 190, 58, 29);

            const replayLabel = currentProfile().gender === "girl" ? "שחקי שוב" : "שחק שוב";
            const btnText = this.crispText(cx, cy + 141, `${replayLabel} ✨`, {
              fontFamily: "Arial",
              fontSize: 20,
              fontStyle: "bold",
              color: "#ffffff",
            })
              .setOrigin(0.5)
              .setDepth(104);

            btnBg.on("pointerover", () => {
              this.tweens.add({
                targets: [btnBg, btnVisual, btnText],
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100,
              });
            });

            btnBg.on("pointerout", () => {
              this.tweens.add({
                targets: [btnBg, btnVisual, btnText],
                scaleX: 1,
                scaleY: 1,
                duration: 100,
              });
            });

            btnBg.on("pointerdown", () => this.restartGame());
            controls.setAttribute("role", "dialog");
            controls.setAttribute("aria-modal", "true");
            controls.setAttribute(
              "aria-label",
              `כל הכבוד. הכול מוכן ליום ${DAYS[selectedDay]}`,
            );
            const replay = document.createElement("button");
            replay.type = "button";
            replay.className = "keyboard-control";
            replay.textContent = `${replayLabel} ✨`;
            replay.setAttribute("aria-label", replayLabel);
            replay.addEventListener("click", () => this.restartGame());
            replay.addEventListener("keydown", (event) => {
              if (event.key === "Tab") event.preventDefault();
            });
            controls.append(replay);
            this.replayButton = replay;
            this.positionControls();
            this.time.delayedCall(500, () =>
              replay.focus({ preventScroll: true }),
            );

            const modalParts = [
              modalCard,
              crown,
              title,
              stars,
              subtitle,
              btnBg,
              btnVisual,
              btnText,
            ];

            modalParts.forEach((obj) => obj.setScale(0));

            this.tweens.add({
              targets: modalParts,
              scaleX: 1,
              scaleY: 1,
              duration: 480,
              ease: "Back.easeOut",
            });

            this.tweens.add({
              targets: crown,
              angle: { from: -8, to: 8 },
              duration: 500,
              yoyo: true,
              repeat: -1,
            });
          }

          confetti() {
            if (reducedMotion) return;
            const colors = [0xff6fae, 0x9d73df, 0x55d6a8, 0xffd25e, 0x68c8ff];

            for (let i = 0; i < 100; i++) {
              const x = Phaser.Math.Between(0, W);
              const r = this.add
                .rectangle(
                  x,
                  -30,
                  Phaser.Math.Between(6, 12),
                  Phaser.Math.Between(10, 22),
                  Phaser.Utils.Array.GetRandom(colors),
                )
                .setDepth(110);

              this.tweens.add({
                targets: r,
                y: H + 70,
                x: x + Phaser.Math.Between(-110, 110),
                angle: Phaser.Math.Between(180, 760),
                duration: Phaser.Math.Between(1800, 3300),
                delay: Phaser.Math.Between(0, 900),
                ease: "Sine.easeIn",
                onComplete: () => r.destroy(),
              });
            }
          }
        }

        const game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: "game",
          width: W * renderScale,
          height: H * renderScale,
          backgroundColor: "#fff8fd",
          scene: MagicBagScene,
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.NO_CENTER,
          },
          render: { antialias: true },
        });
        window.magicBagGame = game;

        // Browsers require a user gesture before recorded audio can start. Play
        // the one-time greeting on the first gesture, never on scene restarts.
        const playInitialGreeting = () => {
          hasInteracted = true;
          const scene = game.scene.getScene("MagicBag") as MagicBagScene;
          if (scene?.scene.isActive()) scene.playAppEntry();
        };
        window.addEventListener("pointerdown", playInitialGreeting, {
          once: true,
          capture: true,
          signal: appLifetime.signal,
        });
        window.addEventListener("keydown", playInitialGreeting, {
          once: true,
          capture: true,
          signal: appLifetime.signal,
        });

        daySelect.addEventListener("change", () => {
          const scene = game.scene.getScene("MagicBag") as MagicBagScene;
          if (
            !scene?.scene.isActive() ||
            scene.activeDragCard ||
            scene.pendingDrag ||
            scene.returningCard ||
            scene.packingCard
          ) {
            daySelect.value = String(selectedDay);
            return;
          }
          const nextDay = Number(daySelect.value);
          if (!daySelect.value || !Number.isInteger(nextDay) || !DATA.days[nextDay]) {
            daySelect.value = selectedDay < 0 ? "" : String(selectedDay);
            return;
          }
          selectedDay = nextDay;
          ITEMS = packingListFor(DATA, selectedDay);
          renderDayInfo();
          showDayStart();
        });

        // The day switch stays blocked until the child explicitly starts.
        dayStartDialog.addEventListener("cancel", (event) => event.preventDefault());
        dayStartButton.addEventListener("click", () => {
          hasInteracted = true;
          daySelect.blur();
          dayStartDialog.close();
          const scene = game.scene.getScene("MagicBag") as MagicBagScene;
          scene.scene.restart({});
        });

        window.addEventListener("resize", () => {
          requestAnimationFrame(() => {
            const scene = game.scene.getScene("MagicBag") as MagicBagScene;
            if (!scene?.scene.isActive()) return;
            if (portrait !== portraitQuery.matches) {
              const packedIds = scene.cards
                .filter((card) => card.phase === "packed")
                .map((card) => card.item.id);
              portrait = portraitQuery.matches;
              W = portrait ? 420 : 1100;
              game.scale.setGameSize(W * renderScale, H * renderScale);
              scene.scene.restart({ packedIds });
            } else {
              scene.positionControls();
            }
          });
        }, { signal: appLifetime.signal });

        window.addEventListener("pagehide", () => {
          appLifetime.abort();
          stopVoice(true);
          game.destroy(true);
          if (window.magicBagGame === game) delete window.magicBagGame;
        }, { once: true });

        // Use the same scene state for optional browser-agent access.
        const modelContext = document.modelContext;
        if (modelContext?.registerTool) {
          const lifecycle = new AbortController();
          window.addEventListener("pagehide", () => lifecycle.abort(), {
            once: true,
          });
          const getScene = () => {
            const scene = game.scene.getScene("MagicBag") as MagicBagScene;
            if (!scene?.scene.isActive() || !scene.cards.length)
              throw new Error("The game is still loading.");
            return scene;
          };
          const readProgress = () => {
            const scene = getScene();
            return {
              day: DAYS[selectedDay],
              endsAt: DATA.days[selectedDay].endsAt,
              lessons: DATA.days[selectedDay].lessons.map(
                (lesson) => lesson.label,
              ),
              packed: scene.packed,
              total: ITEMS.length,
              finished: scene.finished,
              items: scene.cards.map((card) => ({
                id: card.item.id,
                label: card.item.label,
                subject: card.item.subject,
                lessons: card.item.lessons,
                packed: card.phase === "packed",
              })),
            };
          };
          const register = (tool: ModelContextTool): void => {
            try {
              Promise.resolve(
                modelContext.registerTool(tool, { signal: lifecycle.signal }),
              ).catch(() => {});
            } catch (_) {
              /* Game play works in browsers without WebMCP. */
            }
          };
          register({
            name: "get_packing_progress",
            title: "Read school bag progress",
            description:
              "Read the items and progress in the current school bag game.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute: readProgress,
          });
          register({
            name: "pack_school_items",
            title: "Pack school items",
            description:
              "Pack the next items from the front of the stack in timetable order, with the same animations and completion as dragging the cards.",
            inputSchema: {
              type: "object",
              properties: {
                itemIds: {
                  type: "array",
                  minItems: 1,
                  uniqueItems: true,
                  items: { type: "string" },
                },
              },
              required: ["itemIds"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            async execute(input: unknown) {
              const ids = typeof input === "object" && input !== null && "itemIds" in input
                ? input.itemIds
                : undefined;
              if (
                typeof input !== "object" || input === null ||
                Object.keys(input).some((key) => key !== "itemIds") ||
                !Array.isArray(ids) ||
                !ids.length ||
                new Set(ids).size !== ids.length ||
                ids.some((id) => !ITEMS.some((item) => item.id === id))
              )
                throw new Error("Provide unique valid itemIds.");
              const scene = getScene();
              if (
                scene.finished ||
                scene.activeDragCard ||
                scene.pendingDrag ||
                scene.returningCard ||
                scene.packingCard ||
                scene.cards.some((card) => card.phase === "packing")
              )
                throw new Error("Wait for the current action to finish.");
              const remaining = scene.cards.filter((card) => card.phase !== "packed");
              if (ids.some((id, index) => remaining[index]?.item.id !== id))
                throw new Error("Pack the front items in timetable order.");
              for (const id of ids) {
                const card = scene.cards.find((card) => card.item.id === id);
                if (!card) throw new Error(`Item ${id} is no longer available.`);
                if (card.phase !== "packed") {
                  const completed = await scene.pack(card);
                  if (!completed) throw new Error("Packing was interrupted by a restart.");
                }
              }
              return readProgress();
            },
          });
        }
      })().catch((error) => {
        console.error("Magic bag failed to initialize", error);
        requiredElement("loading").textContent =
          "לא הצלחנו לטעון את נתוני המערכת. נסו לרענן את הדף.";
      });
