/**
 * Timetable content — this is the file to edit.
 *
 * `main.ts` holds logic only; every item, subject, schedule row and piece of
 * on-screen text lives here. Item tints are daisyUI tokens from the
 * `igtimetable` theme (see `src/styles.css`), never raw colours.
 */

/** daisyUI colour token used to tint an item's icon tile. */
export type Tone =
  | "primary"
  | "secondary"
  | "accent"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "neutral";

export interface Item {
  /** Shown on the row, and spoken by the play button. */
  name: string;
  /** Emoji shown in the icon tile. */
  icon: string;
  /** Optional second line, e.g. where or when it is needed. */
  note?: string;
  /** Defaults to the subject's tone, or `warning` for items with no subject. */
  tone?: Tone;
  /** Optional recorded clip, relative to the site root (e.g. a file in `public/`).
   *  Without one the name is read out with the browser's Hebrew voice. */
  audioUrl?: string;
}

export interface Subject {
  name: string;
  tone: Tone;
  /** Keys from `items`. */
  items: string[];
}

/** A day's extras: either a key from `items`, or a one-off item spelled out. */
export type ItemRef = string | Item;

export interface Labels {
  tabToday: string;
  tabTomorrow: string;
  groupDaily: string;
  groupSubjects: string;
  groupExtras: string;
  extrasSource: string;
  remainingOne: string;
  remainingMany: string;
  allDone: string;
  subline: string;
  sublineDone: string;
  progress: string;
  bannerTitle: string;
  bannerSub: string;
  noSchoolTitle: string;
  noSchoolSub: string;
  dayPicker: string;
  markItem: string;
  unmarkItem: string;
  playItem: string;
  stopItem: string;
  weekdays: string[];
}

/** Keys of `Labels` whose value is a single string — the ones `t()` can format. */
export type TextKey = {
  [K in keyof Labels]: Labels[K] extends string ? K : never;
}[keyof Labels];

export interface TimetableConfig {
  settings: {
    /** From this hour on, the app opens on tomorrow's list instead of today's. */
    switchToTomorrowAtHour: number;
    /** Weekdays with school, 0 = Sunday. */
    schoolDays: number[];
  };
  /** Catalogue: every item is defined once here and referenced by key elsewhere. */
  items: Record<string, Item>;
  /** Packed every school day, whatever the timetable says. */
  daily: string[];
  /** Subject → the kit it needs. */
  subjects: Record<string, Subject>;
  /** Weekday (0 = Sunday) → that day's subjects. */
  schedule: Record<number, string[]>;
  /** `YYYY-MM-DD` → one-off items for that date. */
  extras: Record<string, ItemRef[]>;
  /** Every string on screen. `{braces}` are replaced with values. */
  labels: Labels;
}

export const CONFIG: TimetableConfig = {
  settings: {
    switchToTomorrowAtHour: 18,
    schoolDays: [0, 1, 2, 3, 4, 5],
  },

  items: {
    water: { name: "בקבוק מים", icon: "💧", tone: "primary", audioUrl: "/audio/he/water.m4a" },
    snack: { name: "ארוחת עשר", icon: "🥪", tone: "warning" },
    key: { name: "מפתח הבית", icon: "🔑", tone: "secondary" },

    mathbook: { name: "ספר חשבון", icon: "📘" },
    mathnote: { name: "מחברת חשבון", icon: "📓" },
    reader: { name: "ספר קריאה", icon: "📕" },
    hebnote: { name: "מחברת עברית", icon: "✏️" },
    english: { name: "חוברת אנגלית", icon: "📗" },
    science: { name: "מחברת מדעים", icon: "📔" },
    recorder: { name: "חלילית", icon: "🪈" },
    paint: { name: "צבעי גואש", icon: "🎨" },
    shoes: { name: "נעלי ספורט", icon: "👟", note: "מגרש חיצוני" },
    sportkit: { name: "בגדי ספורט", icon: "👕" },

    money: { name: "20 ₪ להצגה", icon: "💵" },
    form: { name: "טופס חתום מההורים", icon: "📄" },
    whiteshirt: { name: "חולצה לבנה", icon: "👚" },
  },

  daily: ["water", "snack", "key"],

  subjects: {
    math: { name: "חשבון", tone: "primary", items: ["mathbook", "mathnote"] },
    hebrew: { name: "עברית", tone: "error", items: ["reader", "hebnote"] },
    english: { name: "אנגלית", tone: "secondary", items: ["english"] },
    science: { name: "מדעים", tone: "info", items: ["science"] },
    sport: { name: "ספורט", tone: "info", items: ["shoes", "sportkit"] },
    art: { name: "אומנות", tone: "accent", items: ["paint"] },
    music: { name: "מוזיקה", tone: "accent", items: ["recorder"] },
  },

  schedule: {
    0: ["math", "hebrew", "english"], // ראשון
    1: ["hebrew", "science", "sport"], // שני
    2: ["math", "hebrew", "sport", "art"], // שלישי
    3: ["english", "science", "music"], // רביעי
    4: ["math", "art"], // חמישי
    5: ["hebrew", "music"], // שישי — יום קצר
  },

  extras: {
    "2026-09-08": ["money", "form"],
    "2026-09-09": [{ name: "חולצה לבנה", icon: "👚", note: "טקס בשעה 9:00" }],
  },

  labels: {
    tabToday: "היום",
    tabTomorrow: "מחר",
    groupDaily: "כל יום",
    groupSubjects: "לפי השיעורים",
    groupExtras: "רק היום",
    extrasSource: "מהודעה של המורה",

    remainingOne: "עוד דבר אחד",
    remainingMany: "עוד {n} דברים",
    allDone: "התיק מוכן!",
    subline: "שמים בתיק ומסמנים ✓",
    sublineDone: "אפשר לשים ליד הדלת",
    progress: "{done} מתוך {total}",

    bannerTitle: "יש! הכל בפנים 🎒",
    bannerSub: "יום {day} מוכן",

    noSchoolTitle: "אין בית ספר",
    noSchoolSub: "יום {day} — אפשר לנוח 🎉",

    dayPicker: "בחירת יום",
    markItem: "סמנו {name}",
    unmarkItem: "בטלו את הסימון של {name}",
    playItem: "השמיעו {name}",
    stopItem: "עצרו את ההשמעה",

    weekdays: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
  },
};
