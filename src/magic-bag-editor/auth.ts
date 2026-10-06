import { api } from "./supabase";
import { validMember, type EditorUser } from "./types";

export { validMember };
export async function restoreAuth():Promise<EditorUser|null> {
  try {
    const user = await api.current();
    if (validMember(user)) return user;
  } catch { /* Invalid, revoked, or expired sessions cannot open the editor. */ }
  await api.logout().catch(() => {});
  return null;
}
