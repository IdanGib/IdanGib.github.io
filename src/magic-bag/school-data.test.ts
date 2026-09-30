import assert from "node:assert/strict";
import test from "node:test";
import { dayGroups, nextSchoolDay, packingListFor, validateSchoolData } from "./school-data.ts";

const fixture = validateSchoolData({
  student: "אורי",
  timeZone: "Asia/Jerusalem",
  days: Array.from({ length: 6 }, (_, weekday) => ({
    weekday,
    label: String(weekday),
    endsAt: weekday === 5 ? null : "12:45",
    lessons: weekday === 0
      ? [{ subjectId: "math", label: "ראשון" }, { subjectId: "math", label: "שני" }]
      : [{ subjectId: "none", label: "ללא ציוד" }],
  })),
  subjects: {
    math: { label: "חשבון", equipmentStatus: "specified", itemIds: ["book"] },
    none: { label: "ללא", equipmentStatus: "none", itemIds: [] },
  },
  items: { book: { label: "ספר", icon: "📘", color: "#123ABC" } },
  audio: { textToUrl: {} },
});

test("repeated subjects produce equipment once and retain lesson metadata", () => {
  assert.deepEqual(dayGroups(fixture, 0)[0]?.lessons, [1, 2]);
  const list = packingListFor(fixture, 0);
  assert.equal(list.length, 1);
  assert.deepEqual(list[0]?.lessonNames, ["ראשון", "שני"]);
});

test("next school day uses Jerusalem local time and skips Saturday", () => {
  assert.equal(nextSchoolDay(fixture, new Date("2026-10-01T20:59:00Z")), 5); // Thursday in Jerusalem
  assert.equal(nextSchoolDay(fixture, new Date("2026-10-01T21:01:00Z")), 0); // Friday in Jerusalem
  assert.equal(nextSchoolDay(fixture, new Date("2026-10-02T12:00:00Z")), 0); // Friday -> Sunday
  assert.equal(nextSchoolDay(fixture, new Date("2026-10-03T12:00:00Z")), 0); // Saturday -> Sunday
});

test("validation reports broken relationships and equipment status", () => {
  const broken = structuredClone(fixture) as unknown as Record<string, unknown>;
  const subjects = broken.subjects as Record<string, { itemIds: string[] }>;
  subjects.none!.itemIds = ["missing"];
  assert.throws(() => validateSchoolData(broken), /may not list items|missing item/);
});
