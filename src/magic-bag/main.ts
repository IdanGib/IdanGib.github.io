import { CanvasCard } from "./canvas-card";
import { CanvasShell, measureToolbar } from "./canvas-shell";
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
  visual: CanvasCard;
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
  shadow: 0x684c73, mascot: 0xffb8d7, mascotEar: 0xffcde3,
  mascotInk: 0x4f405e, mascotCheek: 0xff80ae, bagStrap: 0xa17be7,
  bagStrapHover: 0xb689ff, bag: 0x9d73df, bagHover: 0xb688ff,
  bagPanel: 0xcaa9f6, bagPanelHover: 0xddc3ff, bagTop: 0x8259c2,
  bagPocket: 0xff8ebe, bagPocketLine: 0xffbad7, progress: "#a889c5",
  overlay: 0x4a3557, dialogBorder: 0xffadd2, dialogTitle: "#72548b",
  dialogCopy: "#927ba1", accent: 0x9d73df,
};

const BOY_PALETTE: typeof GIRL_PALETTE = {
  page: "#f4fbff", pageNumber: 0xf4fbff, blobOne: 0xcdefff,
  blobTwo: 0xd5e6ff, sparkleOne: "#79c9e6", sparkleTwo: "#8faee5",
  heading: "#24516f", copy: "#527087", label: "#31647f",
  shadow: 0x24506a, mascot: 0x58c7df, mascotEar: 0x92e0ee,
  mascotInk: 0x203f55, mascotCheek: 0x43a9d1, bagStrap: 0x287fb5,
  bagStrapHover: 0x43a9d1, bag: 0x2789c7, bagHover: 0x36a4d8,
  bagPanel: 0x72c5e8, bagPanelHover: 0x91d8ef, bagTop: 0x176b9c,
  bagPocket: 0x50c6af, bagPocketLine: 0x92e1d1, progress: "#6598b6",
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
        const controls = requiredElement<HTMLDivElement>("keyboard-controls");
        const liveStatus = requiredElement<HTMLParagraphElement>("game-status");
        let shell: CanvasShell | undefined;
        let uiScene: MagicBagUIScene | undefined;
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
          const scene = window.magicBagGame?.scene.getScene("MagicBag") as MagicBagScene | undefined;
          scene?.cancelGesture();
          shell?.openProfile(kidProfile?.name ?? "", kidProfile?.gender, firstVisit);
        }

        function saveProfile(name: string, gender: Gender): void {
          name = name.trim();
          if (!name || (gender !== "boy" && gender !== "girl")) return;
          const firstVisit = !kidProfile;
          hasInteracted = true;
          kidProfile = { name, gender };
          applyProfileColors(kidProfile);
          try {
            localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(kidProfile));
          } catch (_) { /* Personalization still works without browser storage. */ }
          document.title = `תיק הקסם ✨ | ${name}`;
          requiredElement("page-title").textContent = `משימת תיק הקסם עם ${name}`;
          shell?.closeModal();
          updateLayout();
          uiScene?.refreshShell();
          const scene = window.magicBagGame?.scene.getScene("MagicBag") as MagicBagScene | undefined;
          if (scene?.scene.isActive()) scene.scene.restart({});
          if (firstVisit) scheduleInstallSuggestion();
        }
        if (kidProfile) applyProfileColors(kidProfile);

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
          installSuggestionDismissed = true;
          shell?.closeModal();
        };

        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        const showInstallSuggestion = (): void => {
          const message = deferredInstallPrompt
            ? "הוסיפו את האפליקציה למסך הבית כדי לפתוח אותה בפעם הבאה בלי להיכנס לדפדפן."
            : isIos
              ? "לחצו על כפתור השיתוף בדפדפן, ואז בחרו ״הוספה למסך הבית״ כדי לפתוח את תיק הקסם ישירות."
              : "פתחו את תפריט הדפדפן ובחרו ״הוספה למסך הבית״ כדי לפתוח את תיק הקסם ישירות.";
          shell?.openInstall(message, deferredInstallPrompt ? "הוספה למסך הבית" : "הבנתי");
        };
        const installApp = async (): Promise<void> => {
          if (deferredInstallPrompt) {
            await deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
          }
          dismissInstallSuggestion();
        };
        const scheduleInstallSuggestion = (): void => {
          if (!mobileBrowser || standalone || installSuggestionDismissed) return;
          window.setTimeout(() => {
            if (kidProfile && !shell?.modalOpen) showInstallSuggestion();
          }, 900);
        };

        if ("serviceWorker" in navigator) {
          const serviceWorkerUrl = new URL(
            "magic-bag-sw.js",
            new URL(import.meta.env.BASE_URL, location.href),
          );
          void navigator.serviceWorker.register(serviceWorkerUrl, {
            scope: new URL(import.meta.env.BASE_URL, location.href).pathname,
          });
        }
        if (kidProfile) {
          document.title = `תיק הקסם ✨ | ${kidProfile.name}`;
          requiredElement("page-title").textContent = `משימת תיק הקסם עם ${kidProfile.name}`;
        }
        const currentProfile = (): Profile => {
          if (!kidProfile) throw new Error("A profile is required before starting the game");
          return kidProfile;
        };
        const genderText = (girlText: string, boyText: string): string =>
          currentProfile().gender === "girl" ? girlText : boyText;
        const palette = () => kidProfile?.gender === "boy" ? BOY_PALETTE : GIRL_PALETTE;

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
        // This JSON is the single source for lesson order, equipment, dismissal time and recorded voice.
        const DAYS = DATA.days.map((day) => day.label);

        // A day becomes active only after the child explicitly chooses it.
        let selectedDay = -1;
        let ITEMS: PackingItem[] = [];
        let dayBlocked = false;
        let layout = calculateLayout();
        function setDayBlocked(value: boolean): void {
          dayBlocked = value;
          shell?.setDayDisabled(value);
        }

        function calculateLayout() {
          const width = window.innerWidth;
          const height = window.innerHeight;
          const inset = portrait ? 8 : 16;
          const toolbar = measureToolbar(width, inset, kidProfile ? DAYS : [], selectedDay, selectedDay < 0 ? undefined : DATA.days[selectedDay].endsAt ?? undefined);
          const gameTop = inset + toolbar.height + 12;
          const availableWidth = Math.min(width - inset * 2, 1440);
          const availableHeight = Math.max(1, portrait ? height - gameTop - inset : height - 112);
          const scale = Math.min(availableWidth / W, availableHeight / H);
          return { width, height, inset, toolbarHeight: toolbar.height, scale,
            x: (width - W * scale) / 2,
            y: gameTop + (availableHeight - H * scale) / 2,
            gameWidth: W * scale, gameHeight: H * scale };
        }
        function updateLayout(): void { layout = calculateLayout(); }

        function chooseDay(index: number): void {
          const scene = game.scene.getScene("MagicBag") as MagicBagScene;
          if (!kidProfile || dayBlocked || shell?.modalOpen || !scene?.scene.isActive() || scene.activeDragCard || scene.pendingDrag || scene.returningCard || scene.cards.some((card) => card.phase === "packing")) return;
          if (!Number.isInteger(index) || !DATA.days[index]) return;
          hasInteracted = true;
          selectedDay = index;
          ITEMS = packingListFor(DATA, selectedDay);
          setDayBlocked(true);
          updateLayout();
          scene.positionControls();
          uiScene?.refreshShell();
          shell?.openDayStart(`מתכוננים ליום ${DAYS[index]}!`, `${currentProfile().name}, הגיע הזמן להכין יחד את תיק הקסם ליום ${DAYS[index]}.`);
          liveStatus.textContent = DATA.generalAudio.appEntry.textTemplate.replace("{day}", DAYS[index]);
          void startAppEntry(index);
        }
        function startDay(): void {
          hasInteracted = true;
          setDayBlocked(false);
          shell?.closeModal();
          const scene = game.scene.getScene("MagicBag") as MagicBagScene;
          scene.scene.restart({});
        }

        class MagicBagScene extends Phaser.Scene {
          cards: CardState[] = [];
          finished = false;
          activeDragCard: CardState | null = null;
          activeDragPointerId: number | null = null;
          pendingDrag: PendingDrag | null = null;
          returningCard: CardState | null = null;
          suppressClickUntil = 0;

          mascot!: Phaser.GameObjects.Container;
          mascotScale = 1;
          bag!: Phaser.GameObjects.Container;
          bagGraphics!: Phaser.GameObjects.Graphics;
          bagScale = 1;
          progressMeter: Phaser.GameObjects.Container | null = null;
          daySelectionPrompt: Phaser.GameObjects.Text | null = null;
          progressText: Phaser.GameObjects.Text | null = null;
          progressBar: Phaser.GameObjects.Graphics | null = null;
          progressValue = { value: 0 };
          stackPanel: HTMLDivElement | null = null;
          replayButton: HTMLButtonElement | null = null;
          cancelGesture: () => void = () => {};
          private pendingPackResolutions = new Set<(completed: boolean) => void>();

          get packed(): number {
            return this.cards.filter((card) => card.phase === "packed").length;
          }

          constructor() {
            super({ key: "MagicBag", active: true });
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
            this.suppressClickUntil = 0;
            this.progressValue.value = 0;
            setDayBlocked(false);

            this.positionControls();
            if (!kidProfile) return;

            this.drawBackground();
            this.drawHeader();
            this.drawMascot();
            this.drawBag();
            this.drawCards();
            this.setupDrag();
            this.setupKeyboardControls();
            this.drawProgress();
            this.updateProgress();

            this.events.once("shutdown", () => {

              stopVoice();
              controls.replaceChildren();
              controls.removeAttribute("role");
              controls.removeAttribute("aria-modal");
              controls.removeAttribute("aria-label");
              this.clearDragPreview();
              this.pendingPackResolutions.forEach((resolve) => resolve(false));
              this.pendingPackResolutions.clear();
            });
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
            uiScene?.refreshShell();
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

          drawMascot() {
            const mascotX = portrait ? 50 : W / 2 - 235;
            const mascotY = 650;
            this.mascotScale = portrait ? 0.42 : 0.8;
            this.mascot = this.add
              .container(mascotX, mascotY)
              .setScale(this.mascotScale);

            const g = this.add.graphics();
            g.fillStyle(palette().shadow, 0.12);
            g.fillEllipse(0, 79, 135, 28);

            g.fillStyle(palette().mascot);
            g.fillCircle(0, 0, 64);
            g.fillStyle(palette().mascotEar);
            g.fillCircle(-30, -51, 25);
            g.fillCircle(30, -51, 25);

            g.fillStyle(palette().mascotInk);
            g.fillCircle(-20, -6, 6);
            g.fillCircle(20, -6, 6);

            g.lineStyle(4, palette().mascotInk);
            g.beginPath();
            g.arc(0, 8, 22, 0.15, Math.PI - 0.15);
            g.strokePath();

            g.fillStyle(palette().mascotCheek, 0.45);
            g.fillCircle(-40, 17, 11);
            g.fillCircle(40, 17, 11);

            this.mascot.add(g);

            this.tweens.add({
              targets: this.mascot,
              y: reducedMotion ? mascotY : mascotY - 10,
              angle: reducedMotion ? 0 : 2.5,
              duration: 1250,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut",
            });

            this.crispText(mascotX, portrait ? 712 : 745, currentProfile().name, {
              fontFamily: "Arial",
              fontSize: 20,
              fontStyle: "bold",
              color: palette().label,
            }).setOrigin(0.5);
          }

          drawBag() {
            const bagX = W / 2;
            const bagY = 640;
            this.bagScale = 0.82;
            this.bag = this.add.container(bagX, bagY).setScale(this.bagScale);
            this.bagGraphics = this.add.graphics();

            const shadow = this.add.graphics();
            shadow.fillStyle(palette().shadow, 0.12);
            shadow.fillEllipse(0, 146, 260, 48);

            const star = this.crispText(0, -5, "★", {
              fontFamily: "Arial",
              fontSize: 56,
              color: "#fff1a5",
            }).setOrigin(0.5);

            this.bag.add([shadow, this.bagGraphics, star]);
            this.redrawBag(false);

            this.crispText(bagX, 772, "תיק הקסם 🎒", {
              fontFamily: "Arial",
              fontSize: 21,
              fontStyle: "bold",
              color: palette().copy,
            }).setOrigin(0.5);

            this.tweens.add({
              targets: this.bag,
              y: reducedMotion ? bagY : bagY - 10,
              duration: 1700,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut",
            });
          }

          redrawBag(hovered: boolean): void {
            const g = this.bagGraphics;
            g.clear();

            g.lineStyle(18, hovered ? palette().bagStrapHover : palette().bagStrap, 1);
            g.beginPath();
            g.arc(-64, 12, 83, 1.65, 4.55);
            g.strokePath();
            g.beginPath();
            g.arc(64, 12, 83, -1.4, 1.4);
            g.strokePath();

            g.fillStyle(hovered ? palette().bagHover : palette().bag);
            g.fillRoundedRect(-108, -120, 216, 250, 48);

            g.fillStyle(hovered ? palette().bagPanelHover : palette().bagPanel);
            g.fillRoundedRect(-92, -101, 184, 211, 40);

            g.fillStyle(palette().bagTop);
            g.fillRoundedRect(-78, -98, 156, 52, 25);

            g.fillStyle(palette().bagPocket);
            g.fillRoundedRect(-66, 38, 132, 58, 22);

            g.lineStyle(3, palette().bagPocketLine);
            g.strokeRoundedRect(-66, 38, 132, 58, 22);
          }

          drawProgress() {
            const scale = layout.scale;
            const width = portrait ? 304 : 380;
            this.daySelectionPrompt = this.crispText(W / 2, 91, "בחרו יום", {
              fontFamily: "Arial", fontSize: Math.max(30, Math.min(44, layout.width * .07)) / scale,
              fontStyle: "bold", color: palette().heading,
            }).setOrigin(.5, 0);
            const meter = this.add.container(W / 2, 91).setDepth(4);
            const summary = this.crispText(-19 / scale, 14.5 / scale, "", {
              fontFamily: "Arial", fontSize: 18 / scale, fontStyle: "bold", color: palette().heading,
            }).setOrigin(.5);
            const star = this.crispText(0, 14.5 / scale, "★", {
              fontFamily: "Arial", fontSize: 29 / scale, color: "#f0b93e",
            }).setOrigin(.5);
            this.progressText = summary;
            this.progressBar = this.add.graphics();
            meter.add([summary, star, this.progressBar]);
            this.progressMeter = meter;
            // Keep the golden star on the right in the original RTL summary.
            const textWidth = summary.width;
            star.x = (textWidth / 2) + 5 / scale;
            this.progressBar.fillStyle(palette().accent === 0x9d73df ? 0xf1e7ff : 0xdff3ff)
              .fillRoundedRect(-width / 2, 37 / scale, width, 12 / scale, 6 / scale);
          }

          updateProgress() {
            const total = ITEMS.length;
            const waitingForDay = selectedDay < 0;
            this.daySelectionPrompt?.setVisible(waitingForDay);
            this.progressMeter?.setVisible(!waitingForDay);
            // Isolate the mixed Hebrew/numeric label without changing Phaser's canvas alignment.
            this.progressText?.setText(`\u2067${this.packed} מתוך ${total} פריטים בתיק\u2069`);
            const star = this.progressMeter?.list[1];
            if (star && this.progressText) {
              star.x = this.progressText.width / 2 + 5 / layout.scale;
              this.progressText.x = -(star.width + 10 / layout.scale) / 2;
            }
            const progress = this.progressValue;
            this.tweens.killTweensOf(progress);
            this.tweens.add({ targets: progress, value: this.packed / (total || 1), duration: reducedMotion ? 0 : 420,
              onUpdate: () => this.paintProgress(), onComplete: () => this.paintProgress() });
            this.paintProgress();
            liveStatus.textContent = waitingForDay ? "בחרו יום" : `יום ${DAYS[selectedDay]}: ${this.packed} מתוך ${total} פריטים בתיק`;
          }
          paintProgress(): void {
            if (!this.progressBar) return;
            const width = portrait ? 304 : 380;
            const scale = layout.scale;
            this.progressBar.clear().fillStyle(palette().accent === 0x9d73df ? 0xf1e7ff : 0xdff3ff)
              .fillRoundedRect(-width / 2, 37 / scale, width, 12 / scale, 6 / scale);
            const valueWidth = width * this.progressValue.value;
            if (valueWidth > 0) this.progressBar.fillStyle(palette().accent)
              .fillRoundedRect(width / 2 - valueWidth, 37 / scale, valueWidth, 12 / scale, Math.min(6 / scale, valueWidth / 2));
          }

          drawCards() {
            ITEMS.forEach((item) => {
              const subject = [item.subject, this.lessonLabel(item)].filter(Boolean).join(" · ");
              const visual = new CanvasCard(this, item, {
                portrait, worldScale: layout.scale, resolution: renderScale,
                ink: currentProfile().gender === "boy" ? "#24465f" : "#51425f",
                softInk: currentProfile().gender === "boy" ? "#527087" : "#80698f",
                subject, action: item.audioUrl?.trim()
                  ? genderText("גררי לתיק או לחצי להשמעה", "גרור לתיק או לחץ להשמעה")
                  : genderText("גררי לתיק", "גרור לתיק"),
              }, item.imageUrl?.trim() ? resolveMediaUrl(item.imageUrl, dataUrl) : undefined);
              this.cards.push({ item, visual, container: visual.container,
                button: document.createElement("button"), phase: "ready",
                homeX: W / 2, homeY: 345, dragOffsetX: 0, dragOffsetY: 0 });
            });
          }
          setupKeyboardControls() {
            controls.replaceChildren();
            this.replayButton = null;
            const panel = document.createElement("div");
            panel.className = "packing-panel";
            panel.setAttribute("role", "region");
            panel.setAttribute("aria-label", `ערימת הציוד ליום ${DAYS[selectedDay]}, לפי סדר השיעורים`);
            this.stackPanel = panel;
            controls.append(panel);
            this.cards.forEach((card) => {
              const button = card.button;
              button.type = "button";
              button.className = "item-button";
              button.textContent = `${card.item.label}, ${card.item.subject}`;
              button.setAttribute("aria-label", `${card.item.label}, ${card.item.subject}, ${this.lessonLabel(card.item)}. ${genderText("גררי", "גרור")} לתיק. חץ מטה אורז מהמקלדת${card.item.audioUrl?.trim() ? genderText("; לחצי להשמעה", "; לחץ להשמעה") : ""}`);
              button.setAttribute("aria-keyshortcuts", "ArrowDown");
              button.addEventListener("click", () => this.tapCard(card));
              button.addEventListener("focus", () => card.visual.setFocused(true));
              button.addEventListener("blur", () => card.visual.setFocused(false));
              button.addEventListener("keydown", (event) => {
                if (event.key !== "ArrowDown" || !this.canPack(card)) return;
                event.preventDefault(); hasInteracted = true; void this.pack(card);
              });
              panel.append(button);
            });
            this.refreshDeck();
          }
          tapCard(card: CardState): void {
            if (!this.canPack(card) || shell?.modalOpen || this.activeDragCard || performance.now() < this.suppressClickUntil) return;
            hasInteracted = true;
            this.tweens.add({ targets: card.container, scaleX: .96, scaleY: .96, duration: reducedMotion ? 1 : 90, yoyo: true });
            if (card.item.audioUrl?.trim()) this.speak(card.item.audioUrl, true);
          }

          canPack(card: CardState): boolean {
            return (
              !shell?.modalOpen &&
              !dayBlocked &&
              !this.finished &&
              !this.returningCard &&
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
              const inMotion = card.phase === "dragging" || card.phase === "returning" || card.phase === "packing";
              card.button.hidden = !visible;
              card.button.disabled = !front || !this.canPack(card);
              card.button.tabIndex = front ? 0 : -1;
              card.button.setAttribute("aria-hidden", String(!front));
              card.button.setAttribute("data-deck-front", String(front));
              card.button.setAttribute("data-deck-depth", String(depth));
              card.visual.setContentVisible(depth < 2 || inMotion);
              card.container.setVisible(inMotion || visible);
              if (!inMotion) {
                const deckScale = 1 - .07 * Math.max(0, depth);
                card.container.setPosition(W / 2, 240 - 18 * Math.max(0, depth) / layout.scale + 105 * deckScale)
                  .setScale(deckScale).setDepth(8 - depth);
              } else card.container.setDepth(20);
            });
          }
          positionControls() {
            this.cameras.main.setViewport(layout.x * renderScale, layout.y * renderScale,
              layout.gameWidth * renderScale, layout.gameHeight * renderScale)
              .setZoom(layout.scale * renderScale).centerOn(W / 2, H / 2)
              .setBackgroundColor(palette().page);
          }
          reflow(): void {
            this.positionControls();
            this.cards.forEach((card) => card.visual.resize(layout.scale, portrait));
            this.refreshDeck();
            this.progressText?.setFontSize(18 / layout.scale);
            const star = this.progressMeter?.list[1] as Phaser.GameObjects.Text | undefined;
            star?.setFontSize(29 / layout.scale);
            this.daySelectionPrompt?.setFontSize(Math.max(30, Math.min(44, layout.width * .07)) / layout.scale);
            if (star && this.progressText) {
              star.x = this.progressText.width / 2 + 5 / layout.scale;
              this.progressText.x = -(star.width + 10 / layout.scale) / 2;
            }
            this.paintProgress();
          }
          pointerPosition(event: Pick<PointerEvent, "clientX" | "clientY">): Point {
            return { x: (event.clientX - layout.x) / layout.scale, y: (event.clientY - layout.y) / layout.scale };
          }
          prepareCard(card: CardState): void {
            card.homeX = W / 2;
            card.homeY = 345;
            card.prepared = true;
            card.container.setPosition(card.homeX, card.homeY).setScale(1).setAngle(0).setAlpha(1).setVisible(true).setDepth(20);
          }
          showDragPreview(card: CardState): void { card.container.setVisible(true).setDepth(20); }
          positionDragPreview(_card: CardState): void { /* Phaser owns the animated card image. */ }
          clearDragPreview(): void { /* No visible DOM preview exists. */ }

          restartGame() {
            hasInteracted = true;
            this.scene.restart({});
            this.events.once("create", () =>
              this.cards[0]?.button.focus({ preventScroll: true }),
            );
          }

          bagBounds(): { left: number; right: number; top: number; bottom: number } {
            // The backpack itself is animated, so derive the drop area from its
            // CURRENT x/y rather than from a fixed rectangle created earlier.
            return {
              left: this.bag.x - 118 * this.bagScale,
              right: this.bag.x + 118 * this.bagScale,
              top: this.bag.y - 150 * this.bagScale,
              bottom: this.bag.y + 145 * this.bagScale,
            };
          }

          isInsideBag(x: number, y: number): boolean {
            const { left, right, top, bottom } = this.bagBounds();
            return x >= left && x <= right && y >= top && y <= bottom;
          }

          dragScaleAt(x: number, y: number): number {
            const { left, right, top, bottom } = this.bagBounds();
            const dx = Math.max(left - x, 0, x - right);
            const dy = Math.max(top - y, 0, y - bottom);
            const proximity = Math.max(0, 1 - Math.hypot(dx, dy) / 180);
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
            this.events.once("shutdown", () => lifetime.abort());
            // Phaser's mouse/touch events do not carry DOM pointer IDs. Listen
            // on its sole canvas to keep one capture path for both input types.
            this.game.canvas.addEventListener("pointerdown", (event) => {
              const card = this.cards.find((entry) => entry.phase !== "packed");
              if (!card || !this.canPack(card) || shell?.modalOpen || this.pendingDrag || this.activeDragCard || event.button !== 0) return;
              // The day popup can cover the card. Respect the UI scene's top
              // layer before beginning a native pointer capture underneath it.
              if (shell && Object.values(shell.hitTargets).some((rect) =>
                event.clientX >= rect.x && event.clientX <= rect.x + rect.width &&
                event.clientY >= rect.y && event.clientY <= rect.y + rect.height)) return;
              const pointer = this.pointerPosition(event);
              const halfWidth = (portrait ? 152 : 190) * card.container.scaleX;
              const halfHeight = 105 * card.container.scaleY;
              if (Math.abs(pointer.x - card.container.x) > halfWidth || Math.abs(pointer.y - card.container.y) > halfHeight) return;
              this.pendingDrag = { card, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
              shell?.setDayDisabled(true);
              this.game.canvas.setPointerCapture(event.pointerId);
            }, options);
            const releaseCapture = (pending: PendingDrag | null) => {
              if (pending && this.game.canvas.hasPointerCapture(pending.pointerId))
                this.game.canvas.releasePointerCapture(pending.pointerId);
            };
            const cancelDrag = () => {
              const pending = this.pendingDrag;
              const card = this.activeDragCard;
              this.pendingDrag = null;
              this.activeDragCard = null;
              this.activeDragPointerId = null;
              releaseCapture(pending);
              if (!card) { shell?.setDayDisabled(dayBlocked); return; }
              this.suppressClickUntil = performance.now() + 400;
              this.redrawBag(false);
              this.bag.setScale(this.bagScale);
              this.returnHome(card);
            };
            this.cancelGesture = cancelDrag;
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
                  this.activeDragPointerId = event.pointerId;
                  const start = this.pointerPosition({
                    clientX: pending.x,
                    clientY: pending.y,
                  });
                  pending.card.dragOffsetX = start.x - pending.card.homeX;
                  pending.card.dragOffsetY = start.y - pending.card.homeY;
                  setDayBlocked(true);
                }
                const card = this.activeDragCard;
                this.updateDraggedCard(card, pointer);
                const over = this.isInsideBag(pointer.x, pointer.y);
                this.redrawBag(over);
                this.bag.setScale(this.bagScale * (over ? 1.06 : 1));
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
                if (!card) { shell?.setDayDisabled(dayBlocked); this.tapCard(pending.card); return; }
                this.suppressClickUntil = performance.now() + 400;
                this.redrawBag(false);
                this.bag.setScale(this.bagScale);
                const pointer = this.pointerPosition(event);
                this.updateDraggedCard(card, pointer);
                if (this.isInsideBag(pointer.x, pointer.y)) this.pack(card);
                else this.returnHome(card);
              },
              options,
            );
            window.addEventListener("pointercancel", cancelDrag, options);
            window.addEventListener("blur", cancelDrag, options);
            this.game.canvas.addEventListener(
              "lostpointercapture",
              (event) => {
                if (event.pointerId === this.pendingDrag?.pointerId)
                  cancelDrag();
              },
              options,
            );
          }

          pack(card: CardState): Promise<boolean> {
            if (!this.canPack(card) && card.phase !== "dragging") return Promise.resolve(false);
            let settle!: (completed: boolean) => void;
            const result = new Promise<boolean>((resolve) => { settle = resolve; });
            this.pendingPackResolutions.add(settle);
            this.tweens.killTweensOf(card.container);
            if (!card.prepared) this.prepareCard(card);
            this.showDragPreview(card);
            card.button.hidden = true;
            card.phase = "packing";
            setDayBlocked(true);
            this.refreshDeck();
            this.sparkles(card.container.x, card.container.y, card.item.color);

            this.tweens.add({
              targets: card.container,
              x: this.bag.x,
              y: this.bag.y,
              scale: 0.12,
              alpha: 0,
              angle: Phaser.Math.Between(-20, 20),
              duration: 480,
              ease: "Cubic.easeIn",
              onUpdate: () => this.positionDragPreview(card),
              onComplete: () => {
                this.clearDragPreview();
                card.container.setVisible(false);
                card.phase = "packed";
                setDayBlocked(!!this.activeDragCard || this.packed === ITEMS.length);
                this.refreshDeck();
                this.updateProgress();
                this.starPop();

                this.tweens.add({
                  targets: this.bag,
                  scaleX: this.bagScale * 1.09,
                  scaleY: this.bagScale * 0.93,
                  duration: 90,
                  yoyo: true,
                  repeat: 1,
                });

                if (this.packed === ITEMS.length) {
                  this.time.delayedCall(750, () => {
                    this.finish();
                    this.pendingPackResolutions.delete(settle);
                    settle(true);
                  });
                } else {
                  this.time.delayedCall(250, () => this.speakCurrent());
                  this.pendingPackResolutions.delete(settle);
                  settle(true);
                }
              },
            });
            return result;
          }

          returnHome(card: CardState): void {
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
                card.container.setVisible(true);
                card.prepared = false;
                setDayBlocked(!!this.activeDragCard);
                this.refreshDeck();
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
            if (!kidProfile || selectedDay < 0 || appEntryPlayedDay === selectedDay || !hasInteracted) return;
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
            const star = this.crispText(this.bag.x, this.bag.y - 155, "⭐", { fontFamily: "Arial", fontSize: 54 })
              .setOrigin(.5).setScale(0).setDepth(30);
            this.tweens.add({ targets: star, y: star.y - 48, scaleX: 1.4, scaleY: 1.4, angle: 18,
              duration: reducedMotion ? 90 : 327, ease: "Quad.easeOut",
              onComplete: () => this.tweens.add({ targets: star, y: star.y - 24, alpha: 0,
                duration: reducedMotion ? 110 : 383, onComplete: () => star.destroy() }) });
          }

          finish() {
            this.finished = true;
            if (this.stackPanel) this.stackPanel.hidden = true;
            setDayBlocked(false);
            const finalMessage = DATA.generalAudio.finalDialog;
            liveStatus.textContent = `${finalMessage.text} ${currentProfile().name}! התיק מוכן!`;
            // Completion must always announce "כל הכבוד", even when a welcome
            // or item recording has not finished yet.
            this.speak(finalMessage.humanAudioUrl, true);
            this.confetti();

            this.tweens.add({
              targets: this.mascot,
              scale: this.mascotScale * (reducedMotion ? 1 : 1.22),
              angle: { from: -7, to: 7 },
              duration: 170,
              yoyo: true,
              repeat: 5,
            });

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

            btnBg.on("pointerdown", () => { if (!shell?.modalOpen) this.restartGame(); });
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

        class MagicBagUIScene extends Phaser.Scene {
          private frame: Phaser.GameObjects.Image | undefined;
          get canvasUi(): CanvasShell | undefined { return shell; }
          get viewportLayout() { return layout; }
          constructor() { super({ key: "MagicBagUI", active: true }); }
          create(): void {
            uiScene = this;
            this.cameras.main.setZoom(renderScale).centerOn(layout.width / 2, layout.height / 2);
            shell = new CanvasShell(this, renderScale, {
              onChooseDay: chooseDay, onEditProfile: () => editProfile(false), onSaveProfile: saveProfile,
              onStartDay: startDay, onInstall: () => { void installApp(); }, onDismissInstall: dismissInstallSuggestion,
            });
            requiredElement("loading").hidden = true;
            this.refreshShell();
            if (!kidProfile) editProfile(true);
            if (kidProfile) scheduleInstallSuggestion();
            this.events.once("shutdown", () => shell?.destroy());
          }
          refreshShell(): void {
            this.cameras.main.setViewport(0, 0, layout.width * renderScale, layout.height * renderScale)
              .setZoom(renderScale).centerOn(layout.width / 2, layout.height / 2);
            this.drawFrame();
            shell?.onResize(layout.width, layout.height);
            shell?.drawToolbar(layout.width, layout.inset, layout.inset, kidProfile ? DAYS : [], selectedDay,
              selectedDay < 0 ? undefined : DATA.days[selectedDay].endsAt ?? undefined, kidProfile?.gender ?? "girl");
            shell?.setDayDisabled(dayBlocked);
          }
          private drawFrame(): void {
            this.frame?.destroy();
            this.textures.remove("magic-page-frame");
            const texture = this.textures.createCanvas("magic-page-frame", Math.ceil(layout.width * renderScale), Math.ceil(layout.height * renderScale));
            const ctx = texture.context;
            ctx.scale(renderScale, renderScale);
            const boy = kidProfile?.gender === "boy";
            ctx.fillStyle = boy ? "#f4fbff" : "#fff8fd";
            ctx.fillRect(0, 0, layout.width, layout.height);
            [[.16, .16, .35, boy ? "#d9f3ff" : "#ffe3f1"], [.84, .84, .36, boy ? "#dceaff" : "#e7e0ff"]].forEach(([x, y, stop, color]) => {
              const cx = Number(x) * layout.width; const cy = Number(y) * layout.height;
              const radius = Math.hypot(Math.max(cx, layout.width - cx), Math.max(cy, layout.height - cy)) * Number(stop);
              const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
              glow.addColorStop(0, String(color)); glow.addColorStop(1, `${String(color)}00`);
              ctx.fillStyle = glow; ctx.fillRect(0, 0, layout.width, layout.height);
            });
            if (kidProfile) {
              const radius = portrait ? 24 : 28;
              ctx.save(); ctx.shadowColor = boy ? "rgba(27,83,112,.18)" : "rgba(83,52,103,.18)";
              ctx.shadowBlur = 80 * renderScale; ctx.shadowOffsetY = 28 * renderScale; ctx.fillStyle = palette().page;
              ctx.beginPath(); ctx.roundRect(layout.x, layout.y, layout.gameWidth, layout.gameHeight, radius); ctx.fill(); ctx.restore();
              ctx.save(); ctx.globalCompositeOperation = "destination-out";
              ctx.fillStyle = "#000";
              ctx.beginPath(); ctx.roundRect(layout.x, layout.y, layout.gameWidth, layout.gameHeight, radius); ctx.fill(); ctx.restore();
            } else {
              ctx.fillStyle = "#5f4976";
              ctx.font = "18px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
              ctx.fillText("תיק הקסם נפתח… ✨", layout.width / 2, layout.y + layout.gameHeight * .45);
            }
            texture.refresh();
            this.frame = this.add.image(layout.width / 2, layout.height / 2, "magic-page-frame")
              .setDisplaySize(layout.width, layout.height).setDepth(-100);
          }
        }

        const game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: "game",
          width: layout.width * renderScale,
          height: layout.height * renderScale,
          backgroundColor: "#fff8fd",
          scene: [MagicBagScene, MagicBagUIScene],
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.NO_CENTER,
          },
          render: { antialias: true, preserveDrawingBuffer: true },
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

        let resizePending = false;
        window.addEventListener("resize", () => {
          if (resizePending) return;
          resizePending = true;
          requestAnimationFrame(() => {
            resizePending = false;
            const scene = game.scene.getScene("MagicBag") as MagicBagScene;
            if (!scene?.scene.isActive()) return;
            const packedIds = scene.cards.filter((card) => card.phase === "packed").map((card) => card.item.id);
            const blocked = dayBlocked;
            const changedOrientation = portrait !== portraitQuery.matches;
            portrait = portraitQuery.matches;
            W = portrait ? 420 : 1100;
            updateLayout();
            game.scale.setGameSize(layout.width * renderScale, layout.height * renderScale);
            uiScene?.refreshShell();
            if (changedOrientation) {
              scene.scene.restart({ packedIds });
              setDayBlocked(blocked && !!shell?.modalOpen);
            } else {
              scene.reflow();
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
