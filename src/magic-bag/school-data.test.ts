import assert from "node:assert/strict";
import test from "node:test";
import {
  dayGroups,
  imageUrlsFor,
  nextSchoolDay,
  packingListFor,
  validateSchoolData,
} from "./school-data.ts";

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
  dailyItems: { label: "ציוד לכל יום", itemIds: ["case"] },
  subjects: {
    math: { label: "חשבון", equipmentStatus: "specified", itemIds: ["book"] },
    none: { label: "ללא", equipmentStatus: "none", itemIds: [] },
  },
  items: {
    book: { label: "ספר", icon: "📘", color: "#123ABC" },
    case: { label: "קלמר", icon: "✏️", color: "#ABC123" },
  },
  generalAudio: {
    appEntry: {
      textTemplate: "בואו נכין מערכת ליום {day}",
      humanAudioByWeekday: Object.fromEntries(Array.from({ length: 6 }, (_, day) => [day, ""])),
    },
    finalDialog: { text: "כל הכבוד", humanAudioUrl: "" },
    soundEffects: {},
  },
});

test("repeated subjects produce equipment once and retain lesson metadata", () => {
  assert.deepEqual(dayGroups(fixture, 0)[0]?.lessons, [1, 2]);
  const list = packingListFor(fixture, 0);
  assert.equal(list.length, 2);
  assert.equal(list[0]?.id, "case");
  assert.equal(list[0]?.subject, "ציוד לכל יום");
  assert.deepEqual(list[1]?.lessonNames, ["ראשון", "שני"]);
});

test("daily items are included on days whose lessons need no equipment", () => {
  assert.deepEqual(packingListFor(fixture, 1).map(({ id }) => id), ["case"]);
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

test("validation reports missing daily item references", () => {
  const broken = structuredClone(fixture) as unknown as Record<string, unknown>;
  (broken.dailyItems as { itemIds: string[] }).itemIds = ["missing"];
  assert.throws(() => validateSchoolData(broken), /dailyItems.*missing item/);
});

test("image URLs are resolved, deduplicated, and empty values are skipped", () => {
  const data = structuredClone(fixture);
  data.items.book!.imageUrl = "./assets/book.png";
  data.items.case!.imageUrl = " ./assets/book.png ";
  data.items.empty = { label: "ריק", icon: "❔", imageUrl: "", color: "#123456" };

  assert.deepEqual(
    imageUrlsFor(data, new URL("https://example.com/magic-school-bag/ori-data.json")),
    ["https://example.com/magic-school-bag/assets/book.png"],
  );
});
