export type Role = "owner" | "admin";
export interface EditorUser { id:string; email:string; approvedEmail:string; role:Role; enabled:boolean; verified:boolean; created:string }
export interface School { id:string; name:string; city:string; officialCode?:string }
export interface ClassPack { id:string; school:string; schoolYear:string; grade:string; classSection:string; title:string; status:"draft"; updated:string; expand?:{school?:School} }
export interface PackInput { school:string; schoolYear:string; grade:string; classSection:string; title:string }

export const validMember = (user:EditorUser|null): user is EditorUser => Boolean(
  user && (user.role === "owner" || user.role === "admin") && user.enabled === true && user.verified === true &&
  typeof user.email === "string" && typeof user.approvedEmail === "string" && user.email &&
  user.email.toLowerCase() === user.approvedEmail.toLowerCase()
);
