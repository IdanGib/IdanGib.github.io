/**
 * Timetable content — this is the file to edit.
 *
 * `main.ts` holds logic only; every item, subject, schedule row and piece of
 * on-screen text lives here. Item tints are daisyUI tokens from the
 * `igtimetable` theme (see `src/styles.css`), never raw colours.
 *
 * The app serves several classes. Anything shared by all of them (the item
 * catalogue, common subjects, the daily kit, every on-screen string) sits at
 * the top level of `CONFIG`; each entry in `CONFIG.classes` then adds or
 * overrides what that class alone needs — its own books, its own weekly
 * schedule, its own notes from the teacher.
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

export interface Settings {
  /** From this hour on, the app opens on tomorrow's list instead of today's. */
  switchToTomorrowAtHour: number;
  /** Weekdays with school, 0 = Sunday. */
  schoolDays: number[];
}

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
  classPicker: string;
  pickClass: string;
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

/**
 * One class. Everything except `schedule` is optional: leave a field out and
 * the class inherits the shared value from the top level of `CONFIG`.
 */
export interface ClassConfig {
  /** Stable id — it keys the ticked items in storage, so never rename one. */
  id: string;
  /** Shown in the class picker. */
  name: string;
  /** Emoji shown next to the name in the picker. */
  icon: string;
  /** Overrides the shared settings, field by field. */
  settings?: Partial<Settings>;
  /** Items only this class uses. Merged over the shared catalogue (this wins). */
  items?: Record<string, Item>;
  /** Packed every school day. Replaces the shared list when given. */
  daily?: string[];
  /** Subjects only this class has. Merged over the shared ones (this wins). */
  subjects?: Record<string, Subject>;
  /** Weekday (0 = Sunday) → that day's subjects. */
  schedule: Record<number, string[]>;
  /** `YYYY-MM-DD` → one-off items for that date, from the teacher's message. */
  extras?: Record<string, ItemRef[]>;
  /** Wording only this class needs. Merged over the shared labels (this wins). */
  labels?: Partial<Labels>;
}

export interface TimetableConfig {
  /** Defaults for every class. */
  settings: Settings;
  /** Catalogue: every shared item is defined once here and referenced by key. */
  items: Record<string, Item>;
  /** Packed every school day, whatever the timetable says. */
  daily: string[];
  /** Subjects shared by the classes. */
  subjects: Record<string, Subject>;
  /** Every string on screen. `{braces}` are replaced with values. */
  labels: Labels;
  /** The classes, in picker order. The first one is the default. */
  classes: ClassConfig[];
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

    reader: { name: "ספר קריאה", icon: "📕" },
    shoes: { name: "נעלי ספורט", icon: "👟", note: "מגרש חיצוני" },
    sportkit: { name: "בגדי ספורט", icon: "👕" },

    money: { name: "20 ₪ להצגה", icon: "💵" },
    form: { name: "טופס חתום מההורים", icon: "📄" },
    whiteshirt: { name: "חולצה לבנה", icon: "👚" },
  },

  daily: ["water", "snack", "key"],

  subjects: {
    sport: { name: "ספורט", tone: "info", items: ["shoes", "sportkit"] },
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
    classPicker: "בחירת כיתה",
    pickClass: "עברו ל{name}",
    markItem: "סמנו {name}",
    unmarkItem: "בטלו את הסימון של {name}",
    playItem: "השמיעו {name}",
    stopItem: "עצרו את ההשמעה",

    weekdays: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
  },

  classes: [
    {
      id: "gimel2",
      name: "כיתה ג׳2",
      icon: "🦊",

      items: {
        mathbook: { name: "ספר חשבון", icon: "📘" },
        mathnote: { name: "מחברת חשבון", icon: "📓" },
        hebnote: { name: "מחברת עברית", icon: "✏️" },
        english: { name: "חוברת אנגלית", icon: "📗" },
        science: { name: "מחברת מדעים", icon: "📔" },
        recorder: { name: "חלילית", icon: "🪈" },
        paint: { name: "צבעי גואש", icon: "🎨" },
      },

      subjects: {
        math: { name: "חשבון", tone: "primary", items: ["mathbook", "mathnote"] },
        hebrew: { name: "עברית", tone: "error", items: ["reader", "hebnote"] },
        english: { name: "אנגלית", tone: "secondary", items: ["english"] },
        science: { name: "מדעים", tone: "info", items: ["science"] },
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
    },

    {
      id: "alef1",
      name: "כיתה א׳1",
      icon: "🐨",

      settings: {
        schoolDays: [0, 1, 2, 3, 4], // בלי יום שישי
      },

      items: {
        pencilcase: { name: "קלמר", icon: "✏️", tone: "secondary" },
        hat: { name: "כובע", icon: "🧢", tone: "success" },
        abcbook: { name: "חוברת אותיות", icon: "📒" },
        abcnote: { name: "מחברת כתיבה", icon: "📝" },
        numbers: { name: "חוברת מספרים", icon: "🔢" },
        library: { name: "ספר לספרייה", icon: "📚" },
        drums: { name: "תוף קטן", icon: "🥁" },
      },

      daily: ["water", "snack", "pencilcase", "hat"],

      subjects: {
        letters: { name: "אותיות", tone: "error", items: ["abcbook", "abcnote"] },
        counting: { name: "חשבון", tone: "primary", items: ["numbers"] },
        library: { name: "ספרייה", tone: "success", items: ["library"] },
        music: { name: "מוזיקה", tone: "accent", items: ["drums"] },
      },

      schedule: {
        0: ["letters", "counting"], // ראשון
        1: ["letters", "sport"], // שני
        2: ["counting", "library"], // שלישי
        3: ["letters", "music"], // רביעי
        4: ["counting", "sport"], // חמישי
      },

      extras: {
        "2026-09-09": [{ name: "ממתקים ליום הולדת", icon: "🎂", note: "מסיבה אחרי ההפסקה" }],
      },

      labels: {
        extrasSource: "מהודעה של המורה רותי",
      },
    },
  ],
};
