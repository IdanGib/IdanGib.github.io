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
      eyeWidth: 490, eyeY: -151, mouthX: 0, mouthY: 5,
    },
    girl: {
      body: "monster-bag-girl-body.png", bodyBounds: [119, 85, 1015, 1081] as Rect,
      eyes: "monster-bag-girl-eyes.png", eyeBounds: [89, 221, 724, 405] as Rect,
      eyeSplitY: 318, lids: [[243, 128], [660, 128]], lidColor: 0x421535,
      eyeWidth: 506, eyeY: -151, mouthX: 0, mouthY: 5,
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
      [10, 277, 412, 162], [435, 262, 403, 180], [848, 233, 407, 219],
      [1258, 208, 429, 269], [1693, 162, 468, 342],
    ] as Rect[] },
    chew: { file: "mouth-chewing.png", frames: [
      [25, 277, 331, 168], [365, 298, 277, 142], [655, 317, 269, 114],
      [931, 357, 312, 56], [1250, 320, 276, 110], [1542, 298, 265, 139],
      [1818, 277, 328, 167],
    ] as Rect[] },
    width: 242,
    openScale: 2,
    eyeGap: 18,
    closedFrame: 3,
    openFps: 18,
    chewFps: 20,
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
  private opening = 0; // 0 = resting image; 1..5 = opening strip poses.
  private frameElapsed = 0;
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
    // Food passes over the body, but behind the mouth/lips as it disappears.
    this.container.add([body, this.eyeRig, this.foodLayer, this.mouth]);
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
    // A fixed fully-open target avoids moving the drop area during the animation.
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
    const local = this.toLocal(point);
    const target = this.toLocal(this.target);
    return Math.hypot(
      (local.x - target.x) / MONSTER.proximity.radiusX,
      (local.y - target.y) / MONSTER.proximity.radiusY,
    );
  }

  canInsert(point: Point): boolean { return this.distance(point) <= 1; }

  /** A world-space card center, or null to ease the gaze back to neutral. */
  trackTarget(point: Point | null): void {
    if (!this.disposed) this.eyeTarget = point ? this.toLocal(point) : null;
  }

  anticipate(dragging: boolean): void {
    if (this.disposed || this.busy) return;
    const next = dragging ? "anticipating" : this.opening > 0 ? "returning" : "idle";
    if (this.state === next) return;
    this.state = next;
    this.frameElapsed = 0;
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
      const frameMs = 1000 / MONSTER.mouth.chewFps;
      const closeMs = MONSTER.mouth.closedFrame * frameMs;
      const bobMs = this.reducedMotion ? 0 : MONSTER.mouth.chewCycles * MONSTER.mouth.chewCycleMs;
      const bobTime = this.chewElapsed - closeMs;
      if (bobTime < 0) {
        this.showPose("chew", Math.floor(this.chewElapsed / frameMs));
      } else if (bobTime < bobMs) {
        this.showPose("chew", MONSTER.mouth.closedFrame);
        this.mouth.y = this.variant.mouthY - MONSTER.mouth.chewAmplitude *
          Math.sin(bobTime / MONSTER.mouth.chewCycleMs * Math.PI * 2);
      } else if (bobTime < bobMs + closeMs) {
        this.showPose("chew", Math.max(0, MONSTER.mouth.closedFrame - 1 - Math.floor((bobTime - bobMs) / frameMs)));
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
      this.frameElapsed += delta;
      const frameMs = this.reducedMotion ? 1 : 1000 / MONSTER.mouth.openFps;
      while (this.frameElapsed >= frameMs && this.opening !== destination) {
        this.frameElapsed -= frameMs;
        this.opening += Math.sign(destination - this.opening);
      }
      this.showPose(this.opening === 0 ? "idle" : "open", Math.max(0, this.opening - 1));
    }
    if (this.opening === destination) {
      this.frameElapsed = 0;
      if (this.state === "returning") this.state = "idle";
      if (this.state === "eating") {
        const open = this.onOpen;
        this.onOpen = undefined;
        open?.();
      }
    }
  }

  private showPose(pose: "idle" | "open" | "chew", index: number): void {
    if (this.pose === `${pose}:${index}`) {
      if (pose === "chew") this.mouth.y = this.variant.mouthY;
      return;
    }
    this.pose = `${pose}:${index}`;
    const rect = MONSTER.mouth[pose].frames[index];
    const opening = pose === "open" ? (index + 1) / MONSTER.mouth.open.frames.length : 0;
    const scale = MONSTER.mouth.width * (1 + opening * (MONSTER.mouth.openScale - 1)) / rect[2];
    this.mouth.setTexture(mouthKey(pose), String(index)).setScale(scale);
    // Keep the upper lip anchored as the enlarged opening grows downward.
    this.mouth.y = pose === "open" ? this.mouthTop + rect[3] * scale / 2 : this.variant.mouthY;
    this.eyeOpening = opening;
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
