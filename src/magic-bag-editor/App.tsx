import { type FormEvent, type InputHTMLAttributes, type ReactNode, useEffect, useRef, useState } from "react";
import { api, configurationError, consumeAuthRedirect } from "./supabase";
import { restoreAuth, validMember } from "./auth";
import type { ClassPack, EditorUser, PackInput, School } from "./types";

const errText = (error:unknown) => error instanceof Error ? error.message : "אירעה שגיאה";
const Field = ({label,...props}:{label:string}&InputHTMLAttributes<HTMLInputElement>) =>
  <label className="form-control w-full"><span className="label-text mb-1 font-medium">{label}</span><input {...props} className="input input-bordered w-full"/></label>;
const setupRoute = () => location.hash.startsWith("#setup");

export default function App() {
  const [user,setUser] = useState<EditorUser|null>(null);
  const [ready,setReady] = useState(false);
  const [error,setError] = useState("");
  const [route,setRoute] = useState(location.hash || "#packs");
  const [setupAllowed,setSetupAllowed] = useState(false);
  const [setupError,setSetupError] = useState("");
  const signedOut = useRef(false);

  useEffect(() => {
    if (configurationError) { void consumeAuthRedirect(); setReady(true); return; }
    let active = true, initialized = false, revision = 0;
    const refresh = async () => {
      if (!active || !initialized || setupRoute() || signedOut.current) return;
      const request = ++revision;
      const member = await restoreAuth();
      if (active && request === revision) setUser(member);
    };
    const hashChanged = () => {
      setRoute(location.hash || "#packs");
      if (!setupRoute()) {
        const address = new URL(location.href);
        address.searchParams.delete("setup");
        history.replaceState(null,"",address);
        void refresh();
      }
    };
    const focus = () => { if (document.visibilityState === "visible") void refresh(); };
    const subscription = api.subscribe((event,session) => {
      if (!active) return;
      if (event === "SIGNED_OUT" || !session) {
        if (event === "SIGNED_OUT") signedOut.current = true;
        ++revision;
        setUser(null);
        setSetupAllowed(false);
      } else {
        // Supabase holds an auth lock in this callback. Run API calls after it releases it.
        window.setTimeout(() => { void refresh(); },0);
      }
    });
    addEventListener("hashchange",hashChanged);
    addEventListener("focus",focus);
    document.addEventListener("visibilitychange",focus);
    const interval = window.setInterval(() => { void refresh(); },60_000);
    void (async () => {
      const redirect = await consumeAuthRedirect();
      if (!active) return;
      setRoute(location.hash || "#packs");
      if (redirect.setup) {
        setSetupError(redirect.error);
        if (!redirect.error) {
          try {
            const member = await api.current();
            const allowed = Boolean(member && member.enabled && member.email &&
              member.email.toLowerCase() === member.approvedEmail.toLowerCase());
            if (!active) return;
            setSetupAllowed(allowed);
            if (!allowed) {
              setSetupError("קישור ההזמנה אינו תקף או שהגישה בוטלה. בקשו הזמנה חדשה מבעלי העורך.");
              await api.logout().catch(() => {});
            }
          } catch (cause) {
            if (active) setSetupError(errText(cause));
            await api.logout().catch(() => {});
          }
        }
      } else {
        setError(redirect.error);
        const member = await restoreAuth();
        if (active) setUser(member);
      }
      initialized = true;
      if (active) setReady(true);
    })();
    return () => {
      active = false;
      ++revision;
      subscription.unsubscribe();
      removeEventListener("hashchange",hashChanged);
      removeEventListener("focus",focus);
      document.removeEventListener("visibilitychange",focus);
      clearInterval(interval);
    };
  },[]);

  if (configurationError) return <Page title="הגדרת העורך"><div className="card-body"><Alert text={configurationError}/></div></Page>;
  if (!ready) return <main className="grid min-h-screen place-items-center"><span className="loading loading-spinner loading-lg" aria-label="טוען"/></main>;
  if (route.startsWith("#setup")) return <PasswordSetup allowed={setupAllowed} error={setupError} onComplete={member => {
    signedOut.current = false; setUser(member); setError(""); location.hash = "#packs";
  }}/>;
  if (!validMember(user)) return <Login onLogin={member => { signedOut.current = false; setUser(member); location.hash = "#packs"; }} error={error} setError={setError}/>;
  return <Shell user={user} route={route} logout={async () => {
    signedOut.current = true;
    setUser(null);
    location.hash = "#login";
    try { await api.logout(); } catch (cause) { setError(errText(cause)); }
  }}/>;
}

function Login({onLogin,error,setError}:{onLogin:(user:EditorUser)=>void;error:string;setError:(message:string)=>void}) {
  const [busy,setBusy] = useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try { onLogin(await api.login(String(form.get("email")),String(form.get("password")))); }
    catch (cause) { setError(errText(cause)); }
    finally { setBusy(false); }
  }
  return <Page title="כניסת צוות"><form onSubmit={submit} className="card-body gap-4">
    <Field label="דוא״ל מאושר" name="email" type="email" required autoComplete="email"/>
    <Field label="סיסמה" name="password" type="password" required autoComplete="current-password"/>
    {error && <Alert text={error}/>}
    <button disabled={busy} className="btn btn-primary">{busy ? "נכנס…" : "כניסה"}</button>
  </form></Page>;
}

function PasswordSetup({allowed,error,onComplete}:{allowed:boolean;error:string;onComplete:(user:EditorUser)=>void}) {
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allowed || busy) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password")), confirm = String(form.get("confirm"));
    if (password.length < 12 || password !== confirm) { setMessage("נדרשת סיסמה זהה באורך 12 תווים לפחות"); return; }
    setBusy(true); setMessage("");
    try { onComplete(await api.setPassword(password)); }
    catch (cause) { setMessage(errText(cause)); }
    finally { setBusy(false); }
  }
  return <Page title="הגדרת סיסמה"><form onSubmit={submit} className="card-body gap-4">
    <Field label="סיסמה חדשה" name="password" type="password" minLength={12} required autoComplete="new-password" disabled={!allowed || busy}/>
    <Field label="אימות סיסמה" name="confirm" type="password" minLength={12} required autoComplete="new-password" disabled={!allowed || busy}/>
    {(message || error) && <Alert text={message || error}/>}
    <button disabled={!allowed || busy} className="btn btn-primary">{busy ? "שומר…" : "שמירת סיסמה"}</button>
    <a className="link text-center" href="#login">לכניסה</a>
  </form></Page>;
}

function Shell({user,route,logout}:{user:EditorUser;route:string;logout:()=>Promise<void>}) {
  return <><header className="navbar bg-base-200 px-4 shadow-sm">
    <div className="flex-1"><strong>Magic Bag Editor</strong></div>
    <nav className="flex gap-2"><a className="btn btn-ghost btn-sm" href="#packs">ערכות</a>
      {user.role === "owner" && <a className="btn btn-ghost btn-sm" href="#admin">מנהלים</a>}
      <button className="btn btn-outline btn-sm" onClick={() => { void logout(); }}>יציאה</button>
    </nav>
  </header><main className="mx-auto max-w-5xl p-4 md:p-8">{route === "#admin" && user.role === "owner" ? <Admin/> : <Packs/>}</main></>;
}

function Packs() {
  const [schools,setSchools] = useState<School[]>([]), [packs,setPacks] = useState<ClassPack[]>([]);
  const [editing,setEditing] = useState<ClassPack|null>(null), [error,setError] = useState("");
  const [loading,setLoading] = useState(true), [saving,setSaving] = useState(false), [addingSchool,setAddingSchool] = useState(false);
  const reload = async () => {
    try {
      const [nextSchools,nextPacks] = await Promise.all([api.schools(),api.packs()]);
      setSchools(nextSchools); setPacks(nextPacks);
    } catch (cause) { setError(errText(cause)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); },[]);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const data = Object.fromEntries(["school","schoolYear","grade","classSection","title"].map(name => [name,String(form.get(name)).trim()])) as unknown as PackInput;
    setError(""); setSaving(true);
    try { await api.savePack(data,editing?.id); setEditing(null); element.reset(); await reload(); }
    catch (cause) { setError(errText(cause)); }
    finally { setSaving(false); }
  }
  async function school(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget, form = new FormData(element);
    setError(""); setAddingSchool(true);
    try {
      await api.createSchool({ name:String(form.get("name")).trim(), city:String(form.get("city")).trim(), officialCode:String(form.get("officialCode")).trim() });
      element.reset(); await reload();
    } catch (cause) { setError(errText(cause)); }
    finally { setAddingSchool(false); }
  }
  return <section><h1 className="text-3xl font-bold">ערכות כיתה בטיוטה</h1>
    <p className="mt-2 text-base-content/70">אין להזין שמות ילדים.</p>
    {error && <Alert text={error}/>}
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <form onSubmit={submit} className="card bg-base-200"><div className="card-body">
        <h2 className="card-title">{editing ? "עריכת ערכה" : "ערכה חדשה"}</h2>
        <label className="form-control"><span className="label-text mb-1">בית ספר</span>
          <select key={editing?.id || "new"} name="school" defaultValue={editing?.school || ""} required className="select select-bordered">
            <option value="">בחירה</option>{schools.map(item => <option key={item.id} value={item.id}>{item.name} — {item.city}</option>)}
          </select>
        </label>
        {(["schoolYear","grade","classSection","title"] as const).map((name,index) => <Field key={`${editing?.id}-${name}`} label={["שנת לימודים","שכבה","כיתה","שם הערכה"][index]} name={name} required maxLength={80} defaultValue={editing?.[name]}/>) }
        <button disabled={saving} className="btn btn-primary">{saving ? "שומר…" : "שמירה כטיוטה"}</button>
      </div></form>
      <form onSubmit={school} className="card bg-base-200"><div className="card-body">
        <h2 className="card-title">בית ספר חדש</h2><Field label="שם" name="name" required/><Field label="עיר" name="city" required/>
        <Field label="סמל מוסד (לא חובה)" name="officialCode"/>
        <button disabled={addingSchool} className="btn btn-secondary">{addingSchool ? "מוסיף…" : "הוספה"}</button>
      </div></form>
    </div>
    <h2 className="mt-8 text-2xl font-bold">טיוטות</h2>
    {loading ? <span className="loading loading-spinner"/> : packs.length === 0 ? <p className="mt-3 rounded-box bg-base-200 p-6">עדיין אין ערכות.</p> :
      <div className="mt-3 grid gap-3">{packs.map(pack => <article key={pack.id} className="card bg-base-200"><div className="card-body flex-row items-center">
        <div className="flex-1"><h3 className="card-title">{pack.title}</h3><p>{pack.expand?.school?.name} · {pack.schoolYear} · {pack.grade}/{pack.classSection}</p><span className="badge badge-warning">טיוטה</span></div>
        <button className="btn btn-sm" onClick={() => setEditing(pack)}>עריכה</button>
      </div></article>)}</div>}
  </section>;
}

function Admin() {
  const [items,setItems] = useState<EditorUser[]>([]), [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const load = async () => {
    try { setItems(await api.admins()); } catch (cause) { setMessage(errText(cause)); }
  };
  useEffect(() => { void load(); },[]);
  async function invite(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget, email = String(new FormData(element).get("email"));
    setBusy(true); setMessage("");
    try { await api.invite(email); setMessage("ההזמנה נשלחה"); element.reset(); await load(); }
    catch (cause) { setMessage(errText(cause)); }
    finally { setBusy(false); }
  }
  async function action(operation:()=>Promise<unknown>,success:string) {
    setBusy(true); setMessage("");
    try { await operation(); setMessage(success); await load(); }
    catch (cause) { setMessage(errText(cause)); }
    finally { setBusy(false); }
  }
  return <section><h1 className="text-3xl font-bold">ניהול מנהלים</h1>
    <form onSubmit={invite} className="mt-6 flex flex-col gap-3 rounded-box bg-base-200 p-5 sm:flex-row">
      <Field label="דוא״ל להזמנה" name="email" type="email" required/>
      <button disabled={busy} className="btn btn-primary self-end">שליחת הזמנה</button>
    </form>
    {message && <Alert text={message}/>}
    <div className="mt-5 overflow-x-auto"><table className="table bg-base-200">
      <thead><tr><th>דוא״ל</th><th>מצב</th><th>פעולות</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}><td>{item.email}</td>
        <td><span className={`badge ${!item.enabled ? "badge-error" : item.verified ? "badge-success" : "badge-warning"}`}>{!item.enabled ? "מושבת" : item.verified ? "מאומת" : "ממתין"}</span></td>
        <td className="flex gap-2">
          {item.enabled && !item.verified && <button disabled={busy} className="btn btn-xs" onClick={() => { void action(() => api.resend(item.id),"נשלחה שוב"); }}>שליחה חוזרת</button>}
          {item.role !== "owner" && !item.enabled && <button disabled={busy} className="btn btn-success btn-xs" onClick={() => { void action(() => api.invite(item.approvedEmail,true),"הגישה אושרה והזמנה חדשה נשלחה"); }}>אישור מחדש</button>}
          {item.role !== "owner" && item.enabled && <button disabled={busy} className="btn btn-error btn-xs" onClick={() => { void action(() => api.revoke(item.id),"הגישה בוטלה"); }}>ביטול גישה</button>}
        </td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

const Alert = ({text}:{text:string}) => <div role="alert" className="alert alert-info my-3"><span>{text}</span></div>;
const Page = ({title,children}:{title:string;children:ReactNode}) => <main className="grid min-h-screen place-items-center p-4"><section className="card w-full max-w-md bg-base-200 shadow-xl"><h1 className="px-8 pt-8 text-3xl font-bold">{title}</h1>{children}</section></main>;
