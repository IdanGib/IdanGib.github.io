import assert from "node:assert/strict";
import test from "node:test";
import { monsterAppetite, monsterDropBounds, monsterMouth } from "./monster-ui.ts";

const monster = { x: 210, y: 640, scaleX: 0.82, scaleY: 0.82 };

test("feeding targets the mouth after the monster moves or squishes", () => {
  const first = monsterMouth(monster);
  const moved = { ...monster, x: 250, y: 620, scaleY: 0.7 };
  const mouth = monsterMouth(moved);
  assert.equal(mouth.x - first.x, 40);
  assert.equal(mouth.y, moved.y + 19 * moved.scaleY);
  assert.equal(monsterAppetite(moved, mouth), 1);
  const bounds = monsterDropBounds(moved);
  assert.ok(mouth.x > bounds.left && mouth.x < bounds.right);
  assert.ok(mouth.y > bounds.top && mouth.y < bounds.bottom);
});

test("the drop area accepts small misses around the lips and excludes horns and feet", () => {
  const bounds = monsterDropBounds(monster);
  const inside = (x: number, y: number) =>
    x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  const mouth = monsterMouth(monster);
  assert.ok(inside(mouth.x + 70 * monster.scaleX, mouth.y));
  assert.ok(inside(mouth.x, mouth.y - 55 * monster.scaleY));
  assert.equal(inside(monster.x, monster.y - 145 * monster.scaleY), false);
  assert.equal(inside(monster.x, monster.y + 130 * monster.scaleY), false);
});

test("the mouth opens progressively on approach and closes when the card moves away", () => {
  const mouth = monsterMouth(monster);
  const atDistance = (distance: number) =>
    monsterAppetite(monster, { x: mouth.x + distance, y: mouth.y });
  assert.equal(atDistance(250), 0);
  assert.equal(atDistance(210), 0);
  assert.ok(atDistance(175) > 0);
  assert.ok(atDistance(150) > atDistance(175));
  assert.equal(atDistance(100), 1);
  assert.equal(atDistance(0), 1);
});
