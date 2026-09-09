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
    hat: { name: "כובע", icon: "🧢", tone: "success" },

    reader: { name: "ספר קריאה", icon: "📕" },
    library: { name: "ספר לספרייה", icon: "📚" },
    paint: { name: "צבעים", icon: "🎨" },
    sciencenote: { name: "מחברת מדעים", icon: "📔" },
    shoes: { name: "נעלי ספורט", icon: "👟", note: "מגרש חיצוני" },
    sportkit: { name: "בגדי ספורט", icon: "👕" },

    // חד-פעמיים — לשימוש ב־extras של תאריך מסוים
    money: { name: "20 ₪ להצגה", icon: "💵" },
    form: { name: "טופס חתום מההורים", icon: "📄" },
    whiteshirt: { name: "חולצה לבנה", icon: "👚" },
  },

  daily: ["water", "snack", "key"],

  subjects: {
    sport: { name: "חינוך גופני", tone: "success", items: ["shoes", "sportkit"] },
    art: { name: "אומנות", tone: "accent", items: ["paint"] },
    science: { name: "מדעים", tone: "info", items: ["sciencenote"] },
    library: { name: "שעת ספרייה", tone: "warning", items: ["library"] },
    lifeskills: { name: "כישורי חיים", tone: "secondary", items: [] },
    interests: { name: "תחומי עניין", tone: "neutral", items: [] },
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
    // ── כיתה ג׳2 — מחנכת שרונה ממן (מערכת תשפ״ו) ─────────────────────────────
    {
      id: "gimel2",
      name: "כיתה ג׳2",
      icon: "🦊",

      items: {
        hebnote: { name: "מחברת עברית", icon: "✏️" },
        torahbook: { name: "חומש", icon: "📜" },
        torahnote: { name: "מחברת תורה", icon: "📒" },
        mathbook: { name: "ספר מתמטיקה", icon: "📘" },
        mathnote: { name: "מחברת מתמטיקה", icon: "📓" },
        ruler: { name: "סרגל", icon: "📏" },
        english: { name: "חוברת אנגלית", icon: "📗" },
        englishnote: { name: "מחברת אנגלית", icon: "📝" },
        recorder: { name: "חלילית", icon: "🪈" },
        homelandnote: { name: "מחברת מולדת וחברה", icon: "📙" },
        farmshoes: { name: "נעליים סגורות", icon: "🥾", note: "לחווה החקלאית" },
      },

      subjects: {
        opening: { name: "פותחים יום", tone: "neutral", items: [] },
        torah: { name: "תורה", tone: "warning", items: ["torahbook", "torahnote"] },
        hebrew: { name: "עברית", tone: "error", items: ["reader", "hebnote"] },
        math: { name: "מתמטיקה", tone: "primary", items: ["mathbook", "mathnote"] },
        geometry: { name: "גאומטריה", tone: "primary", items: ["mathnote", "ruler"] },
        english: { name: "אנגלית", tone: "secondary", items: ["english", "englishnote"] },
        recorder: { name: "חלילית", tone: "accent", items: ["recorder"] },
        homeland: { name: "מולדת וחברה", tone: "success", items: ["homelandnote"] },
        academy: { name: "אקדמיה חוקרת / בשבילי מורשת", tone: "neutral", items: [] },
        cyber: { name: "סייבר", tone: "neutral", items: [] },
        farm: { name: "חווה חקלאית", tone: "success", items: ["hat", "farmshoes"] },
      },

      schedule: {
        // ראשון: פותחים יום · תורה · אומנות · מתמטיקה · מתמטיקה · חינוך גופני · מולדת וחברה
        0: ["opening", "torah", "art", "math", "sport", "homeland"],
        // שני: פותחים יום · עברית · עברית + אקדמיה חוקרת · מתמטיקה · מולדת וחברה · מדעים
        1: ["opening", "hebrew", "academy", "math", "homeland", "science"],
        // שלישי: פותחים יום · אומנות · מתמטיקה · תחומי עניין ×2 · אנגלית
        2: ["opening", "art", "math", "interests", "english"],
        // רביעי: פותחים יום · חלילית · תורה · סייבר · חינוך גופני · אנגלית
        3: ["opening", "recorder", "torah", "cyber", "sport", "english"],
        // חמישי: פותחים יום · עברית · מדעים · חווה חקלאית ×2 · שעת ספרייה · מתמטיקה
        4: ["opening", "hebrew", "science", "farm", "library", "math"],
        // שישי: פותחים יום · עברית · אקדמיה חוקרת · גאומטריה · כישורי חיים
        5: ["opening", "hebrew", "academy", "geometry", "lifeskills"],
      },

      // הודעות מהמורה ליום מסוים, למשל:
      // "2026-09-15": ["money", "form"],
      extras: {},

      labels: {
        extrasSource: "מהודעה של שרונה",
      },
    },

    // ── כיתה א׳1 — מחנכת הדר זרביב (מערכת תשפ״ו) ─────────────────────────────
    {
      id: "alef1",
      name: "כיתה א׳1",
      icon: "🐨",

      items: {
        pencilcase: { name: "קלמר", icon: "✏️", tone: "secondary" },
        hebbook: { name: "חוברת עברית", icon: "📒" },
        hebnote: { name: "מחברת כתיבה", icon: "📝" },
        numbers: { name: "חוברת חשבון", icon: "🔢" },
        mathnote: { name: "מחברת חשבון", icon: "📓" },
        drums: { name: "תוף קטן", icon: "🥁" },
      },

      daily: ["water", "snack", "pencilcase", "hat"],

      subjects: {
        assembly: { name: "כינוס בוקר", tone: "neutral", items: [] },
        hebrew: { name: "עברית", tone: "error", items: ["hebbook", "hebnote"] },
        math: { name: "חשבון", tone: "primary", items: ["numbers", "mathnote"] },
        music: { name: "מוסיקה", tone: "accent", items: ["drums"] },
        heritage: { name: "בשבילי מורשת", tone: "neutral", items: [] },
        playtime: { name: "שעת משחק", tone: "neutral", items: [] },
        roadsafety: { name: "זהירות בדרכים", tone: "neutral", items: [] },
      },

      schedule: {
        // ראשון: עברית + כינוס בוקר · עברית + בשבילי מורשת · מוסיקה · מדעים ×2
        0: ["hebrew", "assembly", "heritage", "music", "science"],
        // שני: חינוך גופני · חשבון · עברית · שעת משחק · זהירות בדרכים
        1: ["sport", "math", "hebrew", "playtime", "roadsafety"],
        // שלישי: תחומי עניין ×2 · אומנות ×2 · כישורי חיים
        2: ["interests", "art", "lifeskills"],
        // רביעי: חשבון ×2 · מוסיקה · עברית · עברית + בשבילי מורשת
        3: ["math", "music", "hebrew", "heritage"],
        // חמישי: חשבון ×2 · עברית · שעת ספרייה · חינוך גופני
        4: ["math", "hebrew", "library", "sport"],
        // שישי: עברית ×2 · חשבון · כישורי חיים
        5: ["hebrew", "math", "lifeskills"],
      },

      // הודעות מהמורה ליום מסוים, למשל:
      // "2026-09-15": [{ name: "ממתקים ליום הולדת", icon: "🎂", note: "מסיבה אחרי ההפסקה" }],
      extras: {},

      labels: {
        extrasSource: "מהודעה של הדר",
      },
    },
  ],
};
