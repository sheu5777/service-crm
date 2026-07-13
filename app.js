import {firebaseConfig,WORKSPACE_ID,BOOTSTRAP_ADMIN_EMAIL} from './firebase-config.js?v=7.1.1';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,signOut,onAuthStateChanged,setPersistence,browserLocalPersistence} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getFirestore,collection,doc,addDoc,setDoc,deleteDoc,getDoc,onSnapshot,serverTimestamp,query,orderBy,limit,writeBatch} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $=id=>document.getElementById(id);
const today=()=>new Date().toISOString().slice(0,10);
const caseNo=()=>`C-${today().replaceAll('-','')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const csvQuote=v=>`"${String(v??'').replace(/"/g,'""')}"`;
const download=(name,text,type='application/json')=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fb=initializeApp(firebaseConfig),auth=getAuth(fb),db=getFirestore(fb),provider=new GoogleAuthProvider();
setPersistence(auth,browserLocalPersistence).catch(e=>console.warn('persistence',e));
const c=name=>collection(db,'workspaces',WORKSPACE_ID,name);
const refs={people:c('people'),cases:c('cases'),tasks:c('tasks'),members:c('members'),invites:c('invites'),audit:c('auditLogs')};
let user=null,member=null,people=[],cases=[],tasks=[],members=[],invites=[],logs=[],unsubs=[];

const roles={admin:'管理員',director:'主任',assistant:'助理',volunteer:'志工'};
const canEdit=()=>['admin','director','assistant'].includes(member?.role);
const isAdmin=()=>member?.role==='admin';
const pname=id=>people.find(x=>x.id===id)?.name||'未指定';
const ctitle=id=>cases.find(x=>x.id===id)?.title||'未指定';

$('loginBtn').onclick=async()=>{
  const btn=$('loginBtn');
  btn.disabled=true;btn.textContent='登入處理中…';$('loginMessage').textContent='';
  try{
    const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
    if(isiOS){
      await signInWithRedirect(auth,provider);
      return;
    }
    await signInWithPopup(auth,provider);
  }catch(e){
    console.error(e);
    $('loginMessage').textContent=`登入失敗：${e.code||''}
${e.message||''}`;
    btn.disabled=false;btn.textContent='使用 Google 帳號登入';
  }
};
window.deleteInvite=async email=>{if(confirm('取消這個邀請？')){await deleteDoc(doc(refs.invites,email));await audit('取消邀請','成員',email,email)}};
window.toggleMember=async(id,active)=>{await setDoc(doc(refs.members,id),{active,updatedAt:serverTimestamp(),updatedBy:user.uid},{merge:true});await audit(active?'啟用':'停用','成員',id,id)};


$('exportPeopleCsv').onclick=()=>{
  const headers=[['姓名','name'],['主要電話','phone'],['備用電話','phone2'],['里別','village'],['鄰別','neighborhood'],['生日','birthday'],['LINE','line'],['Email','email'],['地址','address'],['聯絡偏好','contactPref'],['標籤','tags'],['同意聯絡',x=>x.consent?'是':'否'],['備註','notes']];
  const text='\ufeff'+[headers.map(h=>csvQuote(h[0])).join(','),...people.map(x=>headers.map(h=>csvQuote(typeof h[1]==='function'?h[1](x):x[h[1]])).join(','))].join('\n');
  download(`民眾資料_${today()}.csv`,text,'text/csv;charset=utf-8');
};
$('exportCasesCsv').onclick=()=>{
  const headers=[['案件編號','caseNumber'],['建立日期','createdDate'],['案件標題','title'],['民眾姓名',x=>pname(x.personId)],['類別','category'],['狀態','status'],['優先級','priority'],['承辦人','assignee'],['追蹤日期','followupDate'],['結案日期','closedDate'],['案件內容','description'],['處理紀錄','resolution']];
  const text='\ufeff'+[headers.map(h=>csvQuote(h[0])).join(','),...cases.map(x=>headers.map(h=>csvQuote(typeof h[1]==='function'?h[1](x):x[h[1]])).join(','))].join('\n');
  download(`案件資料_${today()}.csv`,text,'text/csv;charset=utf-8');
};

$('exportBtn').onclick=()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify({people,cases,tasks,members,invites,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}));
  a.download=`服務處CRM_V5備份_${today()}.json`;a.click()
};
