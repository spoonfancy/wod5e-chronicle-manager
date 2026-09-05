const MODULE_ID="wod5e-relationship-tracker";
const KEY="relationships";
const ATTITUDES=["Hostile","Unfriendly","Wary","Neutral","Favorable","Devoted"];

Hooks.once("init",()=>{
 game.settings.register(MODULE_ID,KEY,{name:"Relationships",scope:"world",config:false,type:Object,default:[]});
 Handlebars.registerHelper("eq",(a,b)=>a===b);
});
const getData=()=>foundry.utils.deepClone(game.settings.get(MODULE_ID,KEY)||[]);
const saveData=v=>game.settings.set(MODULE_ID,KEY,v);
const actors=()=>[...game.actors.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(a=>({id:a.id,name:a.name,img:a.img}));

Hooks.once("ready",()=>{
 game.socket.on(`module.${MODULE_ID}`,p=>{
  if(p?.type==="relationship-card"&&p.userId===game.user.id)new RelationshipCard(p.relationship).render(true);
 });
 if(!game.user.isGM)return;
 setTimeout(()=>{
  const controls=ui.controls;
  const group=controls?.controls?.find(c=>c.name==="tokens")??controls?.controls?.[0];
  if(!group)return;
  group.tools??=[];
  if(!group.tools.some(t=>t.name===MODULE_ID)){
   group.tools.push({name:MODULE_ID,title:"Relationship Tracker",icon:"fas fa-heart",button:true,onChange:()=>new RelationshipTracker().render(true)});
   controls.render(true);
  }
 },500);
});

class RelationshipTracker extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2){
 static DEFAULT_OPTIONS={id:MODULE_ID,tag:"div",window:{title:"WoD5e Relationship Tracker",icon:"fas fa-heart"},position:{width:900,height:650}};
 static PARTS={main:{template:`modules/${MODULE_ID}/templates/tracker.hbs`}};
 async _prepareContext(){
  const map=new Map(actors().map(a=>[a.id,a]));
  return {relationships:getData().map(r=>({...r,npcName:map.get(r.npcId)?.name??"Unknown NPC",pcName:map.get(r.pcId)?.name??"Unknown Character",npcImg:map.get(r.npcId)?.img??"icons/svg/mystery-man.svg"}))};
 }
 _onRender(){this.element.querySelectorAll("[data-action]").forEach(e=>e.addEventListener("click",e2=>this.action(e2)))}
 async action(e){
  const a=e.currentTarget.dataset.action,id=e.currentTarget.dataset.id;
  if(a==="create")return new RelationshipEditor().render(true);
  if(a==="edit")return new RelationshipEditor({relationshipId:id}).render(true);
  if(a==="delete"){await saveData(getData().filter(r=>r.id!==id));return this.render();}
  if(a==="show"){
   const r=getData().find(x=>x.id===id);if(!r)return;
   const pc=game.actors.get(r.pcId),u=game.users.find(x=>x.character?.id===pc?.id);
   if(!u)return ui.notifications.warn("No active player is assigned to this character.");
   game.socket.emit(`module.${MODULE_ID}`,{type:"relationship-card",userId:u.id,relationship:r});
   ui.notifications.info(`Relationship card sent to ${u.name}.`);
  }
 }
}

class RelationshipEditor extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2){
 constructor(o={}){super(o);this.relationshipId=o.relationshipId}
 static DEFAULT_OPTIONS={id:`${MODULE_ID}-editor`,tag:"div",window:{title:"Edit Relationship",icon:"fas fa-user-friends"},position:{width:700,height:600},form:{handler:RelationshipEditor.submit,closeOnSubmit:true,submitOnChange:false}};
 static PARTS={form:{template:`modules/${MODULE_ID}/templates/editor.hbs`}};
 async _prepareContext(){return {relationship:getData().find(r=>r.id===this.relationshipId)||{},actors:actors(),attitudes:ATTITUDES}}
 static async submit(event,form,formData){
  const v=foundry.utils.expandObject(formData.object),list=getData();
  const r={id:this.relationshipId||foundry.utils.randomID(),npcId:v.npcId,pcId:v.pcId,attitude:v.attitude,publicDescription:v.publicDescription||"",privateNotes:v.privateNotes||""};
  const i=list.findIndex(x=>x.id===r.id);if(i>=0)list[i]=r;else list.push(r);
  await saveData(list);ui.windows.get(MODULE_ID)?.render(true);
 }
}

class RelationshipCard extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2){
 constructor(r){super({});this.relationship=r}
 static DEFAULT_OPTIONS={id:`${MODULE_ID}-card`,tag:"div",window:{title:"Relationship",icon:"fas fa-heart"},position:{width:500,height:600}};
 static PARTS={card:{template:`modules/${MODULE_ID}/templates/card.hbs`}};
 async _prepareContext(){const n=game.actors.get(this.relationship.npcId);return {relationship:this.relationship,npc:{name:n?.name??"Unknown NPC",img:n?.img??"icons/svg/mystery-man.svg"}}}
}
window.WoD5eRelationshipTracker={open:()=>new RelationshipTracker().render(true)};
