import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_REGISTRY, LEGACY_PROFILE_STORAGE_KEY, PROFILE_STORAGE_KEY,
  SessionStore, loadProfiles, validateRegistry, type Bag, type Child,
} from "./app-state.ts";
import { packingListFor, validateSchoolData, type SchoolData } from "./school-data.ts";

const fixture = validateSchoolData({
  student: "א", timeZone: "Asia/Jerusalem",
  days: Array.from({ length: 6 }, (_, weekday) => ({
    weekday, label: String(weekday), endsAt: null,
    lessons: [{ subjectId: "subject", label: `lesson-${weekday}` }],
  })),
  dailyItems: { label: "daily", itemIds: ["same"] },
  subjects: { subject: { label: "subject", equipmentStatus: "specified", itemIds: ["book"] } },
  items: {
    same: { label: "same", icon: "x", color: "#123456" },
    book: { label: "book", icon: "x", color: "#654321" },
  },
  generalAudio: {
    appEntry: { textTemplate: "{day}", humanAudioByWeekday: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [i, ""])) },
    finalDialog: { text: "done", humanAudioUrl: "" }, soundEffects: {},
  },
});

test("legacy profile migrates idempotently without removing legacy data", () => {
  const values = new Map([[LEGACY_PROFILE_STORAGE_KEY, JSON.stringify({ name: " נועה ", gender: "girl" })]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const first = loadProfiles(storage, DEFAULT_REGISTRY);
  const second = loadProfiles(storage, DEFAULT_REGISTRY);
  assert.equal(first.children[0]?.name, "נועה");
  assert.deepEqual(second, first);
  assert.ok(values.has(LEGACY_PROFILE_STORAGE_KEY));
  assert.equal(JSON.parse(values.get(PROFILE_STORAGE_KEY)!).version, 1);
});

test("storage failures gracefully use registry profiles", () => {
  const storage = { getItem(): string | null { throw new Error("denied"); }, setItem(): void { throw new Error("denied"); } };
  assert.equal(loadProfiles(storage, DEFAULT_REGISTRY).children[0]?.id, "ori");
});

test("two children keep independent sessions despite overlapping item IDs", () => {
  const store = new SessionStore();
  const bagA: Bag = { id: "a", dataUrl: "a.json" };
  const bagB: Bag = { id: "b", dataUrl: "b.json" };
  const childA: Child = { id: "one", name: "One", gender: "boy", bagId: "a" };
  const childB: Child = { id: "two", name: "Two", gender: "girl", bagId: "b" };
  store.commitSwitch(store.beginSwitch(), childA, bagA, fixture);
  store.selectDay(0); store.confirmDay();
  const staleTicket = store.ticket();
  assert.equal(store.pack(0, staleTicket), true);
  store.commitSwitch(store.beginSwitch(), childB, bagB, fixture);
  store.selectDay(1); store.confirmDay();
  assert.equal(store.pack(0, staleTicket), false, "stale child callback is rejected");
  assert.equal(store.current()?.session.packed, 0);
  store.commitSwitch(store.beginSwitch(), childA, bagA, fixture);
  assert.equal(store.current()?.session.packed, 1);
  assert.equal(store.current()?.session.day, 0);
});

test("late loads, confirmation, order, and cancellation guard progress", () => {
  const store = new SessionStore();
  const bag = { id: "a", dataUrl: "a.json" };
  const child = { id: "one", name: "One", gender: "boy" as const, bagId: "a" };
  const staleLoad = store.beginSwitch();
  const currentLoad = store.beginSwitch();
  assert.equal(store.commitSwitch(staleLoad, child, bag, fixture), null);
  store.commitSwitch(currentLoad, child, bag, fixture);
  store.selectDay(0);
  const ticket = store.ticket();
  assert.equal(store.pack(0, ticket), false, "confirmation is required");
  store.confirmDay();
  assert.equal(store.pack(1, ticket), false, "only front item packs");
  store.setBusy(true);
  assert.equal(store.pack(0, ticket), false, "cancelled/busy work does not advance");
  store.setBusy(false);
  assert.equal(store.pack(0, ticket), true);
});

test("the original six packing lists remain exact", async () => {
  const data = validateSchoolData(JSON.parse(await readFile("public/magic-school-bag/ori-data.json", "utf8")));
  const expected = [
    ["case","water","hebrew-notebook","hebrew-workbook","music-folder","science-book","science-notebook"],
    ["case","water","sport-shoes","sport-clothes","math-notebook","math-workbook","math-equipment","hebrew-notebook","hebrew-workbook","road_safety-book"],
    ["case","water","art-folder","life_skills-notebook"],
    ["case","water","math-notebook","math-workbook","math-equipment","music-folder","hebrew-notebook","hebrew-workbook"],
    ["case","water","math-notebook","math-workbook","math-equipment","hebrew-notebook","hebrew-workbook","library-book","sport-shoes","sport-clothes"],
    ["case","water","hebrew-notebook","hebrew-workbook","math-notebook","math-workbook","math-equipment","life_skills-notebook"],
  ];
  assert.deepEqual(data.days.map((_, day) => packingListFor(data, day).map(({ id }) => id)), expected);
});

test("registry IDs are stable and references must exist", () => {
  assert.throws(() => validateRegistry({ bags: [{ id: "x", dataUrl: "x" }], children: [{ id: "c", name: "C", gender: "boy", bagId: "missing" }] }), /missing bag/);
});
