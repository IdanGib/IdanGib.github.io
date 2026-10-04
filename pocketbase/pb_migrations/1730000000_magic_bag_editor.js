/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const member = '@request.auth.collectionName = "editor_users" && @request.auth.enabled = true && @request.auth.verified = true && @request.auth.email = @request.auth.approvedEmail';
  const owner = member + ' && @request.auth.role = "owner"';
  const users = new Collection({
    type: "auth", name: "editor_users",
    listRule: owner, viewRule: owner, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type:"select", name:"role", required:true, maxSelect:1, values:["owner","admin"] },
      { type:"bool", name:"enabled", required:true },
      { type:"email", name:"approvedEmail", required:true, presentable:true },
    ],
    indexes:["CREATE UNIQUE INDEX idx_editor_users_approved_email ON editor_users (LOWER(approvedEmail))"],
    passwordAuth:{enabled:true, identityFields:["email"]},
    oauth2:{enabled:false}, otp:{enabled:false}, mfa:{enabled:false},
    authToken:{duration:604800}, passwordResetToken:{duration:1800}, verificationToken:{duration:1800}, emailChangeToken:{duration:1800},
    passwordResetTemplate:{subject:"Magic Bag Editor – הגדרת סיסמה",body:'<p>הוזמנת ל-Magic Bag Editor.</p><p><a href="{APP_URL}/magic-bag-editor.html#setup?token={TOKEN}">הגדרת סיסמה</a></p>'}
  });
  app.save(users);
  const schools = new Collection({type:"base",name:"schools",listRule:member,viewRule:member,createRule:member,updateRule:member,deleteRule:owner,fields:[
    {type:"text",name:"name",required:true,min:2,max:120,presentable:true},
    {type:"text",name:"city",required:true,min:2,max:120},
    {type:"text",name:"officialCode",required:false,max:30}
  ],indexes:["CREATE UNIQUE INDEX idx_schools_code ON schools (officialCode) WHERE officialCode != ''"]});
  app.save(schools);
  const packs = new Collection({type:"base",name:"class_packs",listRule:member,viewRule:member,createRule:member,updateRule:member,deleteRule:member,fields:[
    {type:"relation",name:"school",required:true,maxSelect:1,collectionId:schools.id,cascadeDelete:false},
    {type:"text",name:"schoolYear",required:true,min:4,max:20},
    {type:"text",name:"grade",required:true,min:1,max:20},
    {type:"text",name:"classSection",required:true,min:1,max:20},
    {type:"text",name:"title",required:true,min:2,max:120,presentable:true},
    {type:"select",name:"status",required:true,maxSelect:1,values:["draft"]}
  ],indexes:["CREATE UNIQUE INDEX idx_class_pack_key ON class_packs (school, schoolYear, grade, classSection)"]});
  app.save(packs);
}, (app) => {
  for (const name of ["class_packs","schools","editor_users"]) { try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {} }
});
