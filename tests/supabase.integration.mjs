import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const password = () => `Test!${randomBytes(24).toString("base64url")}`;
const row = (data) => Array.isArray(data) ? data[0] ?? null : data;
const success = (result, operation) => {
  assert.ok(!result.error, `${operation} failed (${result.error?.code ?? result.error?.name ?? "unknown"})`);
  return result.data;
};

function configuration() {
  const required = ["SUPABASE_TEST_URL", "SUPABASE_TEST_PUBLISHABLE_KEY", "SUPABASE_TEST_SECRET_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  assert.equal(missing.length, 0, `Configure ${missing.join(", ")} for an isolated Supabase test instance`);
  const url = new URL(process.env.SUPABASE_TEST_URL);
  assert.ok(["http:", "https:"].includes(url.protocol), "SUPABASE_TEST_URL must be an HTTP URL");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  assert.ok(local || process.env.SUPABASE_TEST_ALLOW_REMOTE === "1", "Integration fixtures require a local instance; explicitly set SUPABASE_TEST_ALLOW_REMOTE=1 for a dedicated remote test project");
  return { url: url.href.replace(/\/$/, ""), publicKey: process.env.SUPABASE_TEST_PUBLISHABLE_KEY, secretKey: process.env.SUPABASE_TEST_SECRET_KEY, mailUrl: process.env.SUPABASE_TEST_MAIL_URL };
}

// Supabase CLI has used both Inbucket and Mailpit for the local mail viewer.
// Read only test-recipient messages; their tokens remain in process memory.
async function invitationToken(mailUrl, email) {
  const base = mailUrl.replace(/\/$/, "");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let bodies = [];
    const search = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    if (search.ok) {
      const found = await search.json();
      for (const message of found.messages ?? found.Messages ?? []) {
        const response = await fetch(`${base}/api/v1/message/${encodeURIComponent(message.ID ?? message.id)}`);
        if (response.ok) {
          const content = await response.json();
          bodies.push(content.HTML ?? content.html ?? content.Text ?? content.text ?? "");
        }
      }
    } else {
      const mailbox = email.split("@")[0];
      const response = await fetch(`${base}/api/v1/mailbox/${encodeURIComponent(mailbox)}`);
      if (response.ok) {
        const messages = await response.json();
        for (const message of messages.reverse()) {
          const response = await fetch(`${base}/api/v1/mailbox/${encodeURIComponent(mailbox)}/${encodeURIComponent(message.id)}`);
          if (response.ok) {
            const content = await response.json();
            bodies.push(content.body?.html ?? content.body?.text ?? "");
          }
        }
      }
    }
    for (const body of bodies) {
      const links = String(body).replace(/&amp;/g, "&").match(/https?:\/\/[^\s<>"']+/g) ?? [];
      for (const link of links) {
        let parsed;
        try { parsed = new URL(link); } catch { continue; }
        const params = new URLSearchParams(`${parsed.search.slice(1)}&${parsed.hash.replace(/^#.*?\?/, "")}`);
        const token = params.get("token_hash") ?? params.get("token");
        const type = params.get("type");
        if (token && ["invite", "recovery"].includes(type)) return { token_hash: token, type };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("No invitation token reached the local test mailbox");
}

test("Supabase editor integration", { timeout: 120_000 }, async (t) => {
  const config = configuration();
  const service = createClient(config.url, config.secretKey, clientOptions);
  const freshClient = () => createClient(config.url, config.publicKey, clientOptions);
  const anonymous = freshClient();
  const users = new Set();
  const schools = new Set();
  const suffix = randomUUID();
  const email = (label) => `${label}-${suffix}@example.test`;

  t.after(async () => {
    for (const id of schools) {
      success(await service.from("class_packs").delete().eq("school_id", id), "Remove test packs");
      success(await service.from("schools").delete().eq("id", id), "Remove test school");
    }
    // A failed mail delivery can leave a pending account without returning its
    // ID. The unique test suffix also finds that account for cleanup.
    const pending = success(await service.from("editor_users").select("id").like("approved_email", `%${suffix}@example.test`), "Find remaining fixture memberships");
    for (const member of pending) users.add(member.id);
    for (const id of users) success(await service.auth.admin.deleteUser(id), "Remove test auth user");
  });

  async function actor(label, role, { enabled = true, mismatch = false, membership = true } = {}) {
    const address = email(label);
    const secret = password();
    const created = success(await service.auth.admin.createUser({ email: address, password: secret, email_confirm: true }), "Create fixture auth user");
    const id = created.user.id;
    users.add(id);
    if (membership) success(await service.from("editor_users").insert({ id, approved_email: mismatch ? email(`${label}-approved`) : address, role, enabled }), "Create fixture membership");
    const client = freshClient();
    const auth = success(await client.auth.signInWithPassword({ email: address, password: secret }), "Authenticate fixture user");
    return { id, client, session: auth.session };
  }
  const owner = await actor("owner", "owner");
  const admin = await actor("admin", "admin");
  const disabled = await actor("disabled", "admin", { enabled: false });
  const mismatched = await actor("mismatched", "admin", { mismatch: true });
  const outsider = await actor("outsider", "admin", { membership: false });

  async function assertDenied(client) {
    const profile = await client.rpc("current_editor");
    const member = row(profile.data);
    assert.ok(profile.error || !member || !member.enabled || !member.verified, "Inactive membership must not resolve to an active, verified editor");
    const list = await client.from("schools").select("id");
    assert.ok(list.error || list.data.length === 0, "Inactive membership must not read schools");
    const write = await client.from("schools").insert({ name: "Unauthorized fixture", city: "Test City" }).select("id");
    for (const school of write.data ?? []) schools.add(school.id);
    assert.ok(write.error, "Inactive membership must not create schools");
  }
  async function invoke(client, action, input = {}) {
    return client.functions.invoke("editor-admin", { body: { action, ...input } });
  }
  async function finishInvitation(address) {
    const client = freshClient();
    const token = await invitationToken(config.mailUrl, address);
    success(await client.auth.verifyOtp(token), "Verify emailed setup token");
    const premature = await client.rpc("complete_editor_setup");
    assert.ok(premature.error, "An invitation must require a newly chosen password");
    const secret = password();
    success(await client.auth.updateUser({ password: secret }), "Set invited user's password");
    success(await client.rpc("complete_editor_setup"), "Complete password setup");
    const login = freshClient();
    success(await login.auth.signInWithPassword({ email: address, password: secret }), "Log in after password setup");
    const profile = row(success(await login.rpc("current_editor"), "Load invited membership"));
    assert.equal(profile?.role, "admin");
    assert.equal(profile?.enabled, true);
    assert.equal(profile?.verified, true);
    return login;
  }

  await t.test("real owner and admin sessions resolve verified membership", async () => {
    for (const fixture of [owner, admin]) {
      const profile = row(success(await fixture.client.rpc("current_editor"), "Resolve current editor"));
      assert.equal(profile?.id, fixture.id);
      assert.equal(profile?.enabled, true);
      assert.equal(profile?.verified, true);
      assert.equal(profile?.role, fixture === owner ? "owner" : "admin");
    }
    const listed = success(await owner.client.rpc("list_editor_users"), "Owner member list");
    assert.ok(listed.some((entry) => entry.id === admin.id));
    assert.ok((await admin.client.rpc("list_editor_users")).error, "Admins must not list memberships");
  });

  await t.test("anonymous, unapproved, disabled, and mismatched users cannot access metadata", async () => {
    const signup = await anonymous.auth.signUp({ email:email("public-signup"), password:password() });
    if (signup.data.user?.id) users.add(signup.data.user.id);
    assert.equal(signup.error?.code, "signup_disabled", "Public signup must be disabled while approved email/password login stays available");
    for (const client of [anonymous, outsider.client, disabled.client, mismatched.client]) await assertDenied(client);
  });

  await t.test("members persist metadata and duplicate class identities are rejected", async () => {
    const school = success(await admin.client.from("schools").insert({ name: "Integration school", city: "Test City", official_code: `test-${suffix.slice(0, 12)}` }).select().single(), "Create school");
    schools.add(school.id);
    const input = { school_id: school.id, school_year: "2099", grade: "5", class_section: "A", title: "First fixture", status: "draft" };
    const pack = success(await admin.client.from("class_packs").insert(input).select().single(), "Create class pack");
    const duplicate = await admin.client.from("class_packs").insert({ ...input, title: "Duplicate fixture" });
    assert.equal(duplicate.error?.code, "23505", "Class identity must have a database unique constraint");
    success(await admin.client.from("class_packs").update({ title: "Persisted fixture edit" }).eq("id", pack.id), "Update class pack");
    const persisted = success(await owner.client.from("class_packs").select("title").eq("id", pack.id).single(), "Read persisted class pack");
    assert.equal(persisted.title, "Persisted fixture edit");
    assert.ok((await admin.client.from("class_packs").insert({ ...input, class_section: "B", status: "published" })).error, "Only draft status is permitted");
    assert.ok((await admin.client.from("schools").insert({ name: "", city: "Test City" })).error, "Metadata validation must reject an empty school name");
    const removable = success(await owner.client.from("schools").insert({ name: "Owner deletion fixture", city: "Test City" }).select().single(), "Create deletion fixture");
    schools.add(removable.id);
    await admin.client.from("schools").delete().eq("id", removable.id);
    assert.ok(success(await service.from("schools").select("id").eq("id", removable.id).maybeSingle(), "Check admin deletion boundary"));
    success(await owner.client.from("schools").delete().eq("id", removable.id), "Owner deletes school");
    assert.equal(success(await service.from("schools").select("id").eq("id", removable.id).maybeSingle(), "Confirm owner deletion"), null);
  });

  await t.test("clients cannot mutate memberships or escalate privileges", async () => {
    for (const client of [admin.client, owner.client]) {
      await client.from("editor_users").update({ role: "owner", enabled: false }).eq("id", admin.id);
      await client.from("editor_users").delete().eq("id", admin.id);
      const member = success(await service.from("editor_users").select("role,enabled").eq("id", admin.id).single(), "Check protected membership");
      assert.equal(member.role, "admin");
      assert.equal(member.enabled, true);
    }
    await outsider.client.from("editor_users").insert({ id: outsider.id, approved_email: email("outsider"), role: "owner", enabled: true });
    assert.equal(success(await service.from("editor_users").select("id").eq("id", outsider.id).maybeSingle(), "Check blocked membership creation"), null);
    const privileged = await admin.client.rpc("editor_begin_admin_action", { target_id: admin.id, requested_action: "revoke", allow_revoked: false });
    assert.ok(privileged.error, "The privileged administration RPC must be service-role-only");
    assert.equal(success(await service.from("editor_users").select("enabled").eq("id", admin.id).single(), "Check service RPC boundary").enabled, true);
    assert.ok((await outsider.client.rpc("complete_editor_setup")).error, "An unapproved identity cannot complete editor setup");
    for (const action of ["invite", "resend", "revoke"]) {
      const result = await invoke(admin.client, action, { email: email("forbidden"), id: owner.id });
      if (action === "invite" && result.data?.id) users.add(result.data.id);
      assert.ok(result.error, `Owner-only ${action} must reject an admin`);
      assert.equal(result.error?.context?.status, 403, `Owner-only ${action} must reject for authorization, rather than a function startup failure`);
    }
    const anonymousInvite = await invoke(anonymous, "invite", { email: email("anonymous-invite") });
    if (anonymousInvite.data?.id) users.add(anonymousInvite.data.id);
    assert.ok(anonymousInvite.error, "Invitation requires authentication");
    assert.equal(anonymousInvite.error?.context?.status, 401, "Anonymous invitation must reject for missing authentication");
  });

  let invitedAddress;
  await t.test("owner invitations normalize addresses and allow pending resend", async () => {
    invitedAddress = email("invited");
    const invited = success(await invoke(owner.client, "invite", { email: `  ${invitedAddress.toUpperCase()}  ` }), "Invite pending admin");
    assert.ok(invited.id, "Invitation must identify the member");
    users.add(invited.id);
    const member = success(await service.from("editor_users").select("role,enabled,approved_email,setup_required").eq("id", invited.id).single(), "Read pending invitation");
    assert.equal(member.role, "admin");
    assert.equal(member.enabled, true);
    assert.ok(member.approved_email === invitedAddress, "Invitation must store the normalized approved address");
    assert.equal(member.setup_required, true);
    const initialToken = config.mailUrl ? await invitationToken(config.mailUrl, invitedAddress) : null;
    // Respect the local Auth server's one-second per-address mail cooldown.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    success(await invoke(owner.client, "resend", { id: invited.id }), "Resend pending invitation");
    if (initialToken) assert.ok((await freshClient().auth.verifyOtp(initialToken)).error, "Resending must invalidate the previous setup token");
    assert.ok((await invoke(owner.client, "revoke", { id: owner.id })).error, "Owner accounts cannot be revoked through the admin route");
  });

  await t.test("emailed invitation requires password setup before usable login", { skip: config.mailUrl ? false : "Set SUPABASE_TEST_MAIL_URL to exercise local invitation delivery and setup" }, async () => {
    const invited = await finishInvitation(invitedAddress);
    success(await invited.from("schools").select("id"), "Invited admin can read metadata after setup");
  });

  await t.test("revocation rejects old access and refresh tokens, including explicit reapproval", async () => {
    const accessToken = admin.session.access_token;
    const refreshToken = admin.session.refresh_token;
    success(await invoke(owner.client, "revoke", { id: admin.id }), "Revoke admin");
    const member = success(await service.from("editor_users").select("enabled").eq("id", admin.id).single(), "Read revoked membership");
    assert.equal(member.enabled, false);
    await assertDenied(admin.client);
    const refresh = await freshClient().auth.refreshSession({ refresh_token: refreshToken });
    assert.ok(refresh.error, "Revocation must invalidate the existing refresh token");
    const address = email("admin");
    assert.ok((await invoke(owner.client, "invite", { email: address })).error, "Reinviting a revoked account requires explicit approval");
    success(await invoke(owner.client, "invite", { email: address, allowRevoked: true }), "Explicitly reapprove revoked admin");
    const oldToken = createClient(config.url, config.publicKey, { ...clientOptions, global: { headers: { Authorization: `Bearer ${accessToken}` } } });
    await assertDenied(oldToken);
    if (config.mailUrl) {
      const restored = await finishInvitation(address);
      success(await restored.from("schools").select("id"), "Reapproved admin can use its new session");
      await assertDenied(oldToken);
      assert.ok((await freshClient().auth.refreshSession({ refresh_token: refreshToken })).error, "Reapproval must not revive the revoked refresh token");
    }
  });
});
