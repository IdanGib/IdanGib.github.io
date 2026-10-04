/// <reference path="../pb_data/types.d.ts" />
const collection = "editor_users";
const normalize = (value) => String(value || "").trim().toLowerCase();
const isMember = (record) => record && record.collection().name === collection && record.getBool("enabled") && record.verified() && normalize(record.email()) === normalize(record.get("approvedEmail"));
const requireOwner = (e) => { if (!isMember(e.auth) || e.auth.get("role") !== "owner") throw new ForbiddenError("Owner access required."); };

onRecordAuthWithPasswordRequest((e) => { if (!isMember(e.record)) throw new BadRequestError("Invalid credentials."); e.next(); }, collection);
onRecordAuthRefreshRequest((e) => { if (!isMember(e.record)) throw new ForbiddenError("Membership is no longer active."); e.next(); }, collection);
onRecordRequestPasswordResetRequest((e) => { throw new ForbiddenError("Password invitations are owner managed."); }, collection);
onRecordConfirmPasswordResetRequest((e) => { if (!e.record.getBool("enabled") || normalize(e.record.email()) !== normalize(e.record.get("approvedEmail"))) throw new ForbiddenError("Invitation was revoked."); e.next(); }, collection);
// Public record mutation routes remain locked by null API rules. This hook is defense in depth.
onRecordUpdateRequest((e) => { requireOwner(e); for (const key of ["role","enabled","approvedEmail","email"]) if (e.record.original().get(key) !== e.record.get(key)) throw new ForbiddenError("Protected membership fields cannot be edited directly."); e.next(); }, collection);
onRecordDeleteRequest((e) => { throw new ForbiddenError("Editors are revoked, not deleted."); }, collection);

const deliver = (app, record) => { $mails.sendRecordPasswordReset(app, record); };
routerAdd("POST", "/api/magic-bag-editor/invitations", (e) => {
  requireOwner(e); const data = new DynamicModel({email:"",allowRevoked:false}); e.bindBody(data); const email=normalize(data.email);
  if (!email || email.indexOf("@") < 1) throw new BadRequestError("A valid email is required.");
  let record;
  try { record=e.app.findAuthRecordByEmail(collection,email); } catch (_) {
    record=new Record(e.app.findCollectionByNameOrId(collection)); record.setEmail(email); record.set("approvedEmail",email); record.set("role","admin"); record.set("enabled",true); record.setVerified(false); record.setRandomPassword(); e.app.save(record);
  }
  if (record.get("role") === "owner") throw new BadRequestError("Owners cannot be reinvited.");
  if (!record.getBool("enabled")) { if (!data.allowRevoked) throw new BadRequestError("This editor was revoked; explicit approval is required."); record.set("enabled",true); record.setVerified(false); record.refreshTokenKey(); e.app.save(record); }
  deliver(e.app,record); return e.json(200,{id:record.id,email:record.email(),delivered:true});
}, $apis.requireAuth(collection));
routerAdd("POST", "/api/magic-bag-editor/invitations/{id}/resend", (e) => { requireOwner(e); const r=e.app.findRecordById(collection,e.request.pathValue("id")); if (!r.getBool("enabled") || r.verified()) throw new BadRequestError("Only pending invitations can be resent."); deliver(e.app,r); return e.json(200,{delivered:true}); }, $apis.requireAuth(collection));
routerAdd("POST", "/api/magic-bag-editor/admins/{id}/revoke", (e) => { requireOwner(e); const r=e.app.findRecordById(collection,e.request.pathValue("id")); if (r.get("role") === "owner") throw new BadRequestError("Owners cannot be revoked here."); r.set("enabled",false); r.refreshTokenKey(); e.app.save(r); return e.json(200,{revoked:true}); }, $apis.requireAuth(collection));
