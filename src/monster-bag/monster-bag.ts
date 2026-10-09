type Rect = readonly [x: number, y: number, width: number, height: number];
interface Point { x: number; y: number }
export type MonsterState = "idle" | "anticipating" | "returning" | "eating" | "chewing";

// The supplied strips are NOT equal-width sprite sheets. These rectangles follow
// the visible alpha bounds (with a small edge allowance), not width / frame count.
export const MONSTER = {
  height: 292,
  centerY: 612,
  variants: {
    boy: {
      body: "monster-bag-boy-body.png", bodyBounds: [6, 6, 1012, 1080] as Rect,
      eyes: "monster-bag-boy-eyes.png", eyeBounds: [157, 209, 1213, 660] as Rect,
      eyeSplitY: 383, lids: [[390, 213], [1138, 213]], lidColor: 0x07516b,
      eyeWidth: 490, eyeY: -151, mouthX: 0, mouthY: 70,
    },
    girl: {
      body: "monster-bag-girl-body.png", bodyBounds: [119, 85, 1015, 1081] as Rect,
      eyes: "monster-bag-girl-eyes.png", eyeBounds: [89, 221, 724, 405] as Rect,
      eyeSplitY: 318, lids: [[243, 128], [660, 128]], lidColor: 0x421535,
      eyeWidth: 506, eyeY: -151, mouthX: 0, mouthY: 70,
    },
  },
  eyes: {
    trackingX: 12, trackingY: 8, // Body-space pixels; about 3 × 2 screen pixels.
    trackingDistance: 600, responseMs: 110,
    lidCurve: 8, lidStroke: 6,
    blink: { minDelayMs: 3000, maxDelayMs: 6000, closeMs: 70, holdMs: 40,
      openMs: 110, doubleChance: 0.18, doubleGapMs: 140 },
  },
  mouth: {
    idle: { file: "mouth.png", frames: [[145, 328, 579, 285] as Rect] },
    open: { file: "mouth-open.png", frames: [
      [12, 348, 121, 47], [139, 345, 118, 51], [260, 343, 116, 54],
      [381, 340, 115, 58], [499, 339, 114, 60], [614, 336, 113, 63],
      [732, 334, 112, 66], [847, 330, 114, 72], [965, 328, 116, 75],
      [1085, 327, 117, 77], [1205, 323, 117, 83], [1325, 321, 113, 88],
      [1440, 317, 118, 94], [1561, 312, 119, 100], [1681, 309, 118, 104],
      [1800, 304, 117, 110], [1918, 299, 120, 117], [2038, 294, 126, 123],
    ] as Rect[] },
    chew: { file: "mouth-chewing.png", frames: [
      [11, 309, 123, 105], [137, 315, 114, 95], [253, 320, 110, 86],
      [370, 326, 108, 78], [481, 331, 107, 69], [594, 338, 106, 59],
      [711, 342, 100, 50], [822, 346, 98, 45], [931, 350, 97, 40],
      [1035, 353, 102, 24], [1143, 349, 98, 41], [1250, 343, 101, 50],
      [1361, 341, 104, 55], [1475, 336, 107, 62], [1587, 328, 110, 74],
      [1700, 322, 109, 82], [1815, 317, 110, 91], [1925, 312, 114, 99],
      [2040, 308, 123, 106],
    ] as Rect[] },
    width: 242,
    openScale: 2,
    eyeGap: 18,
    closedFrame: 9,
    openMs: 360,
    chewCloseMs: 240,
    chewOpenMs: 240,
    chewRestMs: 60,
    chewCycles: 3,
    chewCycleMs: 200,
    chewAmplitude: 8, // Body-space pixels: about 2 screen pixels at normal size.
  },
  proximity: { radiusX: 285, radiusY: 210, shrinkDistance: 2.8 },
  eatingMs: 480,
  completionPauseMs: 180,
} as const;

const bodyKey = (gender: "boy" | "girl") => `monster-${gender}-body`;
const eyesKey = (gender: "boy" | "girl") => `monster-${gender}-eyes`;
const mouthKey = (pose: "idle" | "open" | "chew") => `monster-mouth-${pose}`;

export function preloadMonster(scene: Phaser.Scene, base: URL): void {
  for (const gender of ["boy", "girl"] as const) {
    const variant = MONSTER.variants[gender];
    scene.load.image(bodyKey(gender), new URL(variant.body, base).href);
    scene.load.image(eyesKey(gender), new URL(variant.eyes, base).href);
  }
  for (const pose of ["idle", "open", "chew"] as const)
    scene.load.image(mouthKey(pose), new URL(MONSTER.mouth[pose].file, base).href);
}

function addFrame(scene: Phaser.Scene, key: string, name: string, rect: Rect): void {
  const texture = scene.textures.get(key);
  if (!texture.has(name)) texture.add(name, 0, ...rect);
}

/** Visual state only. The scene alone accepts items and changes packing progress. */
export class MonsterBag {
  readonly container: Phaser.GameObjects.Container;
  readonly foodLayer: Phaser.GameObjects.Container;
  readonly mouth: Phaser.GameObjects.Image;
  private readonly eyeRig: Phaser.GameObjects.Container;
  private readonly eyes: Phaser.GameObjects.Image;
  private readonly eyelids: Phaser.GameObjects.Graphics;
  private readonly eyeScale: number;
  private readonly eyeCenterY: number;
  private readonly random: () => number;
  private eyeTarget: Point | null = null;
  private gaze = { x: 0, y: 0 };
  private eyeOpening = 0;
  private blinkTime: number; // Negative while waiting, then elapsed blink time.
  private blinkFollowup = false;
  state: MonsterState = "idle";
  private variant: typeof MONSTER.variants[keyof typeof MONSTER.variants];
  private opening = 0; // Fractional strip position: 0 = rest, frames.length = fully open.
  private chewElapsed = 0;
  private onOpen?: () => void;
  private onChewed?: () => void;
  private pose = "";
  private disposed = false;
  private reducedMotion: boolean;

  constructor(scene: Phaser.Scene, gender: "boy" | "girl", x: number, reducedMotion: boolean, random = Math.random) {
    // Match the existing palette's girl fallback. Profile validation still runs first.
    const selected = gender === "boy" ? "boy" : "girl";
    this.variant = MONSTER.variants[selected];
    this.reducedMotion = reducedMotion;
    this.random = random;
    this.blinkTime = -this.nextBlinkDelay();
    addFrame(scene, bodyKey(selected), "body", this.variant.bodyBounds);
    const [eyeX, eyeY, eyeWidth, eyeHeight] = this.variant.eyeBounds;
    const browHeight = this.variant.eyeSplitY - eyeY;
    // Slice in the transparent gap, preserving the original assembled placement.
    addFrame(scene, eyesKey(selected), "brows", [eyeX, eyeY, eyeWidth, browHeight]);
    addFrame(scene, eyesKey(selected), "eyes", [eyeX, this.variant.eyeSplitY, eyeWidth, eyeHeight - browHeight]);
    for (const pose of ["idle", "open", "chew"] as const)
      MONSTER.mouth[pose].frames.forEach((rect, i) => addFrame(scene, mouthKey(pose), String(i), rect));

    this.container = scene.add.container(x, MONSTER.centerY).setScale(MONSTER.height / 1080);
    const body = scene.add.image(0, 0, bodyKey(selected), "body")
      .setScale(1080 / this.variant.bodyBounds[3]);
    this.eyeScale = this.variant.eyeWidth / eyeWidth;
    this.eyeCenterY = browHeight / 2 * this.eyeScale;
    this.eyeRig = scene.add.container(0, this.variant.eyeY);
    const brows = scene.add.image(0, (browHeight - eyeHeight) / 2 * this.eyeScale, eyesKey(selected), "brows")
      .setScale(this.eyeScale);
    this.eyes = scene.add.image(0, this.eyeCenterY, eyesKey(selected), "eyes").setScale(this.eyeScale);
    // The supplied pupils are baked into the eyes. Move the eye artwork gently;
    // blink only this lower region so the eyebrows never flatten with it.
    this.eyelids = scene.add.graphics().lineStyle(MONSTER.eyes.lidStroke, this.variant.lidColor);
    for (const [center, halfWidth] of this.variant.lids) {
      this.eyelids.beginPath();
      for (let i = 0; i <= 16; i++) {
        const t = i / 8 - 1;
        const x = (center - eyeX - eyeWidth / 2 + halfWidth * t) * this.eyeScale;
        const y = MONSTER.eyes.lidCurve * (1 - t * t);
        if (i === 0) this.eyelids.moveTo(x, y);
        else this.eyelids.lineTo(x, y);
      }
      this.eyelids.strokePath();
    }
    this.eyeRig.add([brows, this.eyes, this.eyelids]);
    this.foodLayer = scene.add.container(0, 0);
    this.mouth = scene.add.image(this.variant.mouthX, this.variant.mouthY, mouthKey("idle"), "0");
    // Keep incoming cards above the mouth/lips while they shrink and fade away.
    this.container.add([body, this.eyeRig, this.mouth, this.foodLayer]);
    this.showPose("idle", 0);
    this.updateEyes(0);
  }

  get busy(): boolean { return this.state === "eating" || this.state === "chewing"; }

  toLocal(point: Point): Point {
    return {
      x: (point.x - this.container.x) / this.container.scaleX,
      y: (point.y - this.container.y) / this.container.scaleY,
    };
  }

  get target(): Point {
    // Food always travels into the fully-open mouth after an accepted body drop.
    const open = MONSTER.mouth.open.frames[MONSTER.mouth.open.frames.length - 1];
    const y = this.mouthTop + open[3] * MONSTER.mouth.width * MONSTER.mouth.openScale / open[2] / 2;
    return {
      x: this.container.x + this.variant.mouthX * this.container.scaleX,
      y: this.container.y + y * this.container.scaleY,
    };
  }

  private get mouthTop(): number {
    const idle = MONSTER.mouth.idle.frames[0];
    return this.variant.mouthY - idle[3] * MONSTER.mouth.width / idle[2] / 2;
  }

  distance(point: Point): number {
    // Mouth proximity controls card shrinking, independently of drop acceptance.
    const local = this.toLocal(point);
    const target = this.toLocal(this.target);
    return Math.hypot(
      (local.x - target.x) / MONSTER.proximity.radiusX,
      (local.y - target.y) / MONSTER.proximity.radiusY,
    );
  }

  canInsert(point: Point, size = { width: 0, height: 0 }): boolean {
    const local = this.toLocal(point);
    const [, , width, height] = this.variant.bodyBounds;
    const bodyScale = 1080 / height;
    // Use the entire figure's bounds, never the container's bounds (which also
    // include animated eyes, mouth, and incoming food). Any card overlap counts.
    const halfWidth = width * bodyScale / 2 + size.width / (2 * Math.abs(this.container.scaleX));
    const halfHeight = height * bodyScale / 2 + size.height / (2 * Math.abs(this.container.scaleY));
    return Math.abs(local.x) <= halfWidth && Math.abs(local.y) <= halfHeight;
  }

  /** A world-space card center, or null to ease the gaze back to neutral. */
  trackTarget(point: Point | null): void {
    if (!this.disposed) this.eyeTarget = point ? this.toLocal(point) : null;
  }

  anticipate(dragging: boolean): void {
    if (this.disposed || this.busy) return;
    const next = dragging ? "anticipating" : this.opening > 0 ? "returning" : "idle";
    if (this.state === next) return;
    this.state = next;
  }

  eat(onOpen: () => void): void {
    if (this.disposed || this.busy) return;
    this.state = "eating";
    this.onOpen = onOpen;
  }

  chew(onChewed: () => void): void {
    if (this.disposed) return;
    this.state = "chewing";
    this.chewElapsed = 0;
    this.onChewed = onChewed;
    this.showPose("chew", 0);
  }

  update(delta: number): void {
    if (this.disposed) return;
    this.updateMouth(delta);
    if (!this.disposed) this.updateEyes(delta);
  }

  private updateMouth(delta: number): void {
    if (this.state === "chewing") {
      this.chewElapsed += delta;
      const { closedFrame, chewCloseMs, chewOpenMs, chewRestMs } = MONSTER.mouth;
      const bobMs = this.reducedMotion ? 0 : MONSTER.mouth.chewCycles * MONSTER.mouth.chewCycleMs;
      const bobTime = this.chewElapsed - chewCloseMs;
      if (bobTime < 0) {
        this.showPose("chew", closedFrame * this.chewElapsed / chewCloseMs);
      } else if (bobTime < bobMs) {
        this.showPose("chew", closedFrame);
        this.mouth.y = this.variant.mouthY - MONSTER.mouth.chewAmplitude *
          Math.sin(bobTime / MONSTER.mouth.chewCycleMs * Math.PI * 2);
      } else if (bobTime < bobMs + chewOpenMs) {
        const returnFrames = MONSTER.mouth.chew.frames.length - 1 - closedFrame;
        this.showPose("chew", closedFrame + returnFrames * (bobTime - bobMs) / chewOpenMs);
      } else if (bobTime < bobMs + chewOpenMs + chewRestMs) {
        // Give the last return pose time to render before easing into the smile.
        this.showPose("chew", MONSTER.mouth.chew.frames.length - 1 +
          (bobTime - bobMs - chewOpenMs) / chewRestMs);
      } else {
        this.state = "idle";
        this.opening = 0;
        this.showPose("idle", 0);
        const complete = this.onChewed;
        this.onChewed = undefined;
        complete?.();
      }
      return;
    }
    const destination = this.state === "anticipating" || this.state === "eating" ? MONSTER.mouth.open.frames.length : 0;
    if (this.opening !== destination) {
      const step = this.reducedMotion ? MONSTER.mouth.open.frames.length :
        delta * MONSTER.mouth.open.frames.length / MONSTER.mouth.openMs;
      this.opening += Math.sign(destination - this.opening) * Math.min(step, Math.abs(destination - this.opening));
      this.showPose(this.opening === 0 ? "idle" : "open", this.opening - 1);
    }
    if (this.opening === destination) {
      if (this.state === "returning") this.state = "idle";
      if (this.state === "eating") {
        const open = this.onOpen;
        this.onOpen = undefined;
        open?.();
      }
    }
  }

  private showPose(pose: "idle" | "open" | "chew", position: number): void {
    const frames = MONSTER.mouth[pose].frames;
    // Bridge the resting smile at either end of the relevant strip.
    position = Math.max(pose === "open" ? -1 : 0,
      Math.min(frames.length - (pose === "chew" ? 0 : 1), position));
    const nearest = Math.round(position);
    const displayedPose = nearest < 0 || nearest >= frames.length ? "idle" : pose;
    const index = displayedPose === "idle" ? 0 : nearest;
    if (this.pose !== `${displayedPose}:${index}`) {
      this.pose = `${displayedPose}:${index}`;
      this.mouth.setTexture(mouthKey(displayedPose), String(index));
    }
    const layout = (step: number) => {
      const rect = step < 0 || step >= frames.length ? MONSTER.mouth.idle.frames[0] : frames[step];
      const opening = pose === "open" ? (step + 1) / frames.length : 0;
      const width = MONSTER.mouth.width * (1 + opening * (MONSTER.mouth.openScale - 1));
      const height = rect[3] * width / rect[2];
      return { width, height, opening };
    };
    const from = layout(Math.floor(position));
    const to = layout(Math.ceil(position));
    const fraction = position - Math.floor(position);
    const width = from.width + (to.width - from.width) * fraction;
    const height = from.height + (to.height - from.height) * fraction;
    const rect = MONSTER.mouth[displayedPose].frames[index];
    // Interpolate the displayed geometry even while the selected sprite stays
    // the same, avoiding size jumps at the unevenly cropped frame boundaries.
    this.mouth.setScale(width / rect[2], height / rect[3]);
    this.mouth.y = pose === "open" ? this.mouthTop + height / 2 : this.variant.mouthY;
    this.eyeOpening = from.opening + (to.opening - from.opening) * fraction;
  }

  private nextBlinkDelay(): number {
    const blink = MONSTER.eyes.blink;
    return blink.minDelayMs + this.random() * (blink.maxDelayMs - blink.minDelayMs);
  }

  private blinkOpenness(delta: number): number {
    if (this.reducedMotion) return 1;
    // Let an active blink finish, but don't start one during swallowing/chewing.
    if (this.blinkTime < 0 && this.busy) return 1;
    this.blinkTime += delta;
    if (this.blinkTime < 0) return 1;
    const blink = MONSTER.eyes.blink;
    const smooth = (t: number) => t * t * (3 - 2 * t);
    if (this.blinkTime < blink.closeMs) return 1 - smooth(this.blinkTime / blink.closeMs);
    const opening = this.blinkTime - blink.closeMs - blink.holdMs;
    if (opening < 0) return 0;
    if (opening < blink.openMs) return smooth(opening / blink.openMs);
    if (!this.blinkFollowup && this.random() < blink.doubleChance) {
      this.blinkFollowup = true;
      this.blinkTime = -blink.doubleGapMs;
    } else {
      this.blinkFollowup = false;
      this.blinkTime = -this.nextBlinkDelay();
    }
    return 1;
  }

  private updateEyes(delta: number): void {
    // Avoid a jump after a suspended tab; no independent timers or tweens to leak.
    const elapsed = Math.min(delta, 64);
    let x = 0, y = 0;
    if (this.eyeTarget && !this.reducedMotion) {
      const dx = this.eyeTarget.x;
      const dy = this.eyeTarget.y - this.variant.eyeY - this.eyeCenterY;
      const distance = Math.max(MONSTER.eyes.trackingDistance, Math.hypot(dx, dy));
      x = dx / distance * MONSTER.eyes.trackingX;
      y = dy / distance * MONSTER.eyes.trackingY;
    }
    const follow = 1 - Math.exp(-elapsed / MONSTER.eyes.responseMs);
    this.gaze.x += (x - this.gaze.x) * follow;
    this.gaze.y += (y - this.gaze.y) * follow;
    const openness = this.blinkOpenness(elapsed);
    this.eyes.setPosition(this.gaze.x, this.eyeCenterY + this.gaze.y)
      .setScale(this.eyeScale, this.eyeScale * Math.max(0.02, openness))
      .setAlpha(Math.min(1, openness / 0.15));
    this.eyelids.setPosition(this.eyes.x, this.eyes.y)
      .setAlpha(Math.max(0, Math.min(1, (0.3 - openness) / 0.2)));
    const eyeBottom = this.variant.eyeY + this.variant.eyeBounds[3] * this.eyeScale / 2;
    // Reserve room for downward tracking even at full eye height, so blinking
    // never changes the lift or lets the enlarged mouth cover the eyes.
    const gazeRoom = this.reducedMotion ? 0 : MONSTER.eyes.trackingY;
    const lift = Math.max(0, eyeBottom + gazeRoom + MONSTER.mouth.eyeGap - this.mouthTop);
    this.eyeRig.y = this.variant.eyeY - lift * this.eyeOpening;
  }

  destroy(): void {
    this.disposed = true;
    this.onOpen = undefined;
    this.onChewed = undefined;
    this.eyeTarget = null;
  }
}
