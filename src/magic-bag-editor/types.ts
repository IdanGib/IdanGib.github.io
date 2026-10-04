export type Role = "owner" | "admin";
export interface EditorUser { id:string; collectionName?:string; email:string; approvedEmail:string; role:Role; enabled:boolean; verified:boolean; created:string }
export interface School { id:string; name:string; city:string; officialCode?:string }
export interface ClassPack { id:string; school:string; schoolYear:string; grade:string; classSection:string; title:string; status:"draft"; updated:string; expand?:{school?:School} }
export interface PackInput { school:string; schoolYear:string; grade:string; classSection:string; title:string }
