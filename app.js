import {firebaseConfig,WORKSPACE_ID,BOOTSTRAP_ADMIN_EMAIL} from './firebase-config.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged,setPersistence,browserLocalPersistence} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,doc,addDoc,setDoc,deleteDoc,getDoc,onSnapshot,serverTimestamp,query,orderBy,limit,writeBatch} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $=id=>document.getElementById(id);
const today=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fb=initializeApp(firebaseConfig),auth=getAuth(fb),db=getFirestore(fb),provider=new GoogleAuthProvider();
await setPersistence(auth,browserLocalPersistence);
const c=name=>collection(db,'workspaces',WORKSPACE_ID,name);
const refs={people:c('people'),cases:c('cases'),tasks:c('tasks'),members:c('members'),invites:c('invites'),audit:c('auditLogs')};
let user=null,member=null,people=[],cases=[],tasks=[],members=[],invites=[],logs=[],unsubs=[];

const roles={admin:'管理員',director:'主任',assistant:'助理',volunteer:'志工'};
const canEdit=()=>['admin','director','assistant'].includes(member?.role);
const isAdmin=()=>member?.role==='admin';
const pname=id=>people.find(x=>x.id===id)?.name||'未指定';
const ctitle=id=>cases.find(x=>x.id===id)?.title||'未指定';

$('loginBtn').onclick=async()=>{try{await signInWithPopup(auth,provider)}catch(e){$('loginMessage').textContent=e.message}};
$('logoutBtn').onclick=$('pendingLogoutBtn').onclick=()=>signOut(auth);
$('retryClaimBtn').onclick=()=>attemptAccess(user);

onAuthStateChanged(auth,async u=>{
  cleanup();user=u;
  if(!u){show('loginView');return}
  show('loadingView');
  try{await attemptAccess(u)}catch(e){console.error(e);$('loginMessage').textContent=`權限確認失敗：${e.code||''} ${e.message||''}`;show('loginView')}
});

async function attemptAccess(u){
  $('loginMessage').textContent='';
  const email=(u.email||'').toLowerCase();
  const memberRef=doc(refs.members,u.uid);
  let snap=await getDoc(memberRef);

  if(!snap.exists() && email===BOOTSTRAP_ADMIN_EMAIL.toLowerCase()){
    await setDoc(memberRef,{
      email,
      displayName:u.displayName||email,
      role:'admin',
      active:true,
      joinedAt:serverTimestamp(),
      bootstrap:true
    });
    snap=await getDoc(memberRef);
  }

  if(!snap.exists()){
    const inviteRef=doc(refs.invites,email);
    const inviteSnap=await getDoc(inviteRef);

    if(inviteSnap.exists() && inviteSnap.data().active!==false){
      const batch=writeBatch(db);
      batch.set(memberRef,{
        email,
        displayName:u.displayName||email,
        role:inviteSnap.data().role,
        active:true,
        joinedAt:serverTimestamp()
      });
      batch.delete(inviteRef);
      await batch.commit();
      snap=await getDoc(memberRef);
    }
  }

  if(!snap.exists() || snap.data().active!==true){
    $('pendingEmail').textContent=u.email||'';
    show('pendingView');return;
  }

  member={id:u.uid,...snap.data()};
  $('userName').textContent=u.displayName||u.email;
  $('roleBadge').textContent=roles[member.role]||member.role;
  document.querySelectorAll('.admin-only').forEach(x=>x.classList.toggle('hidden',!isAdmin()));
  document.querySelectorAll('.editor-only').forEach(x=>x.classList.toggle('hidden',!canEdit()));
  show('appView');subscribe();
}

function show(id){
  ['loginView','loadingView','pendingView','appView'].forEach(x=>$(x).classList.add('hidden'));
  $(id).classList.remove('hidden');
}
function cleanup(){
  unsubs.forEach(f=>f());unsubs=[];
  member=null;people=[];cases=[];tasks=[];members=[];invites=[];logs=[];
}
function subscribe(){
  $('syncStatus').textContent='同步中…';
  unsubs.push(onSnapshot(refs.people,s=>{people=s.docs.map(d=>({id:d.id,...d.data()}));render()}));
  unsubs.push(onSnapshot(refs.cases,s=>{cases=s.docs.map(d=>({id:d.id,...d.data()}));render()}));
  unsubs.push(onSnapshot(refs.tasks,s=>{tasks=s.docs.map(d=>({id:d.id,...d.data()}));render();$('syncStatus').textContent='已同步'}));
  if(isAdmin()){
    unsubs.push(onSnapshot(refs.members,s=>{members=s.docs.map(d=>({id:d.id,...d.data()}));renderMembers()}));
    unsubs.push(onSnapshot(refs.invites,s=>{invites=s.docs.map(d=>({id:d.id,...d.data()}));renderMembers()}));
    unsubs.push(onSnapshot(query(refs.audit,orderBy('createdAt','desc'),limit(100)),s=>{logs=s.docs.map(d=>({id:d.id,...d.data()}));renderAudit()}));
  }
}

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');$('view-'+b.dataset.view).classList.add('active');
});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());

function render(){
  $('statPeople').textContent=people.length;
  $('statOpenCases').textContent=cases.filter(x=>x.status!=='已完成').length;
  $('statDueTasks').textContent=tasks.filter(x=>!x.done&&x.dueDate&&x.dueDate<=today()).length;
  $('statDoneRate').textContent=cases.length?Math.round(cases.filter(x=>x.status==='已完成').length/cases.length*100)+'%':'0%';

  const due=tasks.filter(x=>!x.done&&x.dueDate&&x.dueDate<=today()).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  $('dashboardTasks').innerHTML=due.map(x=>mini(x.title,`${x.dueDate}｜${x.owner||'未指定'}`,x.priority)).join('')||'<p class="muted">今天沒有到期追蹤</p>';
  $('dashboardCases').innerHTML=cases.slice().sort((a,b)=>(b.updatedAt?.seconds||0)-(a.updatedAt?.seconds||0)).slice(0,6).map(x=>mini(x.title,`${pname(x.personId)}｜${x.assignee||'未指定'}`,x.status)).join('')||'<p class="muted">尚無案件</p>';

  const pq=$('peopleSearch').value.toLowerCase();
  $('peopleList').innerHTML=people.filter(x=>[x.name,x.phone,x.village,x.address].join(' ').toLowerCase().includes(pq)).map(x=>`
    <article class="card"><div><h3>${esc(x.name)}</h3><div class="muted">${esc([x.village,x.phone,x.address].filter(Boolean).join('｜'))}</div></div>
    ${canEdit()?`<button class="btn" onclick="openPerson('${x.id}')">編輯</button>`:''}</article>`).join('')||'<div class="panel muted">尚無民眾資料</div>';

  const cq=$('caseSearch').value.toLowerCase(),sf=$('caseStatusFilter').value;
  $('caseList').innerHTML=cases.filter(x=>[x.title,x.description,pname(x.personId)].join(' ').toLowerCase().includes(cq)&&(!sf||x.status===sf)).map(x=>`
    <article class="card"><div><h3>${esc(x.title)}</h3><div class="muted">${esc(pname(x.personId))}｜${esc(x.category)}｜承辦：${esc(x.assignee||'未指定')}</div><span class="badge">${esc(x.status)}</span></div>
    ${canEdit()?`<button class="btn" onclick="openCase('${x.id}')">編輯</button>`:''}</article>`).join('')||'<div class="panel muted">尚無案件</div>';

  const tq=$('taskSearch').value.toLowerCase(),tf=$('taskStateFilter').value;
  $('taskList').innerHTML=tasks.filter(x=>[x.title,x.owner].join(' ').toLowerCase().includes(tq)&&(
    !tf||(tf==='open'&&!x.done)||(tf==='done'&&x.done)||(tf==='due'&&!x.done&&x.dueDate&&x.dueDate<=today())
  )).map(x=>`
    <article class="card"><div><h3>${x.done?'✅ ':''}${esc(x.title)}</h3><div class="muted">${esc(x.owner||'未指定')}｜${esc(x.dueDate||'未設定')}｜${esc(ctitle(x.caseId))}</div></div>
    ${canEdit()?`<button class="btn" onclick="openTask('${x.id}')">編輯</button>`:''}</article>`).join('')||'<div class="panel muted">尚無追蹤任務</div>';

  $('casePersonId').innerHTML='<option value="">未指定</option>'+people.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
  $('taskCaseId').innerHTML='<option value="">未指定</option>'+cases.map(x=>`<option value="${x.id}">${esc(x.title)}</option>`).join('');
}
function mini(title,meta,badge){return `<article class="card"><div><h3>${esc(title)}</h3><div class="muted">${esc(meta)}</div></div><span class="badge">${esc(badge||'')}</span></article>`}

function renderMembers(){
  $('memberList').innerHTML=members.map(x=>`
    <article class="card"><div><h3>${esc(x.displayName||x.email)}</h3><div class="muted">${esc(x.email)}｜${esc(roles[x.role]||x.role)}｜${x.active?'啟用':'停用'}</div></div>
    <button class="btn" onclick="toggleMember('${x.id}',${!x.active})">${x.active?'停用':'啟用'}</button></article>`).join('')||'<p class="muted">尚無成員</p>';

  $('inviteList').innerHTML=invites.map(x=>`
    <article class="card"><div><h3>${esc(x.id)}</h3><div class="muted">${esc(roles[x.role]||x.role)}</div></div>
    <button class="btn danger" onclick="deleteInvite('${x.id}')">取消邀請</button></article>`).join('')||'<p class="muted">沒有等待領取的邀請</p>';
}
function renderAudit(){
  $('auditList').innerHTML=logs.map(x=>`
    <article class="card"><div><h3>${esc(x.action)}｜${esc(x.entityType)}</h3>
    <div class="muted">${esc(x.summary||'')}<br>${esc(x.actorEmail||'')}｜${x.createdAt?.toDate?.().toLocaleString('zh-TW')||'同步中'}</div></div></article>`).join('')||'<p class="muted">尚無紀錄</p>';
}

async function audit(action,entityType,entityId,summary){
  await addDoc(refs.audit,{action,entityType,entityId,summary,actorUid:user.uid,actorEmail:user.email||'',actorName:user.displayName||'',createdAt:serverTimestamp()});
}

window.openPerson=id=>{if(!canEdit())return;$('personForm').reset();$('personId').value='';$('deletePersonBtn').classList.toggle('hidden',!id);if(id){const x=people.find(y=>y.id===id);$('personId').value=id;$('personName').value=x.name||'';$('personPhone').value=x.phone||'';$('personVillage').value=x.village||'';$('personPref').value=x.contactPref||'';$('personAddress').value=x.address||'';$('personNotes').value=x.notes||'';$('personConsent').checked=!!x.consent}$('personDialog').showModal()};
window.openCase=id=>{if(!canEdit())return;$('caseForm').reset();$('caseId').value='';$('deleteCaseBtn').classList.toggle('hidden',!id);if(id){const x=cases.find(y=>y.id===id);$('caseId').value=id;$('caseTitle').value=x.title||'';$('casePersonId').value=x.personId||'';$('caseCategory').value=x.category||'其他';$('caseStatus').value=x.status||'待處理';$('caseAssignee').value=x.assignee||'';$('caseFollowupDate').value=x.followupDate||'';$('casePriority').value=x.priority||'普通';$('caseDescription').value=x.description||'';$('caseResolution').value=x.resolution||''}$('caseDialog').showModal()};
window.openTask=id=>{if(!canEdit())return;$('taskForm').reset();$('taskId').value='';$('deleteTaskBtn').classList.toggle('hidden',!id);if(id){const x=tasks.find(y=>y.id===id);$('taskId').value=id;$('taskTitle').value=x.title||'';$('taskDueDate').value=x.dueDate||'';$('taskPriority').value=x.priority||'普通';$('taskCaseId').value=x.caseId||'';$('taskOwner').value=x.owner||'';$('taskDone').checked=!!x.done}$('taskDialog').showModal()};

$('addPersonBtn').onclick=()=>openPerson('');
$('addCaseBtn').onclick=()=>openCase('');
$('addTaskBtn').onclick=()=>openTask('');
['peopleSearch','caseSearch','taskSearch'].forEach(id=>$(id).oninput=render);
['caseStatusFilter','taskStateFilter'].forEach(id=>$(id).onchange=render);

$('personForm').onsubmit=async e=>{e.preventDefault();const id=$('personId').value,d={name:$('personName').value.trim(),phone:$('personPhone').value.trim(),village:$('personVillage').value.trim(),contactPref:$('personPref').value,address:$('personAddress').value.trim(),notes:$('personNotes').value.trim(),consent:$('personConsent').checked,updatedAt:serverTimestamp(),updatedBy:user.uid};if(id){await setDoc(doc(refs.people,id),d,{merge:true});await audit('修改','民眾',id,d.name)}else{const r=await addDoc(refs.people,{...d,createdAt:serverTimestamp(),createdBy:user.uid});await audit('新增','民眾',r.id,d.name)}$('personDialog').close()};
$('caseForm').onsubmit=async e=>{e.preventDefault();const id=$('caseId').value,d={title:$('caseTitle').value.trim(),personId:$('casePersonId').value,category:$('caseCategory').value,status:$('caseStatus').value,assignee:$('caseAssignee').value.trim(),followupDate:$('caseFollowupDate').value,priority:$('casePriority').value,description:$('caseDescription').value.trim(),resolution:$('caseResolution').value.trim(),updatedAt:serverTimestamp(),updatedBy:user.uid};if(id){await setDoc(doc(refs.cases,id),d,{merge:true});await audit('修改','案件',id,d.title)}else{const r=await addDoc(refs.cases,{...d,createdAt:serverTimestamp(),createdBy:user.uid});await audit('新增','案件',r.id,d.title)}$('caseDialog').close()};
$('taskForm').onsubmit=async e=>{e.preventDefault();const id=$('taskId').value,d={title:$('taskTitle').value.trim(),dueDate:$('taskDueDate').value,priority:$('taskPriority').value,caseId:$('taskCaseId').value,owner:$('taskOwner').value.trim(),done:$('taskDone').checked,updatedAt:serverTimestamp(),updatedBy:user.uid};if(id){await setDoc(doc(refs.tasks,id),d,{merge:true});await audit('修改','追蹤',id,d.title)}else{const r=await addDoc(refs.tasks,{...d,createdAt:serverTimestamp(),createdBy:user.uid});await audit('新增','追蹤',r.id,d.title)}$('taskDialog').close()};

$('deletePersonBtn').onclick=async()=>{const id=$('personId').value,x=people.find(y=>y.id===id);if(confirm('確定刪除？')){await deleteDoc(doc(refs.people,id));await audit('刪除','民眾',id,x?.name||'');$('personDialog').close()}};
$('deleteCaseBtn').onclick=async()=>{const id=$('caseId').value,x=cases.find(y=>y.id===id);if(confirm('確定刪除？')){await deleteDoc(doc(refs.cases,id));await audit('刪除','案件',id,x?.title||'');$('caseDialog').close()}};
$('deleteTaskBtn').onclick=async()=>{const id=$('taskId').value,x=tasks.find(y=>y.id===id);if(confirm('確定刪除？')){await deleteDoc(doc(refs.tasks,id));await audit('刪除','追蹤',id,x?.title||'');$('taskDialog').close()}};

$('inviteBtn').onclick=async()=>{
  if(!isAdmin())return;
  const email=$('inviteEmail').value.trim().toLowerCase(),role=$('inviteRole').value;
  if(!email){alert('請輸入 Email');return}
  await setDoc(doc(refs.invites,email),{email,role,active:true,invitedBy:user.uid,invitedAt:serverTimestamp()});
  await audit('邀請','成員',email,`${email}｜${roles[role]}`);
  $('inviteEmail').value='';
};
window.deleteInvite=async email=>{if(confirm('取消這個邀請？')){await deleteDoc(doc(refs.invites,email));await audit('取消邀請','成員',email,email)}};
window.toggleMember=async(id,active)=>{await setDoc(doc(refs.members,id),{active,updatedAt:serverTimestamp(),updatedBy:user.uid},{merge:true});await audit(active?'啟用':'停用','成員',id,id)};

$('exportBtn').onclick=()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify({people,cases,tasks,members,invites,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}));
  a.download=`服務處CRM_V5備份_${today()}.json`;a.click()
};
