export type EquipmentStatus = "specified" | "none" | "unknown";

export interface Lesson {
  subjectId: string;
  label: string;
}

export interface SchoolDay {
  weekday: number;
  label: string;
  endsAt: string | null;
  lessons: Lesson[];
}

export interface Subject {
  label: string;
  equipmentStatus: EquipmentStatus;
  itemIds: string[];
}

export interface SchoolItem {
  label: string;
  icon: string;
  imageUrl?: string;
  audioUrl?: string;
  color: string;
}

export interface SchoolData {
  $schema?: string;
  student: string;
  timeZone: "Asia/Jerusalem";
  days: SchoolDay[];
  subjects: Record<string, Subject>;
  items: Record<string, SchoolItem>;
  generalAudio: {
    appEntry: {
      textTemplate: string;
      humanAudioByWeekday: Record<string, string>;
    };
    finalDialog: {
      text: string;
      humanAudioUrl: string;
    };
    soundEffects: Record<string, string>;
  };
}

export interface PackingItem extends Omit<SchoolItem, "color"> {
  id: string;
  color: number;
  groupKey: string;
  subject: string;
  status: EquipmentStatus;
  lessons: number[];
  lessonNames: string[];
}

export interface SubjectGroup {
  key: string;
  subject: string;
  status: EquipmentStatus;
  itemIds: string[];
  lessons: number[];
  lessonNames: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** Validate both shape and cross-record relationships before the UI uses data. */
export function validateSchoolData(value: unknown): SchoolData {
  const errors: string[] = [];
  if (!isRecord(value)) throw new Error("School data must be an object.");
  const { days, subjects, items, generalAudio } = value;
  if (!nonEmpty(value.student)) errors.push("student must be a non-empty string");
  if (value.timeZone !== "Asia/Jerusalem")
    errors.push('timeZone must be "Asia/Jerusalem"');
  if (!Array.isArray(days) || days.length !== 6)
    errors.push("days must contain Sunday through Friday");
  if (!isRecord(subjects)) errors.push("subjects must be an object");
  if (!isRecord(items)) errors.push("items must be an object");
  if (!isRecord(generalAudio)) {
    errors.push("generalAudio must be an object");
  } else {
    const { appEntry, finalDialog, soundEffects } = generalAudio;
    if (!isRecord(appEntry) || !nonEmpty(appEntry.textTemplate) ||
        !isRecord(appEntry.humanAudioByWeekday)) {
      errors.push("generalAudio.appEntry requires textTemplate and humanAudioByWeekday");
    } else {
      for (let weekday = 0; weekday < 6; weekday++) {
        if (typeof appEntry.humanAudioByWeekday[String(weekday)] !== "string")
          errors.push(`generalAudio.appEntry.humanAudioByWeekday.${weekday} must be a string`);
      }
    }
    if (!isRecord(finalDialog) || !nonEmpty(finalDialog.text) ||
        typeof finalDialog.humanAudioUrl !== "string")
      errors.push("generalAudio.finalDialog requires text and humanAudioUrl");
    if (!isRecord(soundEffects) ||
        Object.values(soundEffects).some((url) => typeof url !== "string"))
      errors.push("generalAudio.soundEffects must contain string URLs");
  }

  if (Array.isArray(days)) {
    days.forEach((day, dayIndex) => {
      const path = `days[${dayIndex}]`;
      if (!isRecord(day)) return errors.push(`${path} must be an object`);
      if (day.weekday !== dayIndex) errors.push(`${path}.weekday must be ${dayIndex}`);
      if (!nonEmpty(day.label)) errors.push(`${path}.label must not be empty`);
      if (
        day.endsAt !== null &&
        (typeof day.endsAt !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(day.endsAt))
      )
        errors.push(`${path}.endsAt must be HH:mm or null`);
      if (!Array.isArray(day.lessons) || day.lessons.length === 0) {
        errors.push(`${path}.lessons must not be empty`);
        return;
      }
      day.lessons.forEach((lesson, lessonIndex) => {
        const lessonPath = `${path}.lessons[${lessonIndex}]`;
        if (!isRecord(lesson) || !nonEmpty(lesson.subjectId) || !nonEmpty(lesson.label)) {
          errors.push(`${lessonPath} must contain subjectId and label`);
        } else if (isRecord(subjects) && !(lesson.subjectId in subjects)) {
          errors.push(`${lessonPath}.subjectId references missing subject ${lesson.subjectId}`);
        }
      });
    });
  }

  if (isRecord(subjects)) {
    Object.entries(subjects).forEach(([id, subject]) => {
      const path = `subjects.${id}`;
      if (!isRecord(subject)) return errors.push(`${path} must be an object`);
      if (!nonEmpty(subject.label)) errors.push(`${path}.label must not be empty`);
      if (!(["specified", "none", "unknown"] as unknown[]).includes(subject.equipmentStatus))
        errors.push(`${path}.equipmentStatus is invalid`);
      if (!Array.isArray(subject.itemIds) || subject.itemIds.some((itemId) => !nonEmpty(itemId))) {
        errors.push(`${path}.itemIds must be string IDs`);
        return;
      }
      if (new Set(subject.itemIds).size !== subject.itemIds.length)
        errors.push(`${path}.itemIds must be unique`);
      if (subject.equipmentStatus === "specified" && subject.itemIds.length === 0)
        errors.push(`${path} is specified but has no items`);
      if (subject.equipmentStatus !== "specified" && subject.itemIds.length > 0)
        errors.push(`${path} may not list items unless equipment is specified`);
      subject.itemIds.forEach((itemId) => {
        if (isRecord(items) && !(itemId in items))
          errors.push(`${path}.itemIds references missing item ${itemId}`);
      });
    });
  }

  if (isRecord(items)) {
    Object.entries(items).forEach(([id, item]) => {
      const path = `items.${id}`;
      if (!isRecord(item)) return errors.push(`${path} must be an object`);
      if (!nonEmpty(item.label) || !nonEmpty(item.icon))
        errors.push(`${path} requires non-empty label and icon`);
      if (typeof item.color !== "string" || !/^#[\dA-Fa-f]{6}$/.test(item.color))
        errors.push(`${path}.color must be a six-digit hex color`);
      for (const field of ["imageUrl", "audioUrl"] as const) {
        if (item[field] !== undefined && typeof item[field] !== "string")
          errors.push(`${path}.${field} must be a string when present`);
      }
    });
  }
  if (errors.length) throw new Error(`Invalid school bag data:\n- ${errors.join("\n- ")}`);
  return value as unknown as SchoolData;
}

export function dayGroups(data: SchoolData, dayIndex: number): SubjectGroup[] {
  const day = data.days[dayIndex];
  if (!day) throw new RangeError(`Unknown school day index ${dayIndex}`);
  const groups = new Map<string, SubjectGroup>();
  day.lessons.forEach((lesson, index) => {
    const existing = groups.get(lesson.subjectId);
    if (existing) {
      existing.lessons.push(index + 1);
      existing.lessonNames.push(lesson.label);
      return;
    }
    const subject = data.subjects[lesson.subjectId];
    groups.set(lesson.subjectId, {
      key: lesson.subjectId,
      subject: subject.label,
      status: subject.equipmentStatus,
      itemIds: [...subject.itemIds],
      lessons: [index + 1],
      lessonNames: [lesson.label],
    });
  });
  return [...groups.values()];
}

export function packingListFor(data: SchoolData, dayIndex: number): PackingItem[] {
  return dayGroups(data, dayIndex).flatMap((group) =>
    group.itemIds.map((id) => {
      const item = data.items[id];
      return {
        ...item,
        id,
        color: Number.parseInt(item.color.slice(1), 16),
        groupKey: group.key,
        subject: group.subject,
        status: group.status,
        lessons: [...group.lessons],
        lessonNames: [...group.lessonNames],
      };
    }),
  );
}

/** Return tomorrow's school-day index, skipping Saturday. */
export function nextSchoolDay(data: Pick<SchoolData, "timeZone">, date = new Date()): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: data.timeZone,
    weekday: "short",
  }).format(date);
  const today = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  if (today < 0) throw new Error(`Unsupported weekday ${weekday}`);
  const tomorrow = (today + 1) % 7;
  return tomorrow === 6 ? 0 : tomorrow;
}

export function resolveMediaUrl(value: string | undefined, dataUrl: URL): string {
  const trimmed = value?.trim();
  return trimmed ? new URL(trimmed, dataUrl).href : "";
}
