import { api, pb } from "./pocketbase";
import type { EditorUser } from "./types";
export const validMember = (user:EditorUser|null): user is EditorUser => Boolean(user && user.collectionName === "editor_users" && user.enabled && user.verified && user.email.toLowerCase() === user.approvedEmail.toLowerCase());
export const restoreAuth = async ():Promise<EditorUser|null> => {
  if (!pb.authStore.isValid) { api.logout(); return null; }
  try { await api.refresh(); const user=api.current(); if (!validMember(user)) throw new Error("membership disabled"); return user; }
  catch { api.logout(); return null; }
};
