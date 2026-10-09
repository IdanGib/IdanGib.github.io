import assert from "node:assert/strict";
import { test } from "node:test";
import { MONSTER, MonsterBag } from "./monster-bag.ts";

class ObjectStub {
  x = 0; y = 0; scaleX = 1; scaleY = 1; alpha = 1; key = ""; frame = "";
  children: ObjectStub[] = [];
  setScale(x: number, y = x) { this.scaleX = x; this.scaleY = y; return this; }
  setTexture(key: string, frame: string) { this.key = key; this.frame = frame; return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setAlpha(alpha: number) { this.alpha = alpha; return this; }
  lineStyle() { return this; }
  beginPath() { return this; }
  moveTo() { return this; }
  lineTo() { return this; }
  strokePath() { return this; }
  add(children: ObjectStub | ObjectStub[]) { this.children.push(...[children].flat()); return this; }
}
function fixture(gender: "boy" | "girl" = "boy", reducedMotion = false, random = () => 0.5) {
  const filters = new Map<string, number>();
  const object = (x: number, y: number, key = "", frame = "") =>
    Object.assign(new ObjectStub(), { x, y, key, frame });
  const scene = {
    add: { container: object, image: object, graphics: () => object(0, 0) },
    textures: { get: (key: string) => ({
      has: () => false, add: () => {}, setFilter: (mode: number) => filters.set(key, mode),
    }) },
  };
  const monster = new MonsterBag(scene as never, gender, 210, reducedMotion, random);
  const mouth = monster.mouth as unknown as ObjectStub;
  const eyeRig = (monster.container as unknown as ObjectStub).children[1];
  const [brows, eyes, eyelids] = eyeRig.children;
  const tick = (ms: number) => { for (let elapsed = 0; elapsed < ms; elapsed += 10) monster.update(10); };
  const worldPoint = (x: number, y: number) => ({
    x: monster.container.x + x * monster.container.scaleX,
    y: monster.container.y + y * monster.container.scaleY,
  });
  const pointAtDistance = (distance: number, angle = 0) => ({
    x: monster.target.x + Math.cos(angle) * distance * MONSTER.proximity.radiusX * monster.container.scaleX,
    y: monster.target.y + Math.sin(angle) * distance * MONSTER.proximity.radiusY * monster.container.scaleY,
  });
  return { monster, mouth, eyeRig, brows, eyes, eyelids, tick, worldPoint, pointAtDistance, filters };
}

function mouthSize(mouth: ObjectStub) {
  const pose = mouth.key === "monster-mouth-idle" ? "idle" : mouth.key === "monster-mouth-open" ? "open" : "chew";
  const rect = MONSTER.mouth[pose].frames[Number(mouth.frame)];
  return { width: rect[2] * mouth.scaleX, height: rect[3] * mouth.scaleY };
}

test("distance interpolates geometry between sprites and reverses without a size jump", () => {
  const { monster, mouth, eyeRig, pointAtDistance } = fixture("girl");
  const pointAtOpening = (opening: number) => pointAtDistance(MONSTER.proximity.shrinkDistance -
    (MONSTER.proximity.shrinkDistance - 1) * opening / MONSTER.mouth.open.frames.length);
  monster.anticipate(pointAtOpening(3.2));
  monster.update(10);
  const frame = mouth.frame;
  const before = mouthSize(mouth);
  const lipY = mouth.y - before.height / 2;
  const eyeY = eyeRig.y;
  monster.anticipate(pointAtOpening(3.4));
  monster.update(10);
  const after = mouthSize(mouth);
  assert.equal(mouth.frame, frame);
  assert.ok(after.width > before.width);
  assert.ok(after.height > before.height);
  assert.ok(eyeRig.y < eyeY);
  assert.ok(Math.abs(mouth.y - after.height / 2 - lipY) < 0.001);
  monster.anticipate(pointAtOpening(3.2));
  assert.deepEqual(mouthSize(mouth), after);
  monster.update(10);
  const reversed = mouthSize(mouth);
  assert.ok(Math.abs(reversed.width - before.width) < 0.001);
  assert.ok(Math.abs(reversed.height - before.height) < 0.001);
});

test("chewing uses every closing and return pose with continuous height and one completion", () => {
  const { monster, mouth } = fixture();
  let completed = 0;
  monster.chew(() => completed++);
  const seen = new Set([mouth.frame]);
  const before = mouthSize(mouth);
  monster.update(4);
  const after = mouthSize(mouth);
  assert.equal(mouth.frame, "0");
  assert.notEqual(after.height, before.height);
  assert.ok(Math.abs(after.width - before.width) < 0.001);
  const duration = MONSTER.mouth.chewCloseMs + MONSTER.mouth.chewCycles * MONSTER.mouth.chewCycleMs + MONSTER.mouth.chewOpenMs + MONSTER.mouth.chewRestMs;
  for (let elapsed = 4; elapsed < duration + 100; elapsed += 4) {
    monster.update(4);
    if (mouth.key === "monster-mouth-chew") seen.add(mouth.frame);
  }
  assert.deepEqual([...seen], MONSTER.mouth.chew.frames.map((_, index) => String(index)));
  assert.equal(monster.state, "idle");
  assert.equal(completed, 1);
  monster.update(1000);
  assert.equal(completed, 1);
});

test("irregular update intervals preserve opening and chewing duration", () => {
  const { monster, mouth } = fixture();
  let opened = 0, chewed = 0;
  monster.eat(() => opened++);
  monster.update(MONSTER.mouth.openMs - 1);
  assert.equal(opened, 0);
  monster.update(1);
  assert.equal(opened, 1);
  assert.equal(mouth.frame, String(MONSTER.mouth.open.frames.length - 1));
  monster.chew(() => chewed++);
  const duration = MONSTER.mouth.chewCloseMs + MONSTER.mouth.chewCycles * MONSTER.mouth.chewCycleMs + MONSTER.mouth.chewOpenMs;
  monster.update(duration);
  assert.equal(chewed, 0);
  assert.equal(mouth.frame, String(MONSTER.mouth.chew.frames.length - 1));
  const returnSize = mouthSize(mouth);
  monster.update(MONSTER.mouth.chewRestMs - 1);
  assert.equal(chewed, 0);
  assert.ok(mouthSize(mouth).height < returnSize.height);
  monster.update(1);
  assert.equal(chewed, 1);
});

test("mouth textures preserve sharp source samples without changing body or eye filtering", () => {
  const { filters } = fixture();
  assert.deepEqual([...filters], [
    ["monster-mouth-idle", 1], ["monster-mouth-open", 1], ["monster-mouth-chew", 1],
  ]);
});

for (const gender of ["boy", "girl"] as const) {
  test(`${gender}: distance scrubs every mouth pose in both directions and holds while stationary`, () => {
    const { monster, mouth, tick, worldPoint, pointAtDistance } = fixture(gender);
    for (const scale of [0.18, 0.27, 0.5]) {
      monster.container.setScale(scale);
      monster.container.setPosition(100, 200);
      const target = monster.target;
      assert.equal(monster.canInsert(monster.target), true);
      assert.equal(monster.canInsert(worldPoint(650, -450)), false);
      monster.anticipate(pointAtDistance(MONSTER.proximity.shrinkDistance));
      tick(1000);
      assert.equal(monster.state, "anticipating");
      assert.equal(mouth.key, "monster-mouth-idle");
      const count = MONSTER.mouth.open.frames.length;
      const steps = Array.from({ length: count }, (_, index) => index + 1);
      for (const angle of [0, Math.PI / 2, Math.PI, Math.atan2(0.8, 0.6)]) {
        for (const step of [...steps, ...steps.slice(0, -1).reverse()]) {
          const distance = MONSTER.proximity.shrinkDistance -
            (MONSTER.proximity.shrinkDistance - 1) * step / count;
          const point = pointAtDistance(distance, angle);
          assert.ok(Math.abs(monster.distance(point) - distance) < 0.001);
          monster.anticipate(point); tick(10);
          assert.equal(mouth.key, "monster-mouth-open");
          assert.equal(mouth.frame, String(step - 1));
          tick(1000); // Elapsed time must never advance a stationary card's pose.
          assert.equal(mouth.frame, String(step - 1));
          assert.deepEqual(monster.target, target);
        }
      }
      monster.anticipate(pointAtDistance(1)); tick(10);
      assert.equal(mouth.frame, String(count - 1));
      monster.anticipate(pointAtDistance(4)); tick(10);
      assert.equal(mouth.key, "monster-mouth-idle");
      assert.equal(monster.canInsert(monster.target), true);
      assert.equal(monster.canInsert(worldPoint(650, -450)), false);
    }
  });

  test(`${gender}: cancel closes from a partial pose, and another drag responds immediately`, () => {
    const { monster, mouth, tick, pointAtDistance } = fixture(gender);
    monster.anticipate(pointAtDistance(1.9)); tick(10);
    const partialFrame = Number(mouth.frame);
    assert.ok(partialFrame > 0 && partialFrame < MONSTER.mouth.open.frames.length - 1);
    monster.anticipate(null); tick(60);
    assert.equal(monster.state, "returning");
    assert.ok(Number(mouth.frame) < partialFrame);
    monster.anticipate(monster.target); tick(10);
    assert.equal(mouth.frame, String(MONSTER.mouth.open.frames.length - 1));
    monster.anticipate(null); tick(400);
    assert.equal(monster.state, "idle");
    assert.equal(mouth.key, "monster-mouth-idle");
  });

  test(`${gender}: drops require overlap with the smaller mouth area at different scales`, () => {
    const { monster, worldPoint } = fixture(gender);
    monster.container.setPosition(370, 620);
    for (const scale of [0.18, 0.27, 0.5]) {
      monster.container.setScale(scale);
      // Head/handle, hands, and feet are outside the smaller drop area.
      for (const [x, y] of [[0, -530], [-490, 0], [490, 0], [-250, 520], [250, 520]])
        assert.equal(monster.canInsert(worldPoint(x, y)), false);
      const target = monster.toLocal(monster.target);
      const nearMouth = (x: number, y: number) => worldPoint(target.x + x, target.y + y);
      assert.equal(monster.canInsert(monster.target), true);
      for (const [x, y] of [[-235, 0], [235, 0], [0, -165], [0, 165]])
        assert.equal(monster.canInsert(nearMouth(x, y)), true);
      const card = { width: 160 * scale, height: 160 * scale };
      // The card center can still be outside when its edge enters the mouth area.
      for (const [x, y] of [[-315, 0], [315, 0], [0, -245], [0, 245]]) {
        assert.equal(monster.canInsert(nearMouth(x, y)), false);
        assert.equal(monster.canInsert(nearMouth(x, y), card), true);
      }
      for (const [x, y] of [[-325, 0], [325, 0], [0, -255], [0, 255]])
        assert.equal(monster.canInsert(nearMouth(x, y), card), false);
    }
  });

  test(`${gender}: shrinking follows progress from each starting position to the mouth`, () => {
    const { monster } = fixture(gender);
    for (const scale of [0.18, 0.27, 0.5]) {
      monster.container.setScale(scale);
      const target = monster.target;
      for (const [dx, dy] of [[0, -300], [180, -140], [-220, 80]]) {
        const start = { x: target.x + dx, y: target.y + dy };
        const at = (progress: number) => ({
          x: start.x - dx * progress, y: start.y - dy * progress,
        });
        assert.equal(monster.cardScaleAt(start, start), 1);
        assert.equal(monster.cardScaleAt(at(-0.5), start), 1);
        assert.ok(monster.cardScaleAt(at(0.1), start) < 1);
        const halfway = monster.cardScaleAt(at(0.5), start);
        assert.ok(Math.abs(halfway - 0.725) < 0.001);
        assert.ok(monster.cardScaleAt(at(0.75), start) < halfway);
        assert.ok(Math.abs(monster.cardScaleAt(target, start) - 0.45) < 0.001);
        assert.equal(monster.cardScaleAt(start, start), 1); // Moving back restores size.
      }
      assert.equal(monster.cardScaleAt(target, target), 1); // Degenerate start stays finite.
    }
  });

  test(`${gender}: accepted insertion opens before eating; chewing holds the closed middle frame and a stable body`, () => {
    const { monster, mouth, eyeRig, eyes, tick } = fixture(gender);
    let opened = 0, chewed = 0;
    const idleWidth = mouth.scaleX * MONSTER.mouth.idle.frames[0][2];
    monster.eat(() => opened++);
    monster.anticipate(null); // Pointer cancellation cannot interrupt an accepted item.
    tick(100);
    assert.equal(opened, 0);
    tick(MONSTER.mouth.openMs);
    assert.equal(opened, 1);
    const openFrame = MONSTER.mouth.open.frames.at(-1)!;
    assert.ok(Math.abs(mouth.scaleX * openFrame[2] - idleWidth * 1.75) < 0.001);
    const variant = MONSTER.variants[gender];
    const eyeHeight = variant.eyeBounds[1] + variant.eyeBounds[3] - variant.eyeSplitY;
    const eyeBottom = eyeRig.y + eyes.y + eyeHeight * eyes.scaleY / 2;
    const mouthTop = mouth.y - openFrame[3] * mouth.scaleY / 2;
    assert.ok(eyeBottom <= mouthTop - MONSTER.mouth.eyeGap + 0.001);
    assert.ok(Math.abs(monster.target.y - (monster.container.y + mouth.y * monster.container.scaleY)) < 0.001);
    tick(500);
    assert.equal(opened, 1);
    monster.eat(() => opened++); // Reentrant input is ignored.
    const bodyY = monster.container.y;
    monster.chew(() => chewed++);
    tick(MONSTER.mouth.chewCloseMs);
    const heights = new Set<number>();
    for (let i = 0; i < 50; i++) {
      tick(10);
      assert.equal(mouth.key, "monster-mouth-chew");
      assert.equal(mouth.frame, String(MONSTER.mouth.closedFrame));
      assert.equal(monster.container.y, bodyY);
      heights.add(mouth.y);
      assert.equal(chewed, 0);
    }
    assert.ok(heights.size > 10);
    tick(400);
    assert.equal(chewed, 1);
    assert.equal(monster.state, "idle");
    tick(1000);
    assert.equal(chewed, 1);
    assert.equal(opened, 1);
  });

  test(`${gender}: bounded gaze tracks a scaled card, preserves mouth clearance and returns to neutral`, () => {
    const { monster, mouth, eyeRig, brows, eyes, tick } = fixture(gender);
    const variant = MONSTER.variants[gender];
    const neutral = { x: eyes.x, y: eyes.y, browX: brows.x, browY: brows.y };
    monster.container.setScale(0.43);
    monster.container.setPosition(310, 470);
    monster.anticipate(monster.target);
    monster.trackTarget({ x: 950, y: 1200 });
    tick(600);
    assert.ok(eyes.x > 0 && eyes.x <= MONSTER.eyes.trackingX);
    assert.ok(eyes.y > neutral.y && eyes.y - neutral.y <= MONSTER.eyes.trackingY);
    assert.equal(brows.x, neutral.browX);
    assert.equal(brows.y, neutral.browY);
    const eyeHeight = variant.eyeBounds[1] + variant.eyeBounds[3] - variant.eyeSplitY;
    const eyeBottom = eyeRig.y + eyes.y + eyeHeight * eyes.scaleY / 2;
    const mouthTop = mouth.y - MONSTER.mouth.open.frames.at(-1)![3] * mouth.scaleY / 2;
    assert.ok(eyeBottom <= mouthTop - MONSTER.mouth.eyeGap + 0.001);
    const liftedY = eyeRig.y;
    monster.trackTarget({ x: -950, y: 0 }); tick(600);
    assert.ok(eyes.x < 0 && eyes.y < neutral.y);
    assert.equal(eyeRig.y, liftedY); // Brows don't move as the gaze changes.
    monster.trackTarget(null); monster.anticipate(null); tick(1600);
    assert.ok(Math.abs(eyes.x) < 0.001);
    assert.ok(Math.abs(eyes.y - neutral.y) < 0.001);
    assert.equal(eyeRig.y, variant.eyeY);
    assert.equal(monster.state, "idle");
  });

  test(`${gender}: a blink closes only the eyes, follows with at most one double blink, then rests`, () => {
    const { monster, brows, eyes, eyelids, tick } = fixture(gender, false, () => 0);
    const browScale = brows.scaleY, eyeScale = eyes.scaleY;
    tick(MONSTER.eyes.blink.minDelayMs);
    tick(MONSTER.eyes.blink.closeMs);
    assert.equal(eyes.alpha, 0);
    assert.equal(eyelids.alpha, 1);
    assert.equal(brows.scaleY, browScale);
    assert.equal(monster.state, "idle");
    tick(MONSTER.eyes.blink.holdMs + MONSTER.eyes.blink.openMs);
    assert.equal(eyes.alpha, 1);
    assert.equal(eyes.scaleY, eyeScale);
    assert.equal(eyelids.alpha, 0);
    tick(MONSTER.eyes.blink.doubleGapMs + MONSTER.eyes.blink.closeMs);
    assert.equal(eyes.alpha, 0);
    tick(MONSTER.eyes.blink.holdMs + MONSTER.eyes.blink.openMs);
    for (let i = 0; i < 200; i++) {
      tick(10);
      assert.equal(eyes.scaleY, eyeScale);
      assert.equal(eyes.alpha, 1);
    }
  });
}

test("eating defers new blinks, and destruction stops gaze and blink updates", () => {
  const { monster, eyes, tick } = fixture("boy", false, () => 0);
  const scale = eyes.scaleY;
  monster.eat(() => {});
  tick(7000);
  assert.equal(eyes.scaleY, scale);
  assert.equal(eyes.alpha, 1);
  monster.trackTarget({ x: 1000, y: 300 }); tick(100);
  const snapshot = { x: eyes.x, y: eyes.y, scaleY: eyes.scaleY, alpha: eyes.alpha };
  monster.destroy();
  monster.trackTarget({ x: -1000, y: 300 }); tick(7000);
  assert.deepEqual({ x: eyes.x, y: eyes.y, scaleY: eyes.scaleY, alpha: eyes.alpha }, snapshot);
});

test("shutdown discards pending animation callbacks", () => {
  for (const duringChew of [false, true]) {
    const { monster, tick } = fixture();
    let callbacks = 0;
    if (duringChew) monster.chew(() => callbacks++);
    else monster.eat(() => callbacks++);
    monster.destroy();
    tick(5000);
    assert.equal(callbacks, 0);
  }
});

test("reduced motion still opens, consumes, and completes without a bob", () => {
  const { monster, mouth, eyes, eyelids, tick } = fixture("girl", true);
  const neutral = { x: eyes.x, y: eyes.y, scale: eyes.scaleY };
  monster.trackTarget({ x: 1000, y: 0 }); tick(7000);
  assert.equal(eyes.x, neutral.x);
  assert.equal(eyes.y, neutral.y);
  assert.equal(eyes.scaleY, neutral.scale);
  assert.equal(eyes.alpha, 1);
  assert.equal(eyelids.alpha, 0);
  let opened = false, complete = false;
  monster.eat(() => { opened = true; }); tick(10);
  assert.equal(opened, true);
  monster.chew(() => { complete = true; });
  const initialY = mouth.y;
  for (let i = 0; i < 50; i++) { tick(10); assert.equal(mouth.y, initialY); }
  tick(MONSTER.mouth.chewRestMs);
  assert.equal(complete, true);
  assert.equal(monster.state, "idle");
});
