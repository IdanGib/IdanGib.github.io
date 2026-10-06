import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.2";

type Member = { id: string; approved_email: string; role: "owner" | "admin"; enabled: boolean; setup_required: boolean };
type Action = "invite" | "resend" | "revoke";

class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const requiredEnv = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new RequestError(503, `Missing server configuration: ${name}`);
  return value;
};

function siteConfiguration() {
  let site: URL;
  try { site = new URL(requiredEnv("EDITOR_SITE_URL")); }
  catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(503, "EDITOR_SITE_URL must be an absolute frontend URL");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(site.hostname);
  if ((site.protocol !== "https:" && !(local && site.protocol === "http:")) || site.username || site.password || site.search || site.hash) {
    throw new RequestError(503, "EDITOR_SITE_URL must use HTTPS (HTTP is allowed for localhost) and contain no credentials, query, or fragment");
  }
  if (!site.pathname.endsWith("/")) site.pathname += "/";
  return { origin: site.origin, redirectTo: new URL("magic-bag-editor.html?setup=1", site).href };
}

function randomPassword(): string {
  // This password is never delivered or logged. Native Auth password rotation
  // invalidates pending invite/recovery links and removes all existing sessions.
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `Aa1!${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (request: Request) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  let targetId: string | undefined;
  let actionToken: string | undefined;
  let service: SupabaseClient | undefined;

  const response = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
  try {
    const site = siteConfiguration();
    const origin = request.headers.get("Origin");
    if (origin && origin !== site.origin) throw new RequestError(403, "Frontend origin is not allowed");
    headers["Access-Control-Allow-Origin"] = site.origin;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") throw new RequestError(405, "Use POST for editor administration");

    const bearer = request.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!bearer) throw new RequestError(401, "Authentication required");
    const url = requiredEnv("SUPABASE_URL");
    const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
    const caller = createClient(url, requiredEnv("SUPABASE_ANON_KEY"), {
      auth: authOptions,
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: identity, error: identityError } = await caller.auth.getUser(bearer);
    if (identityError || !identity.user) throw new RequestError(401, "The authentication session is invalid");
    const { data: editors, error: membershipError } = await caller.rpc("current_editor");
    const owner = Array.isArray(editors) ? editors[0] : null;
    if (membershipError || !owner || owner.id !== identity.user.id || owner.role !== "owner" || !owner.enabled || !owner.verified) {
      throw new RequestError(403, "Active, verified owner membership required");
    }

    // Service-role credentials are used only after both Auth and current
    // whitelist/session authorization succeed. No user-supplied redirect exists.
    service = createClient(url, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: authOptions });
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
      throw new RequestError(400, "Send an application/json request");
    }
    const rawBody = await request.text();
    if (rawBody.length > 2048) throw new RequestError(400, "Request is too large");
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      body = parsed;
    } catch { throw new RequestError(400, "A JSON object is required"); }
    const action = body.action as Action;
    if (!["invite", "resend", "revoke"].includes(action)) throw new RequestError(400, "Unknown editor action");
    let member: Member;

    if (action === "invite") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (email.length > 254 || !emailPattern.test(email)) throw new RequestError(400, "A valid email is required");
      if (body.allowRevoked !== undefined && typeof body.allowRevoked !== "boolean") throw new RequestError(400, "allowRevoked must be a boolean");
      const { data, error } = await service.from("editor_users").select("id, approved_email, role, enabled, setup_required").eq("approved_email", email).maybeSingle();
      if (error) throw new RequestError(500, "Unable to read editor membership");
      if (data) {
        member = data as Member;
      } else {
        const { data: created, error: createError } = await service.auth.admin.createUser({
          email, password: randomPassword(), email_confirm: false,
        });
        if (createError || !created.user) {
          // Do not silently adopt an unrelated Auth account. Bootstrap/adoption
          // is an explicit privileged database operation, outside this endpoint.
          throw new RequestError(409, createError?.message ?? "Unable to create invited identity");
        }
        const { data: inserted, error: insertError } = await service.from("editor_users").insert({
          id: created.user.id, approved_email: email, role: "admin", enabled: true, setup_required: true,
        }).select("id, approved_email, role, enabled, setup_required").single();
        if (insertError || !inserted) {
          // This identity has never received an invitation and has no known
          // password. Delete only the Auth user created by this request.
          await service.auth.admin.deleteUser(created.user.id);
          throw new RequestError(500, "Unable to create editor membership; retry the invitation");
        }
        member = inserted as Member;
      }
    } else {
      const id = typeof body.id === "string" ? body.id : "";
      if (!uuidPattern.test(id)) throw new RequestError(400, "A valid editor ID is required");
      const { data, error } = await service.from("editor_users").select("id, approved_email, role, enabled, setup_required").eq("id", id).maybeSingle();
      if (error) throw new RequestError(500, "Unable to read editor membership");
      if (!data) throw new RequestError(404, "Editor not found");
      member = data as Member;
    }

    targetId = member.id;
    const { data: lock, error: lockError } = await service.rpc("editor_begin_admin_action", {
      target_id: targetId, requested_action: action, allow_revoked: body.allowRevoked === true,
    });
    if (lockError || typeof lock !== "string") throw new RequestError(lockError?.code === "55000" ? 409 : 400, lockError?.message ?? "Unable to begin editor operation");
    actionToken = lock;

    // Password rotation is supported by Auth's admin API: it clears native
    // confirmation/recovery tokens AND refresh sessions. Whitelist RLS/session
    // cutoff additionally protects against already-issued access JWTs.
    const { data: rotated, error: rotateError } = await service.auth.admin.updateUserById(targetId, {
      password: randomPassword(), ban_duration: action === "revoke" ? "876000h" : "none",
    });
    if (rotateError || !rotated.user) {
      throw new RequestError(502, action === "revoke"
        ? "Membership was revoked, but Auth cleanup failed; retry revoke to invalidate its remaining setup links"
        : "Unable to prepare the invitation; retry this operation");
    }
    if (action === "revoke") return response(200, { id: targetId, revoked: true });

    const { error: prepareError } = await service.rpc("editor_prepare_invitation", { target_id: targetId, action_token: actionToken });
    if (prepareError) throw new RequestError(500, "Unable to prepare editor membership; retry this operation");
    const delivery = rotated.user.email_confirmed_at
      ? await service.auth.resetPasswordForEmail(member.approved_email, { redirectTo: site.redirectTo })
      : await service.auth.admin.inviteUserByEmail(member.approved_email, { redirectTo: site.redirectTo });
    if (delivery.error) {
      // Password and membership stay pending; no old link/session can regain
      // access, and an owner can safely resend once mail delivery is repaired.
      throw new RequestError(502, `Invitation email was not delivered; the editor remains pending and can be resent. ${delivery.error.message}`);
    }
    return response(200, { id: targetId, email: member.approved_email, delivered: true });
  } catch (error) {
    if (error instanceof RequestError) return response(error.status, { error: error.message });
    return response(500, { error: "Editor administration failed; retry after checking the server configuration" });
  } finally {
    if (service && targetId && actionToken) {
      // Locks are also bounded in the database if the worker stops mid-request.
      const { error } = await service.rpc("editor_finish_admin_action", { target_id: targetId, action_token: actionToken });
      if (error) console.error("Unable to release editor action lock", error.code);
    }
  }
});
