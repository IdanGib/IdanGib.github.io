import { createClient, FunctionsHttpError, type AuthChangeEvent, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { validMember, type ClassPack, type EditorUser, type PackInput, type School } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();

function isSecretKey(value:string):boolean {
  if (value.startsWith("sb_secret_")) return true;
  try {
    const payload = value.split(".")[1];
    if (!payload) return false;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.role === "service_role";
  } catch { return false; }
}

let client:SupabaseClient|null = null;
let configurationError = "";
if (!url || !key) {
  configurationError = "יש להגדיר VITE_SUPABASE_URL ו-VITE_SUPABASE_PUBLISHABLE_KEY במשתני הסביבה ולהפעיל מחדש את השרת. השתמשו במפתח הציבורי של Supabase.";
} else if (isSecretKey(key)) {
  configurationError = "לעורך נדרש מפתח ציבורי של Supabase. אין להשתמש במפתח secret או service_role בדפדפן.";
} else {
  try {
    client = createClient(url, key, {
      auth: { storageKey: "magic-bag-editor:auth", flowType: "pkce", detectSessionInUrl: false },
    });
  } catch {
    configurationError = "הגדרות Supabase אינן תקינות. בדקו את כתובת הפרויקט ואת המפתח הציבורי במשתני הסביבה.";
  }
}

export { configurationError };
export const supabase = client;
function configured():SupabaseClient {
  if (!client) throw new Error(configurationError);
  return client;
}

interface EditorRow {
  id:string; email:string; approved_email:string; role:"owner"|"admin";
  enabled:boolean; verified:boolean; created_at:string;
}
interface SchoolRow { id:string; name:string; city:string; official_code:string|null }
interface PackRow {
  id:string; school_id:string; school_year:string; grade:string; class_section:string;
  title:string; status:"draft"; updated_at:string; schools?:SchoolRow|null;
}
export const mapEditor = (row:EditorRow):EditorUser => ({
  id:row.id, email:row.email, approvedEmail:row.approved_email, role:row.role,
  enabled:row.enabled, verified:row.verified, created:row.created_at,
});
export const mapSchool = (row:SchoolRow):School => ({
  id:row.id, name:row.name, city:row.city, officialCode:row.official_code || "",
});
export const mapPack = (row:PackRow):ClassPack => ({
  id:row.id, school:row.school_id, schoolYear:row.school_year, grade:row.grade,
  classSection:row.class_section, title:row.title, status:row.status, updated:row.updated_at,
  ...(row.schools ? { expand:{ school:mapSchool(row.schools) } } : {}),
});

async function currentMember():Promise<EditorUser|null> {
  const sb = configured();
  const { data:{ session }, error:sessionError } = await sb.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) return null;
  // getUser checks this session with Auth; a stored token alone grants no editor access.
  const { data:{ user }, error:authError } = await sb.auth.getUser();
  if (authError) throw authError;
  if (!user) return null;
  const { data, error } = await sb.rpc("current_editor");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] as EditorRow|undefined : undefined;
  if (!row || row.id !== user.id || row.email?.toLowerCase() !== user.email?.toLowerCase()) return null;
  return mapEditor(row);
}

async function logout():Promise<void> {
  if (!client) return;
  const { error } = await client.auth.signOut({ scope:"local" });
  if (error) throw error;
}

async function requireMember():Promise<EditorUser> {
  try {
    const member = await currentMember();
    if (!validMember(member)) throw new Error("החשבון אינו מאומת או שהגישה לעורך בוטלה");
    return member;
  } catch (error) {
    await logout().catch(() => {});
    throw error;
  }
}

async function adminAction(body:Record<string,unknown>):Promise<unknown> {
  const member = await requireMember();
  if (member.role !== "owner") throw new Error("הפעולה זמינה לבעלי העורך בלבד");
  const { data, error } = await configured().functions.invoke("editor-admin", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      const details = await response.clone().json().catch(() => null) as { message?:string; error?:string|{message?:string} }|null;
      const message = details?.message || (typeof details?.error === "string" ? details.error : details?.error?.message);
      if (message) throw new Error(message);
    }
    throw error;
  }
  return data;
}

export const api = {
  async login(email:string,password:string):Promise<EditorUser> {
    const { error } = await configured().auth.signInWithPassword({ email:email.trim().toLowerCase(), password });
    if (error) throw error;
    return requireMember();
  },
  current: currentMember,
  logout,
  async setPassword(password:string):Promise<EditorUser> {
    const sb = configured();
    const member = await currentMember();
    if (!member || !member.enabled || member.email.toLowerCase() !== member.approvedEmail.toLowerCase()) {
      throw new Error("קישור ההזמנה אינו תקף או שהגישה בוטלה");
    }
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
    // Owner-managed invitations require database setup completion. An already
    // active member may also arrive through Auth's native recovery flow.
    if (!member.verified) {
      const { error:setupError } = await sb.rpc("complete_editor_setup");
      if (setupError) throw setupError;
    }
    return requireMember();
  },
  async schools():Promise<School[]> {
    await requireMember();
    const { data, error } = await configured().from("schools").select("id,name,city,official_code").order("name");
    if (error) throw error;
    return (data as SchoolRow[]).map(mapSchool);
  },
  async createSchool(data:Omit<School,"id">):Promise<School> {
    await requireMember();
    const { data:row, error } = await configured().from("schools").insert({
      name:data.name, city:data.city, official_code:data.officialCode || "",
    }).select("id,name,city,official_code").single();
    if (error) throw error;
    return mapSchool(row as SchoolRow);
  },
  async packs():Promise<ClassPack[]> {
    await requireMember();
    const { data, error } = await configured().from("class_packs")
      .select("id,school_id,school_year,grade,class_section,title,status,updated_at,schools(id,name,city,official_code)")
      .order("updated_at", { ascending:false });
    if (error) throw error;
    return (data as unknown as PackRow[]).map(mapPack);
  },
  async savePack(data:PackInput,id?:string):Promise<void> {
    await requireMember();
    const values = { school_id:data.school, school_year:data.schoolYear, grade:data.grade,
      class_section:data.classSection, title:data.title, status:"draft" };
    const query = configured().from("class_packs");
    const { error } = id ? await query.update(values).eq("id",id).select("id").single() : await query.insert(values);
    if (error) throw error;
  },
  async admins():Promise<EditorUser[]> {
    const member = await requireMember();
    if (member.role !== "owner") throw new Error("הפעולה זמינה לבעלי העורך בלבד");
    const { data, error } = await configured().rpc("list_editor_users");
    if (error) throw error;
    return (data as EditorRow[]).map(mapEditor).sort((a,b) => a.email.localeCompare(b.email));
  },
  invite:(email:string,allowRevoked=false) => adminAction({ action:"invite", email:email.trim().toLowerCase(), allowRevoked }),
  resend:(id:string) => adminAction({ action:"resend", id }),
  revoke:(id:string) => adminAction({ action:"revoke", id }),
  subscribe:(callback:(event:AuthChangeEvent,session:Session|null)=>void) => configured().auth.onAuthStateChange(callback).data.subscription,
};

export interface AuthRedirect { setup:boolean; error:string }
let redirectPromise:Promise<AuthRedirect>|undefined;
export function consumeAuthRedirect():Promise<AuthRedirect> {
  // React StrictMode may initialize twice; exchange one-use tokens only once.
  return redirectPromise ||= consumeRedirect();
}
async function consumeRedirect():Promise<AuthRedirect> {
  const address = new URL(window.location.href);
  const hash = new URLSearchParams(address.hash.slice(1));
  const callbackType = hash.get("type") || address.searchParams.get("type");
  const hasTokens = hash.has("access_token") || hash.has("refresh_token");
  const code = address.searchParams.get("code");
  const tokenHash = address.searchParams.get("token_hash");
  const setup = address.searchParams.get("setup") === "1" || address.hash.startsWith("#setup") ||
    callbackType === "invite" || callbackType === "recovery";
  const callbackError = hash.get("error_description") || address.searchParams.get("error_description") ||
    hash.get("error") || address.searchParams.get("error");

  // Remove auth credentials and callback errors before rendering or navigating.
  for (const name of ["code","token_hash","type","error","error_code","error_description"]) address.searchParams.delete(name);
  if (setup) address.searchParams.set("setup","1");
  if (hasTokens || callbackError || setup) address.hash = setup ? "#setup" : "#login";
  history.replaceState(null,"",address);
  if (callbackError) return { setup, error:callbackError };
  try {
    const sb = configured();
    if (hasTokens) {
      const access_token = hash.get("access_token"), refresh_token = hash.get("refresh_token");
      if (!access_token || !refresh_token) throw new Error("קישור ההזמנה אינו תקין. בקשו הזמנה חדשה.");
      const { error } = await sb.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
    } else if (code) {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (tokenHash && (callbackType === "invite" || callbackType === "recovery")) {
      const { error } = await sb.auth.verifyOtp({ token_hash:tokenHash, type:callbackType });
      if (error) throw error;
    }
    return { setup, error:"" };
  } catch (error) {
    await logout().catch(() => {});
    return { setup, error:error instanceof Error ? error.message : "קישור ההזמנה אינו תקין או שפג תוקפו." };
  }
}
