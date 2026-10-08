import assert from "node:assert/strict";
import { test } from "node:test";
import { MONSTER, MonsterBag } from "./monster-bag.ts";

class ObjectStub {
  x = 0; y = 0; scaleX = 1; scaleY = 1; key = ""; frame = "";
  children: ObjectStub[] = [];
  setScale(x: number, y = x) { this.scaleX = x; this.scaleY = y; return this; }
  setTexture(key: string, frame: string) { this.key = key; this.frame = frame; return this; }
  add(children: ObjectStub | ObjectStub[]) { this.children.push(...[children].flat()); return this; }
}
function fixture(gender: "boy" | "girl" = "boy", reducedMotion = false) {
  const object = (x: number, y: number, key = "", frame = "") =>
    Object.assign(new ObjectStub(), { x, y, key, frame });
  const scene = {
    add: { container: object, image: object },
    textures: { get: () => ({ has: () => false, add: () => {} }) },
  };
  const monster = new MonsterBag(scene as never, gender, 210, reducedMotion);
  const mouth = monster.mouth as unknown as ObjectStub;
  const tick = (ms: number) => { for (let elapsed = 0; elapsed < ms; elapsed += 10) monster.update(10); };
  const pointAt = (distance: number) => ({
    x: monster.target.x + distance * MONSTER.proximity.radiusX * monster.container.scaleX,
    y: monster.target.y,
  });
  return { monster, mouth, tick, pointAt };
}

test("drag anticipation holds open anywhere without moving or enlarging the insertion area", () => {
  const { monster, mouth, tick, pointAt } = fixture();
  monster.container.setScale(0.5);
  monster.container.x = 100; monster.container.y = 200;
  assert.equal(monster.canInsert(pointAt(0.99)), true);
  assert.equal(monster.canInsert(pointAt(1.1)), false);
  const target = monster.target;
  assert.equal(monster.canInsert(pointAt(4)), false);
  monster.anticipate(true);
  tick(120);
  const intermediateFrame = mouth.frame;
  for (let i = 0; i < 8; i++) { monster.anticipate(true); tick(30); }
  assert.equal(monster.state, "anticipating");
  assert.equal(mouth.frame, "4");
  assert.notEqual(mouth.frame, intermediateFrame);
  assert.deepEqual(monster.target, target);
  assert.equal(monster.canInsert(pointAt(1.1)), false);
  tick(1000);
  assert.equal(monster.state, "anticipating");
  monster.anticipate(false);
  tick(60);
  assert.equal(monster.state, "returning");
  assert.equal(mouth.frame, "3");
  tick(300);
  assert.equal(monster.state, "idle");
  assert.equal(mouth.key, "monster-mouth-idle");
});

test("canceling and starting another drag reverse from the current frame", () => {
  const { monster, mouth, tick } = fixture();
  monster.anticipate(true); tick(180);
  monster.anticipate(false); tick(60);
  assert.equal(mouth.frame, "1");
  monster.anticipate(true); tick(60);
  assert.equal(mouth.frame, "2");
  monster.anticipate(false); tick(400);
  assert.equal(monster.state, "idle");
});

for (const gender of ["boy", "girl"] as const) {
  test(`${gender}: tap opening precedes eating; chewing holds the closed middle frame and a stable body`, () => {
    const { monster, mouth, tick } = fixture(gender);
    let opened = 0, chewed = 0;
    const idleWidth = mouth.scaleX * MONSTER.mouth.idle.frames[0][2];
    monster.eat(() => opened++);
    monster.anticipate(false); // Pointer cancellation cannot interrupt an accepted item.
    tick(100);
    assert.equal(opened, 0);
    tick(250);
    assert.equal(opened, 1);
    const openFrame = MONSTER.mouth.open.frames.at(-1)!;
    assert.ok(Math.abs(mouth.scaleX * openFrame[2] - idleWidth * 2) < 0.001);
    const variant = MONSTER.variants[gender];
    const eyes = (monster.container as unknown as ObjectStub).children[1];
    const eyeBottom = eyes.y + variant.eyeBounds[3] * eyes.scaleY / 2;
    const mouthTop = mouth.y - openFrame[3] * mouth.scaleY / 2;
    assert.ok(eyeBottom <= mouthTop - MONSTER.mouth.eyeGap + 0.001);
    assert.ok(Math.abs(monster.target.y - (monster.container.y + mouth.y * monster.container.scaleY)) < 0.001);
    tick(500);
    assert.equal(opened, 1);
    monster.eat(() => opened++); // Reentrant input is ignored.
    const bodyY = monster.container.y;
    monster.chew(() => chewed++);
    tick(150);
    const heights = new Set<number>();
    for (let i = 0; i < 50; i++) {
      tick(10);
      assert.equal(mouth.key, "monster-mouth-chew");
      assert.equal(mouth.frame, "3");
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
}

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
  const { monster, mouth, tick } = fixture("girl", true);
  let opened = false, complete = false;
  monster.eat(() => { opened = true; }); tick(10);
  assert.equal(opened, true);
  monster.chew(() => { complete = true; });
  const initialY = mouth.y;
  for (let i = 0; i < 50; i++) { tick(10); assert.equal(mouth.y, initialY); }
  assert.equal(complete, true);
  assert.equal(monster.state, "idle");
});
