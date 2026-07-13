const KEY='service_office_crm_v2';
const today=()=>new Date().toISOString().slice(0,10);
const now=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const $=id=>document.getElementById(id);
let db=load();

function defaultDB(){return{people:[],cases:[],tasks:[],meta:{version:2}}}
function load(){try{return JSON.parse(localStorage.getItem(KEY))||defaultDB()}catch{return defaultDB()}}
function save(){localStorage.setItem(KEY,JSON.stringify(db))}
function personName(id){return db.people.find(p=>p.id===id)?.name||'未指定'}
function caseTitle(id){return db.cases.find(c=>c.id===id)?.title||'未指定'}
function formatDate(d){return d||'未設定'}
function badgeClass(s){return s==='已完成'?'green':s==='處理中'?'blue':s==='待回覆'?'orange':s==='緊急'?'red':''}
function escapeHTML(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

const viewInfo={
 dashboard:['儀表板','今天的服務案件與追蹤重點'],
 people:['選民資料','管理聯絡方式、里別與服務備註'],
 cases:['服務案件','追蹤案件狀態、承辦人與處理紀錄'],
 tasks:['追蹤任務','管理回電、會勘與重要提醒'],
 reports:['統計報表','查看案件分布與服務量'],
 settings:['設定與備份','資料匯出、匯入與安全設定']
};

document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  const v=btn.dataset.view;
  $('view-'+v).classList.add('active');
  $('pageTitle').textContent=viewInfo[v][0];
  $('pageSubtitle').textContent=viewInfo[v][1];
  renderAll();
}));

function renderAll(){
  renderSelects();
  renderDashboard();
  renderPeople();
  renderCases();
  renderTasks();
  renderReports();
}

function renderSelects(){
  const villages=[...new Set(db.people.map(p=>p.village).filter(Boolean))].sort();
  const categories=[...new Set(db.cases.map(c=>c.category).filter(Boolean))].sort();
  const pv=$('peopleVillageFilter').value, cc=$('caseCategoryFilter').value;
  $('peopleVillageFilter').innerHTML='<option value="">全部里別</option>'+villages.map(v=>`<option>${escapeHTML(v)}</option>`).join('');
  $('caseCategoryFilter').innerHTML='<option value="">全部類別</option>'+categories.map(v=>`<option>${escapeHTML(v)}</option>`).join('');
  if(villages.includes(pv))$('peopleVillageFilter').value=pv;
  if(categories.includes(cc))$('caseCategoryFilter').value=cc;

  $('casePersonId').innerHTML='<option value="">未指定</option>'+db.people.sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant')).map(p=>`<option value="${p.id}">${escapeHTML(p.name)}${p.village?'｜'+escapeHTML(p.village):''}</option>`).join('');
  $('taskCaseId').innerHTML='<option value="">未指定</option>'+db.cases.map(c=>`<option value="${c.id}">${escapeHTML(c.title)}</option>`).join('');
}

function renderDashboard(){
  $('statPeople').textContent=db.people.length;
  const open=db.cases.filter(c=>c.status!=='已完成').length;
  $('statOpenCases').textContent=open;
  const due=db.tasks.filter(t=>!t.done&&t.dueDate&&t.dueDate<=today()).length;
  $('statDueTasks').textContent=due;
  $('statDoneRate').textContent=db.cases.length?Math.round(db.cases.filter(c=>c.status==='已完成').length/db.cases.length*100)+'%':'0%';

  const tasks=db.tasks.filter(t=>!t.done).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')).slice(0,5);
  $('dashboardTasks').innerHTML=tasks.length?tasks.map(t=>`<div class="mini-card"><div><strong>${escapeHTML(t.title)}</strong><span class="muted">${formatDate(t.dueDate)}｜${escapeHTML(t.owner||'未指定')}</span></div><span class="badge ${t.dueDate&&t.dueDate<=today()?'red':badgeClass(t.priority)}">${escapeHTML(t.priority||'普通')}</span></div>`).join(''):'<div class="muted">目前沒有待追蹤事項</div>';

  const cases=[...db.cases].sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,5);
  $('dashboardCases').innerHTML=cases.length?cases.map(c=>`<div class="mini-card"><div><strong>${escapeHTML(c.title)}</strong><span class="muted">${escapeHTML(personName(c.personId))}｜${escapeHTML(c.assignee||'未指定')}</span></div><span class="badge ${badgeClass(c.status)}">${escapeHTML(c.status)}</span></div>`).join(''):'<div class="muted">目前沒有案件</div>';

  const counts={};
  db.cases.forEach(c=>{const p=db.people.find(x=>x.id===c.personId);const v=p?.village||'未指定';counts[v]=(counts[v]||0)+1});
  renderBars('villageBars',counts);
}

function renderPeople(){
  const q=$('peopleSearch').value.trim().toLowerCase();
  const vf=$('peopleVillageFilter').value;
  const list=db.people.filter(p=>[p.name,p.phone,p.village,p.address,p.notes].join(' ').toLowerCase().includes(q)&&(!vf||p.village===vf))
    .sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
  $('peopleList').innerHTML=list.map(p=>{
    const count=db.cases.filter(c=>c.personId===p.id).length;
    return `<article class="data-card"><div><h3>${escapeHTML(p.name)}</h3><div class="muted">${escapeHTML([p.village,p.phone,p.address].filter(Boolean).join('｜')||'尚未填寫聯絡資訊')}</div><div class="meta"><span class="badge">${count} 件案件</span>${p.contactPref?`<span class="badge blue">${escapeHTML(p.contactPref)}</span>`:''}${p.consent?'<span class="badge green">已同意聯絡</span>':'<span class="badge orange">未確認同意</span>'}</div></div><div class="actions"><button class="btn secondary" onclick="openPerson('${p.id}')">查看／編輯</button><button class="btn primary" onclick="openCase('', '${p.id}')">新增案件</button></div></article>`
  }).join('');
  $('peopleEmpty').classList.toggle('hidden',list.length>0);
}

function renderCases(){
  const q=$('caseSearch').value.trim().toLowerCase(), sf=$('caseStatusFilter').value, cf=$('caseCategoryFilter').value;
  const list=db.cases.filter(c=>[c.title,c.description,c.resolution,personName(c.personId)].join(' ').toLowerCase().includes(q)&&(!sf||c.status===sf)&&(!cf||c.category===cf))
    .sort((a,b)=>(a.status==='已完成')-(b.status==='已完成')||(a.followupDate||'9999').localeCompare(b.followupDate||'9999'));
  $('caseList').innerHTML=list.map(c=>`<article class="data-card"><div><h3>${escapeHTML(c.title)}</h3><div class="muted">${escapeHTML(personName(c.personId))}｜${escapeHTML(c.category)}｜承辦：${escapeHTML(c.assignee||'未指定')}</div><div class="meta"><span class="badge ${badgeClass(c.status)}">${escapeHTML(c.status)}</span><span class="badge">追蹤：${formatDate(c.followupDate)}</span></div>${c.description?`<p>${escapeHTML(c.description)}</p>`:''}</div><div class="actions"><button class="btn secondary" onclick="openCase('${c.id}')">查看／編輯</button><button class="btn primary" onclick="openTask('', '${c.id}')">新增追蹤</button></div></article>`).join('');
  $('caseEmpty').classList.toggle('hidden',list.length>0);
}

function renderTasks(){
  const q=$('taskSearch').value.trim().toLowerCase(), f=$('taskFilter').value;
  const list=db.tasks.filter(t=>t.title.toLowerCase().includes(q)&&(
    !f||(f==='open'&&!t.done)||(f==='done'&&t.done)||(f==='due'&&!t.done&&t.dueDate&&t.dueDate<=today())
  )).sort((a,b)=>Number(a.done)-Number(b.done)||(a.dueDate||'9999').localeCompare(b.dueDate||'9999'));
  $('taskList').innerHTML=list.map(t=>`<article class="data-card"><div><h3>${t.done?'✅ ':''}${escapeHTML(t.title)}</h3><div class="muted">到期：${formatDate(t.dueDate)}｜負責：${escapeHTML(t.owner||'未指定')}｜案件：${escapeHTML(caseTitle(t.caseId))}</div><div class="meta"><span class="badge ${t.done?'green':(t.dueDate&&t.dueDate<=today()?'red':badgeClass(t.priority))}">${t.done?'已完成':escapeHTML(t.priority||'普通')}</span></div></div><div class="actions"><button class="btn secondary" onclick="openTask('${t.id}')">查看／編輯</button></div></article>`).join('');
  $('taskEmpty').classList.toggle('hidden',list.length>0);
}

function renderBars(id,counts){
  const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const max=Math.max(1,...entries.map(x=>x[1]));
  $(id).innerHTML=entries.length?entries.map(([k,v])=>`<div class="bar-row"><span>${escapeHTML(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%"></div></div><strong>${v}</strong></div>`).join(''):'<div class="muted">尚無資料</div>';
}

function renderReports(){
  const status={},category={},assignee={};
  db.cases.forEach(c=>{status[c.status]=(status[c.status]||0)+1;category[c.category]=(category[c.category]||0)+1;const a=c.assignee||'未指定';assignee[a]=(assignee[a]||0)+1});
  renderBars('statusReport',status);renderBars('categoryReport',category);renderBars('assigneeReport',assignee);
  const month=today().slice(0,7);
  $('monthAdded').textContent=db.cases.filter(c=>(c.createdDate||'').startsWith(month)).length;
}

window.openPerson=function(id=''){
  $('personForm').reset();$('personId').value='';
  $('personDialogTitle').textContent=id?'編輯民眾':'新增民眾';
  $('deletePersonBtn').classList.toggle('hidden',!id);
  if(id){const p=db.people.find(x=>x.id===id);if(!p)return;$('personId').value=p.id;$('personName').value=p.name||'';$('personPhone').value=p.phone||'';$('personVillage').value=p.village||'';$('personContactPref').value=p.contactPref||'';$('personAddress').value=p.address||'';$('personLine').value=p.line||'';$('personEmail').value=p.email||'';$('personNotes').value=p.notes||'';$('personConsent').checked=!!p.consent}
  $('personDialog').showModal();
}
window.openCase=function(id='',personId=''){
  $('caseForm').reset();$('caseId').value='';$('caseCreatedDate').value=today();
  $('caseDialogTitle').textContent=id?'編輯案件':'新增案件';$('deleteCaseBtn').classList.toggle('hidden',!id);
  if(id){const c=db.cases.find(x=>x.id===id);if(!c)return;$('caseId').value=c.id;$('caseTitle').value=c.title||'';$('casePersonId').value=c.personId||'';$('caseCategory').value=c.category||'其他';$('caseStatus').value=c.status||'待處理';$('caseAssignee').value=c.assignee||'';$('caseCreatedDate').value=c.createdDate||today();$('caseFollowupDate').value=c.followupDate||'';$('caseDescription').value=c.description||'';$('caseResolution').value=c.resolution||''}
  else if(personId)$('casePersonId').value=personId;
  $('caseDialog').showModal();
}
window.openTask=function(id='',caseId=''){
  $('taskForm').reset();$('taskId').value='';$('taskDialogTitle').textContent=id?'編輯追蹤':'新增追蹤';$('deleteTaskBtn').classList.toggle('hidden',!id);
  if(id){const t=db.tasks.find(x=>x.id===id);if(!t)return;$('taskId').value=t.id;$('taskTitle').value=t.title||'';$('taskDueDate').value=t.dueDate||'';$('taskPriority').value=t.priority||'普通';$('taskCaseId').value=t.caseId||'';$('taskOwner').value=t.owner||'';$('taskDone').checked=!!t.done}
  else if(caseId)$('taskCaseId').value=caseId;
  $('taskDialog').showModal();
}

$('personForm').addEventListener('submit',e=>{e.preventDefault();const id=$('personId').value,old=db.people.find(p=>p.id===id);const p={id:id||uid(),name:$('personName').value.trim(),phone:$('personPhone').value.trim(),village:$('personVillage').value.trim(),contactPref:$('personContactPref').value,address:$('personAddress').value.trim(),line:$('personLine').value.trim(),email:$('personEmail').value.trim(),notes:$('personNotes').value.trim(),consent:$('personConsent').checked,createdAt:old?.createdAt||now(),updatedAt:now()};db.people=id?db.people.map(x=>x.id===id?p:x):[...db.people,p];save();$('personDialog').close();renderAll()});
$('caseForm').addEventListener('submit',e=>{e.preventDefault();const id=$('caseId').value,old=db.cases.find(c=>c.id===id);const c={id:id||uid(),title:$('caseTitle').value.trim(),personId:$('casePersonId').value,category:$('caseCategory').value,status:$('caseStatus').value,assignee:$('caseAssignee').value.trim(),createdDate:$('caseCreatedDate').value||today(),followupDate:$('caseFollowupDate').value,description:$('caseDescription').value.trim(),resolution:$('caseResolution').value.trim(),createdAt:old?.createdAt||now(),updatedAt:now()};db.cases=id?db.cases.map(x=>x.id===id?c:x):[...db.cases,c];save();$('caseDialog').close();renderAll()});
$('taskForm').addEventListener('submit',e=>{e.preventDefault();const id=$('taskId').value,old=db.tasks.find(t=>t.id===id);const t={id:id||uid(),title:$('taskTitle').value.trim(),dueDate:$('taskDueDate').value,priority:$('taskPriority').value,caseId:$('taskCaseId').value,owner:$('taskOwner').value.trim(),done:$('taskDone').checked,createdAt:old?.createdAt||now(),updatedAt:now()};db.tasks=id?db.tasks.map(x=>x.id===id?t:x):[...db.tasks,t];save();$('taskDialog').close();renderAll()});

$('deletePersonBtn').addEventListener('click',()=>{const id=$('personId').value;if(confirm('刪除後，關聯案件仍會保留但不再顯示姓名。確定刪除？')){db.people=db.people.filter(p=>p.id!==id);save();$('personDialog').close();renderAll()}});
$('deleteCaseBtn').addEventListener('click',()=>{const id=$('caseId').value;if(confirm('確定刪除此案件？')){db.cases=db.cases.filter(c=>c.id!==id);db.tasks=db.tasks.map(t=>t.caseId===id?{...t,caseId:''}:t);save();$('caseDialog').close();renderAll()}});
$('deleteTaskBtn').addEventListener('click',()=>{const id=$('taskId').value;if(confirm('確定刪除此追蹤？')){db.tasks=db.tasks.filter(t=>t.id!==id);save();$('taskDialog').close();renderAll()}});

document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
['quickAddPerson','addPersonBtn'].forEach(id=>$(id).addEventListener('click',()=>openPerson()));
['quickAddCase','addCaseBtn'].forEach(id=>$(id).addEventListener('click',()=>openCase()));
$('addTaskBtn').addEventListener('click',()=>openTask());
['peopleSearch','caseSearch','taskSearch'].forEach(id=>$(id).addEventListener('input',renderAll));
['peopleVillageFilter','caseStatusFilter','caseCategoryFilter','taskFilter'].forEach(id=>$(id).addEventListener('change',renderAll));

function download(name,text,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
$('exportJsonBtn').addEventListener('click',()=>download(`服務處CRM備份_${today()}.json`,JSON.stringify(db,null,2)));
$('importJsonInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const obj=JSON.parse(await f.text());if(!obj.people||!obj.cases||!obj.tasks)throw new Error();if(confirm('匯入會覆蓋目前資料，確定繼續？')){db=obj;save();renderAll();alert('匯入完成')}}catch{alert('備份檔格式不正確')}e.target.value=''});
function csv(rows,headers){const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;return '\ufeff'+[headers.map(h=>q(h[0])).join(','),...rows.map(r=>headers.map(h=>q(typeof h[1]==='function'?h[1](r):r[h[1]])).join(','))].join('\n')}
$('exportPeopleCsv').addEventListener('click',()=>download(`民眾資料_${today()}.csv`,csv(db.people,[['姓名','name'],['電話','phone'],['里別','village'],['地址','address'],['LINE','line'],['Email','email'],['聯絡偏好','contactPref'],['同意聯絡',r=>r.consent?'是':'否'],['備註','notes']]),'text/csv;charset=utf-8'));
$('exportCasesCsv').addEventListener('click',()=>download(`案件資料_${today()}.csv`,csv(db.cases,[['案件標題','title'],['民眾姓名',r=>personName(r.personId)],['類別','category'],['狀態','status'],['承辦人','assignee'],['建立日期','createdDate'],['追蹤日期','followupDate'],['案件內容','description'],['處理紀錄','resolution']]),'text/csv;charset=utf-8'));

$('loadDemoBtn').addEventListener('click',()=>{if(db.people.length&&!confirm('目前已有資料，仍要加入示範資料？'))return;const p1=uid(),p2=uid(),c1=uid(),c2=uid();db.people.push({id:p1,name:'王小明',phone:'0912-345-678',village:'明德里',address:'中和區示範路1號',contactPref:'電話',line:'',email:'',notes:'',consent:true,createdAt:now(),updatedAt:now()},{id:p2,name:'陳美華',phone:'0988-111-222',village:'景新里',address:'中和區範例街8號',contactPref:'LINE',line:'',email:'',notes:'長者福利案件',consent:true,createdAt:now(),updatedAt:now()});db.cases.push({id:c1,title:'巷口路燈故障',personId:p1,category:'道路交通',status:'處理中',assignee:'智翔',createdDate:today(),followupDate:today(),description:'反映巷口路燈夜間不亮。',resolution:'已轉請相關單位查處。',createdAt:now(),updatedAt:now()},{id:c2,title:'長者補助申請諮詢',personId:p2,category:'社會福利',status:'待回覆',assignee:'小林',createdDate:today(),followupDate:'',description:'詢問長者社福補助申請方式。',resolution:'待確認應備文件。',createdAt:now(),updatedAt:now()});db.tasks.push({id:uid(),title:'回電確認路燈修復進度',dueDate:today(),priority:'重要',caseId:c1,owner:'智翔',done:false,createdAt:now(),updatedAt:now()});save();renderAll()});
$('clearAllBtn').addEventListener('click',()=>{if(confirm('確定清空全部資料？此動作無法復原。')){db=defaultDB();save();renderAll()}});

if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
renderAll();
