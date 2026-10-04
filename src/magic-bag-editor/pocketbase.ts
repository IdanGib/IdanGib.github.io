import PocketBase, { LocalAuthStore } from "pocketbase";
import type { ClassPack, EditorUser, PackInput, School } from "./types";

const url = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";
const store = new LocalAuthStore("magic-bag-editor:auth");
export const pb = new PocketBase(url, store);
const users = () => pb.collection<EditorUser>("editor_users");
export const api = {
  login: (email:string,password:string) => users().authWithPassword(email.trim().toLowerCase(), password),
  refresh: () => users().authRefresh(),
  logout: () => pb.authStore.clear(),
  current: () => pb.authStore.record as EditorUser | null,
  setPassword: (token:string,password:string) => users().confirmPasswordReset(token,password,password),
  schools: () => pb.collection<School>("schools").getFullList({sort:"name"}),
  createSchool: (data:Omit<School,"id">) => pb.collection<School>("schools").create(data),
  packs: () => pb.collection<ClassPack>("class_packs").getFullList({sort:"-updated",expand:"school"}),
  savePack: (data:PackInput,id?:string) => id ? pb.collection<ClassPack>("class_packs").update(id,data) : pb.collection<ClassPack>("class_packs").create({...data,status:"draft"}),
  admins: () => users().getFullList({sort:"email"}),
  invite: (email:string, allowRevoked=false) => pb.send("/api/magic-bag-editor/invitations",{method:"POST",body:{email,allowRevoked}}),
  resend: (id:string) => pb.send(`/api/magic-bag-editor/invitations/${id}/resend`,{method:"POST"}),
  revoke: (id:string) => pb.send(`/api/magic-bag-editor/admins/${id}/revoke`,{method:"POST"}),
};
