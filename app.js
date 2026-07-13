import { firebaseConfig, WORKSPACE_ID } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, getDoc, onSnapshot, serverTimestamp, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $=id=>document.getElementById(id);
const today=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const app=initializeApp(firebaseConfig);
const auth=getAuth(app), db=getFirestore(app), provider=new GoogleAuthProvider();
let people=[], cases=[], tasks=[], members=[], auditLogs=[], currentMember=null, currentUser=null, unsubs=[];

const col=name=>collection(db,'workspaces',WORKSPACE_ID,name);
const refs={people:col('people'),cases:col('cases'),tasks:col('tasks'),members:col('members'),audit:col('auditLogs')};
$('workspaceId').textContent=WORKSPACE_ID;

const roleNames={admin:'管理員',director:'主任',assistant:'助理',volunteer:'志工'};
const canEdit=()=>['admin','director','assistant'].includes(currentMember?.role);
const isAdmin=()=>currentMember?.role==='admin';

$('loginBtn').onclick=async()=>{try{await signInWithPopup(auth,provider)}catch(e){$('loginError').textContent=e.message;$('loginError').classList.remove('hidden')}};
$('logoutBtn').onclick=$('blockedLogoutBtn').onclick=()=>signOut(auth);

onAuthStateChanged(auth,async user=>{
  cleanup();
  currentUser=user;
  if(!user){show('loginView');return}
  const memberSnap=await getDoc(doc(refs.members,user.uid));
  if(!memberSnap.exists() || memberSnap.data().active!==true){
    $('blockedEmail').textContent=user.email||'';
    show('blockedView');
    return;
  }
  currentMember={id:user.uid,...memberSnap.data()};
  $('userName').textContent=user.displayName||user.email;
  $('roleBadge').textContent=roleNames[currentMember.role]||currentMember.role;
  document.querySelectorAll('.admin-only').forEach(x=>x.classList.toggle('hidden',!isAdmin()));
  document.querySelectorAll('.editor-only').forEach(x=>x.classList.toggle('hidden',!canEdit()));
  show('appView');
  subscribe();
});

function show(id){
  ['loginView','blockedView','appView'].forEach(x=>$(x).classList.add('hidden'));
  $(id).classList.remove('hidden');
}
function cleanup(){unsubs.forEach(f=>f());unsubs=[];people=[];cases=[];tasks=[];members=[];auditLogs=[];currentMember=null}

function subscribe(){
  $('syncStatus').textContent='同步中…';
  unsubs.push(onSnapshot(refs.people,s=>{people=s.docs.map(d=>({id:d.id,...d.data()}));renderAll()}));
  unsubs.push(onSnapshot(refs.cases,s=>{cases=s.docs.map(d=>({id:d.id,...d.data()}));renderAll()}));
  unsubs.push(onSnapshot(refs.tasks,s=>{tasks=s.docs.map(d=>({id:d.id,...d.data()}));renderAll();$('syncStatus').textContent='已同步至雲端'}));
  if(isAdmin()){
    unsubs.push(onSnapshot(refs.members,s=>{members=s.docs.map(d=>({id:d.id,...d.data()}));renderMembers()}));
    unsubs.push(onSnapshot(query(refs.audit,orderBy('createdAt','desc'),limit(100)),s=>{auditLogs=s.docs.map(d=>({id:d.id,...d.data()}));renderAudit()}));
  }
}
const pname=id=>people.find(p=>p.id===id)?.name||'未指定';
const ctitle=id=>cases.find(c=>c.id===id)?.title||'未指定';

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');$('view-'+b.dataset.view).classList.add('active');
});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());

async function logAction(action,entityType,entityId,summary){
  await addDoc(refs.audit,{
    action,entityType,entityId,summary,
    actorUid:currentUser.uid,
    actorEmail:currentUser.email||'',
    actorName:currentUser.displayName||'',
    createdAt:serverTimestamp()
  });
}

function renderAll(){
  $('statPeople').textContent=people.length;
  $('statCases').textContent=cases.filter(c=>c.status!=='已完成').length;
  $('statTasks').textContent=tasks.filter(t=>!t.done&&t.dueDate&&t.dueDate<=today()).length;
  $('statRate').textContent=cases.length?Math.round(cases.filter(c=>c.status==='已完成').length/cases.length*100)+'%':'0%';

  $('recentCases').innerHTML=cases.slice(0,5).map(c=>card(c.title,`${pname(c.personId)}｜${c.assignee||'未指定'}`,c.status)).join('')||'<p class="muted">目前沒有案件</p>';
  $('recentTasks').innerHTML=tasks.filter(t=>!t.done).slice(0,5).map(t=>card(t.title,`${t.owner||'未指定'}｜${t.dueDate||'未設定'}`,t.priority)).join('')||'<p class="muted">目前沒有追蹤</p>';

  const pq=$('peopleSearch').value.toLowerCase();
  $('peopleList').innerHTML=people.filter(p=>[p.name,p.phone,p.village].join(' ').toLowerCase().includes(pq)).map(p=>`
    <article class="card"><div><h3>${esc(p.name)}</h3><div class="muted">${esc([p.village,p.phone,p.address].filter(Boolean).join('｜'))}</div></div>
    ${canEdit()?`<button class="btn secondary" onclick="openPerson('${p.id}')">編輯</button>`:''}</article>`).join('')||'<div class="panel muted">尚無民眾資料</div>';

  const cq=$('caseSearch').value.toLowerCase(), sf=$('caseStatusFilter').value;
  $('caseList').innerHTML=cases.filter(c=>[c.title,c.description,pname(c.personId)].join(' ').toLowerCase().includes(cq)&&(!sf||c.status===sf)).map(c=>`
    <article class="card"><div><h3>${esc(c.title)}</h3><div class="muted">${esc(pname(c.personId))}｜${esc(c.category)}｜${esc(c.assignee||'未指定')}</div><span class="badge">${esc(c.status)}</span></div>
    ${canEdit()?`<button class="btn secondary" onclick="openCase('${c.id}')">編輯</button>`:''}</article>`).join('')||'<div class="panel muted">尚無案件資料</div>';

  const tq=$('taskSearch').value.toLowerCase();
  $('taskList').innerHTML=tasks.filter(t=>t.title.toLowerCase().includes(tq)).map(t=>`
    <article class="card"><div><h3>${t.done?'✅ ':''}${esc(t.title)}</h3><div class="muted">${esc(t.owner||'未指定')}｜${esc(t.dueDate||'未設定')}｜${esc(ctitle(t.caseId))}</div></div>
    ${canEdit()?`<button class="btn secondary" onclick="openTask('${t.id}')">編輯</button>`:''}</article>`).join('')||'<div class="panel muted">尚無追蹤任務</div>';

  $('casePersonId').innerHTML='<option value="">未指定</option>'+people.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  $('taskCaseId').innerHTML='<option value="">未指定</option>'+cases.map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join('');
}
function card(title,meta,badge){return `<div class="card"><div><h3>${esc(title)}</h3><div class="muted">${esc(meta)}</div></div><span class="badge">${esc(badge||'')}</span></div>`}

function renderMembers(){
  $('memberList').innerHTML=members.map(m=>`<article class="card"><div><h3>${esc(m.email||m.id)}</h3><div class="muted">${esc(roleNames[m.role]||m.role)}｜${m.active?'啟用':'停用'}</div></div><button class="btn secondary" onclick="toggleMember('${m.id}',${m.active!==true})">${m.active?'停用':'啟用'}</button></article>`).join('');
}
function renderAudit(){
  $('auditList').innerHTML=auditLogs.map(a=>`<article class="card"><div><h3>${esc(a.action)}｜${esc(a.entityType)}</h3><div class="muted">${esc(a.summary||'')}<br>${esc(a.actorEmail||'')}｜${a.createdAt?.toDate?.().toLocaleString('zh-TW')||'同步中'}</div></div></article>`).join('')||'<p class="muted">尚無操作紀錄</p>';
}

window.openPerson=id=>{if(!canEdit())return;$('personForm').reset();$('personId').value='';$('deletePersonBtn').classList.toggle('hidden',!id);if(id){const p=people.find(x=>x.id===id);$('personId').value=id;$('personName').value=p.name||'';$('personPhone').value=p.phone||'';$('personVillage').value=p.village||'';$('personAddress').value=p.address||'';$('personPref').value=p.contactPref||'';$('personNotes').value=p.notes||'';$('personConsent').checked=!!p.consent}$('personDialog').showModal()};
window.openCase=id=>{if(!canEdit())return;$('caseForm').reset();$('caseId').value='';$('deleteCaseBtn').classList.toggle('hidden',!id);if(id){const c=cases.find(x=>x.id===id);$('caseId').value=id;$('caseTitle').value=c.title||'';$('casePersonId').value=c.personId||'';$('caseCategory').value=c.category||'其他';$('caseStatus').value=c.status||'待處理';$('caseAssignee').value=c.assignee||'';$('caseFollowupDate').value=c.followupDate||'';$('caseDescription').value=c.description||'';$('caseResolution').value=c.resolution||''}$('caseDialog').showModal()};
window.openTask=id=>{if(!canEdit())return;$('taskForm').reset();$('taskId').value='';$('deleteTaskBtn').classList.toggle('hidden',!id);if(id){const t=tasks.find(x=>x.id===id);$('taskId').value=id;$('taskTitle').value=t.title||'';$('taskDueDate').value=t.dueDate||'';$('taskPriority').value=t.priority||'普通';$('taskCaseId').value=t.caseId||'';$('taskOwner').value=t.owner||'';$('taskDone').checked=!!t.done}$('taskDialog').showModal()};

$('addPersonBtn').onclick=()=>openPerson('');
$('addCaseBtn').onclick=()=>openCase('');
$('addTaskBtn').onclick=()=>openTask('');
['peopleSearch','caseSearch','taskSearch'].forEach(id=>$(id).oninput=renderAll);
$('caseStatusFilter').onchange=renderAll;

$('personForm').onsubmit=async e=>{e.preventDefault();const id=$('personId').value,d={name:$('personName').value.trim(),phone:$('personPhone').value.trim(),village:$('personVillage').value.trim(),address:$('personAddress').value.trim(),contactPref:$('personPref').value,notes:$('personNotes').value.trim(),consent:$('personConsent').checked,updatedAt:serverTimestamp(),updatedBy:currentUser.uid};if(id){await setDoc(doc(refs.people,id),d,{merge:true});await logAction('修改','民眾',id,d.name)}else{const r=await addDoc(refs.people,{...d,createdAt:serverTimestamp(),createdBy:currentUser.uid});await logAction('新增','民眾',r.id,d.name)}$('personDialog').close()};
$('caseForm').onsubmit=async e=>{e.preventDefault();const id=$('caseId').value,d={title:$('caseTitle').value.trim(),personId:$('casePersonId').value,category:$('caseCategory').value,status:$('caseStatus').value,assignee:$('caseAssignee').value.trim(),followupDate:$('caseFollowupDate').value,description:$('caseDescription').value.trim(),resolution:$('caseResolution').value.trim(),updatedAt:serverTimestamp(),updatedBy:currentUser.uid};if(id){await setDoc(doc(refs.cases,id),d,{merge:true});await logAction('修改','案件',id,d.title)}else{const r=await addDoc(refs.cases,{...d,createdAt:serverTimestamp(),createdBy:currentUser.uid});await logAction('新增','案件',r.id,d.title)}$('caseDialog').close()};
$('taskForm').onsubmit=async e=>{e.preventDefault();const id=$('taskId').value,d={title:$('taskTitle').value.trim(),dueDate:$('taskDueDate').value,priority:$('taskPriority').value,caseId:$('taskCaseId').value,owner:$('taskOwner').value.trim(),done:$('taskDone').checked,updatedAt:serverTimestamp(),updatedBy:currentUser.uid};if(id){await setDoc(doc(refs.tasks,id),d,{merge:true});await logAction('修改','追蹤',id,d.title)}else{const r=await addDoc(refs.tasks,{...d,createdAt:serverTimestamp(),createdBy:currentUser.uid});await logAction('新增','追蹤',r.id,d.title)}$('taskDialog').close()};

$('deletePersonBtn').onclick=async()=>{const id=$('personId').value,p=people.find(x=>x.id===id);if(confirm('確定刪除？')){await deleteDoc(doc(refs.people,id));await logAction('刪除','民眾',id,p?.name||'');$('personDialog').close()}};
$('deleteCaseBtn').onclick=async()=>{const id=$('caseId').value,c=cases.find(x=>x.id===id);if(confirm('確定刪除？')){await deleteDoc(doc(refs.cases,id));await logAction('刪除','案件',id,c?.title||'');$('caseDialog').close()}};
$('deleteTaskBtn').onclick=async()=>{const id=$('taskId').value,t=tasks.find(x=>x.id===id);if(confirm('確定刪除？')){await deleteDoc(doc(refs.tasks,id));await logAction('刪除','追蹤',id,t?.title||'');$('taskDialog').close()}};

$('addMemberBtn').onclick=async()=>{
  if(!isAdmin())return;
  const email=$('memberEmail').value.trim().toLowerCase(), role=$('memberRole').value;
  if(!email){alert('請輸入 Email');return}
  alert('Firebase 安全規則使用 UID 作為白名單鍵值。請先讓該同仁登入一次，取得 UID 後再由管理員建立成員文件。詳細步驟請看 README。');
};

window.toggleMember=async(id,newActive)=>{
  if(!isAdmin())return;
  await setDoc(doc(refs.members,id),{active:newActive,updatedAt:serverTimestamp(),updatedBy:currentUser.uid},{merge:true});
  await logAction(newActive?'啟用成員':'停用成員','成員',id,id);
};

$('exportBtn').onclick=()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify({people,cases,tasks,members,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}));
  a.download=`服務處CRM安全備份_${today()}.json`;a.click()
};
