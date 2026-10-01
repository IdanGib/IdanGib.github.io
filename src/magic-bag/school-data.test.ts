import assert from "node:assert/strict";
import test from "node:test";
import { dayGroups, nextSchoolDay, packingListFor, validateSchoolData } from "./school-data.ts";
import { dayIndexFromUrl, dayUrl, restoreForwardedDayPath } from "./day-route.ts";

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

test("day URLs select data by weekday and remain shareable under a base path", () => {
  assert.equal(
    dayUrl("/IdanGib.github.io/", "https://example.com/old", 4).href,
    "https://example.com/IdanGib.github.io/magic-bag-app.html/day/4",
  );
  assert.equal(
    dayIndexFromUrl({ pathname: "/IdanGib.github.io/magic-bag-app.html/day/4", search: "" }, fixture.days),
    4,
  );
  assert.equal(dayIndexFromUrl({ pathname: "/magic-bag-app.html/day/9", search: "" }, fixture.days), -1);
});

test("GitHub Pages fallback day is read and restored to the clean path", () => {
  const location = { pathname: "/magic-bag-app.html", search: "?magic-bag-day=2" };
  assert.equal(dayIndexFromUrl(location, fixture.days), 2);
  assert.equal(
    restoreForwardedDayPath(location, "/", "https://example.com/magic-bag-app.html?magic-bag-day=2")?.href,
    "https://example.com/magic-bag-app.html/day/2",
  );
});
