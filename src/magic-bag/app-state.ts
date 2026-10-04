import { packingListFor, type PackingItem, type SchoolData } from "./school-data.ts";

export type Gender = "boy" | "girl";
export interface Bag { id: string; dataUrl: string }
export interface Child { id: string; name: string; gender: Gender; bagId: string }
export interface Registry { bags: Bag[]; children: Child[] }

export interface Session {
  childId: string;
  bagId: string;
  day: number | null;
  confirmed: boolean;
  packed: number;
  revision: number;
}

export interface ActiveContext {
  child: Child;
  bag: Bag;
  data: SchoolData;
  items: PackingItem[];
  session: Session;
}

export const DEFAULT_BAG_ID = "ori";
export const DEFAULT_CHILD_ID = "ori";
export const PROFILE_STORAGE_KEY = "magic-bag-profiles-v1";
export const LEGACY_PROFILE_STORAGE_KEY = "magic-bag-kid-profile";

export const DEFAULT_REGISTRY: Registry = {
  bags: [{ id: DEFAULT_BAG_ID, dataUrl: "magic-school-bag/ori-data.json" }],
  children: [{ id: DEFAULT_CHILD_ID, name: "אורי", gender: "boy", bagId: DEFAULT_BAG_ID }],
};

const own = (record: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

export function validateRegistry(registry: Registry): Registry {
  const bagIds = new Set<string>();
  const childIds = new Set<string>();
  if (!registry.bags.length || !registry.children.length) throw new Error("Registry must contain a bag and a child.");
  for (const bag of registry.bags) {
    if (!bag.id.trim() || !bag.dataUrl.trim() || bagIds.has(bag.id)) throw new Error(`Invalid or duplicate bag ID: ${bag.id}`);
    bagIds.add(bag.id);
  }
  for (const child of registry.children) {
    if (!child.id.trim() || !child.name.trim() || childIds.has(child.id)) throw new Error(`Invalid or duplicate child ID: ${child.id}`);
    if (child.gender !== "boy" && child.gender !== "girl") throw new Error(`Invalid gender for ${child.id}`);
    if (!bagIds.has(child.bagId)) throw new Error(`Child ${child.id} references missing bag ${child.bagId}`);
    childIds.add(child.id);
  }
  return registry;
}

interface StoredProfiles { version: 1; selectedChildId: string; profiles: Record<string, Pick<Child, "name" | "gender">> }

function validProfile(value: unknown): value is Pick<Child, "name" | "gender"> {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, unknown>;
  return typeof profile.name === "string" && !!profile.name.trim() &&
    (profile.gender === "boy" || profile.gender === "girl");
}

/** Load current profiles, or copy the legacy profile to the first stable child ID. */
export function loadProfiles(storage: Pick<Storage, "getItem" | "setItem">, registry: Registry): {
  children: Child[]; selectedChildId: string;
} {
  const first = registry.children[0]!;
  let stored: StoredProfiles | null = null;
  try {
    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && (parsed as { version?: unknown }).version === 1) stored = parsed as StoredProfiles;
    if (!stored) {
      const legacyRaw = storage.getItem(LEGACY_PROFILE_STORAGE_KEY);
      const legacy: unknown = legacyRaw ? JSON.parse(legacyRaw) : null;
      if (validProfile(legacy)) {
        stored = { version: 1, selectedChildId: first.id, profiles: { [first.id]: legacy } };
        storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(stored));
      }
    }
  } catch { /* Private mode and malformed data use registry defaults. */ }
  const profiles = stored?.profiles && typeof stored.profiles === "object" ? stored.profiles : {};
  const children = registry.children.map((child) => {
    const profile = own(profiles, child.id) ? profiles[child.id] : undefined;
    return validProfile(profile) ? { ...child, name: profile.name.trim(), gender: profile.gender } : { ...child };
  });
  const selectedChildId = children.some(({ id }) => id === stored?.selectedChildId)
    ? stored!.selectedChildId : first.id;
  return { children, selectedChildId };
}

export function saveProfiles(storage: Pick<Storage, "setItem">, children: Child[], selectedChildId: string): void {
  const profiles = Object.fromEntries(children.map(({ id, name, gender }) => [id, { name, gender }]));
  try { storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ version: 1, selectedChildId, profiles })); } catch { /* In-memory profiles still work. */ }
}

export class SessionStore {
  private sessions = new Map<string, Session>();
  private epoch = 0;
  private active: ActiveContext | null = null;
  private busy = false;

  private key(childId: string, bagId: string): string { return `${childId}\0${bagId}`; }
  beginSwitch(): number { this.busy = true; return ++this.epoch; }
  cancelPending(): void { this.busy = false; this.epoch += 1; }
  current(): ActiveContext | null { return this.active; }

  commitSwitch(token: number, child: Child, bag: Bag, data: SchoolData): ActiveContext | null {
    if (token !== this.epoch || child.bagId !== bag.id) return null;
    const key = this.key(child.id, bag.id);
    const session = this.sessions.get(key) ?? {
      childId: child.id, bagId: bag.id, day: null, confirmed: false, packed: 0, revision: 0,
    };
    this.sessions.set(key, session);
    this.active = { child, bag, data, session, items: session.day === null ? [] : packingListFor(data, session.day) };
    this.busy = false;
    return this.active;
  }

  selectDay(day: number): ActiveContext {
    if (!this.active || !this.active.data.days[day]) throw new RangeError(`Unknown school day ${day}`);
    Object.assign(this.active.session, { day, confirmed: false, packed: 0, revision: this.active.session.revision + 1 });
    this.active.items = packingListFor(this.active.data, day);
    return this.active;
  }
  confirmDay(): void { if (!this.active?.session.day && this.active?.session.day !== 0) throw new Error("Choose a day first."); this.active.session.confirmed = true; }
  replay(): void { if (!this.active) return; Object.assign(this.active.session, { packed: 0, confirmed: true, revision: this.active.session.revision + 1 }); }
  setBusy(value: boolean): void { this.busy = value; }

  /** The sole state-changing packing command. Its ticket prevents stale animation callbacks. */
  pack(index: number, ticket: { childId: string; bagId: string; revision: number }): boolean {
    const context = this.active;
    if (!context || this.busy || !context.session.confirmed ||
        ticket.childId !== context.child.id || ticket.bagId !== context.bag.id ||
        ticket.revision !== context.session.revision || index !== context.session.packed ||
        index >= context.items.length) return false;
    context.session.packed += 1;
    return true;
  }
  ticket(): { childId: string; bagId: string; revision: number } {
    if (!this.active) throw new Error("No active child.");
    return { childId: this.active.child.id, bagId: this.active.bag.id, revision: this.active.session.revision };
  }
}
