'use strict';
const STORAGE_KEY='studysync-data-v1';
const DEFAULT_STORAGE_KEY=STORAGE_KEY;
let supabaseClient=null, currentUser=null, cloudSaveTimer=null, loadingCloud=false;
const COLORS=['#7774e8','#25a887','#e5a444','#e47d8c','#4b9cdb','#8c6ccf','#bd7b43'];
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const seed={
 subjects:[{id:'math',name:'Mathematics',color:COLORS[0]},{id:'prog',name:'Programming',color:COLORS[1]},{id:'mmw',name:'MMW',color:COLORS[2]},{id:'web',name:'Web Development',color:COLORS[3]}],
 tasks:[
 {id:'t1',title:'Quadratic equations practice',subjectId:'math',type:'Assignment',due:'2026-10-26',priority:'High',done:false,hours:2},
 {id:'t2',title:'Build responsive page',subjectId:'web',type:'Project',due:'2026-10-28',priority:'High',done:false,hours:3},
 {id:'t3',title:'MMW concept review',subjectId:'mmw',type:'Review',due:'2026-10-29',priority:'Medium',done:true,hours:1},
 {id:'t4',title:'Java methods quiz prep',subjectId:'prog',type:'Quiz',due:'2026-10-30',priority:'Medium',done:false,hours:1.5}],
 grades:[{subjectId:'math',items:[{id:'g1',name:'Quizzes',score:88,weight:30},{id:'g2',name:'Activities',score:92,weight:30},{id:'g3',name:'Exam',score:84,weight:40}]},{subjectId:'prog',items:[{id:'g4',name:'Laboratory',score:94,weight:40},{id:'g5',name:'Quizzes',score:86,weight:20},{id:'g6',name:'Project',score:91,weight:40}]}],
 sessions:[{id:'s1',subjectId:'math',day:'Mon',hours:2},{id:'s2',subjectId:'prog',day:'Tue',hours:2},{id:'s3',subjectId:'mmw',day:'Wed',hours:1.5},{id:'s4',subjectId:'web',day:'Thu',hours:2},{id:'s5',subjectId:'math',day:'Fri',hours:1.5},{id:'s6',subjectId:'prog',day:'Sat',hours:2}],weeklyGoal:12};
let data=loadData(),page='Dashboard',taskSearch='',gradeSubject='math';
function activeStorageKey(){return currentUser ? `${DEFAULT_STORAGE_KEY}:${currentUser.id}` : DEFAULT_STORAGE_KEY}
function loadData(){try{const s=localStorage.getItem(activeStorageKey());if(s){const d=JSON.parse(s);if(d&&Array.isArray(d.subjects)&&Array.isArray(d.tasks)&&Array.isArray(d.grades)&&Array.isArray(d.sessions))return d}}catch(e){}return structuredClone(seed)}
function save(){
  try { localStorage.setItem(activeStorageKey(),JSON.stringify(data)); } catch(e) { console.warn('Local save failed',e); }
  if(currentUser && supabaseClient && !loadingCloud){
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer=setTimeout(async()=>{
      const {error}=await supabaseClient.from('user_data').upsert({user_id:currentUser.id,payload:data,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      if(error) notify('Saved on this device, but cloud sync failed. Check setup.');
    },350);
  }
}
function id(){return 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function subject(id){return data.subjects.find(s=>s.id===id)||{name:'Unknown subject',color:'#aaa'}}
function dateLabel(s){if(!s)return 'No date';const d=new Date(s+'T12:00:00');return isNaN(d)?'No date':d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}
function notify(s){const el=document.getElementById('toast');el.textContent=s;el.classList.remove('hidden');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.classList.add('hidden'),2500)}
function weighted(items){const w=items.reduce((a,x)=>a+Number(x.weight||0),0);if(!items.length||Math.abs(w-100)>.0001)return {grade:null,weight:w};return {grade:items.reduce((a,x)=>a+Number(x.score||0)*Number(x.weight||0)/100,0),weight:w}}
function completeStats(){let done=data.tasks.filter(t=>t.done).length;return {done,pending:data.tasks.length-done,rate:data.tasks.length?Math.round(done/data.tasks.length*100):0}}
function setPage(p){page=p;document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===p));render()}
document.getElementById('nav').addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(b)setPage(b.dataset.page)});
document.getElementById('today').textContent=new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
document.getElementById('welcome').textContent=(new Date().getHours()<12?'Good morning':new Date().getHours()<18?'Good afternoon':'Good evening')+'! 👋';
function intro(title,desc,action=''){return `<div class="page-intro"><div><h2>${title}</h2><p>${desc}</p></div>${action}</div>`}
function btn(label,action,primary=true){return `<button class="btn ${primary?'primary':''}" data-action="${action}">${label}</button>`}
function stat(label,value,detail,icon){return `<div class="stat"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><strong>${value}</strong><small>${detail}</small></div>`}
function taskRow(t){const s=subject(t.subjectId);return `<div class="task-row"><input class="task-check" type="checkbox" data-toggle-task="${t.id}" ${t.done?'checked':''} aria-label="Mark ${esc(t.title)} complete"><div class="task-info"><strong style="${t.done?'text-decoration:line-through;color:#999':''}">${esc(t.title)}</strong><small>${esc(s.name)} · ${esc(t.type)}</small></div><span class="priority ${esc(t.priority)}">${esc(t.priority)}</span><span class="task-due">${dateLabel(t.due)}</span></div>`}
function dashboard(){const st=completeStats(),planned=data.sessions.reduce((a,s)=>a+Number(s.hours||0),0),up=[...data.tasks].filter(t=>!t.done).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,4);
return `${intro('Your overview','A clear view of your tasks, time, and academic progress.',btn('+ Add task','add-task'))}<div class="stats">${stat('Tasks completed',st.done,`${st.rate}% of all tasks`,'✓')}${stat('Pending tasks',st.pending,'Still to work on','☷')}${stat('Planned study hours',planned.toFixed(1),'Across the week','◷')}${stat('Weekly study goal',data.weeklyGoal+' hrs',`${Math.round(planned/Math.max(1,data.weeklyGoal)*100)}% of goal`,'◎')}</div><div class="layout-two"><section class="card"><div class="card-head"><h3>Upcoming tasks</h3><button class="btn small" data-page="My Tasks">View all</button></div>${up.length?up.map(taskRow).join(''):'<div class="empty">No pending tasks. Add a task to get started.</div>'}</section><section class="card"><div class="card-head"><h3>Study time by subject</h3><span class="muted">Planned hours</span></div>${data.subjects.map(s=>{const h=data.sessions.filter(x=>x.subjectId===s.id).reduce((a,x)=>a+Number(x.hours||0),0),pct=planned?h/planned*100:0;return `<div class="subject-progress"><div class="rowline"><span><i class="subject-dot" style="background:${s.color}"></i>${esc(s.name)}</span><span>${h.toFixed(1)} h · ${Math.round(pct)}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${s.color}"></div></div></div>`}).join('')}</section></div><section class="card section-space"><div class="card-head"><h3>MMW concepts in this app</h3><span class="muted">Mathematics in the Modern World</span></div><div class="layout-two"><div><strong>Percentages & weighted averages</strong><p class="muted">Task completion rate and assessment grade calculations.</p></div><div><strong>Ratios & resource allocation</strong><p class="muted">Compare subject study hours and distribute limited time through the week.</p></div></div></section>`}
function taskForm(){return `<section class="card form-card" id="task-form"><div class="card-head"><h3>Add a task</h3><button class="btn small" data-action="cancel-task">Cancel</button></div><form id="new-task"><div class="field-grid"><label class="field full">Task title<input name="title" maxlength="100" required placeholder="e.g. Review chapter 3"></label><label class="field">Subject<select name="subjectId">${data.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><label class="field">Task type<select name="type"><option>Assignment</option><option>Project</option><option>Quiz</option><option>Exam</option><option>Review</option><option>Other</option></select></label><label class="field">Due date<input type="date" name="due"></label><label class="field">Priority<select name="priority"><option>Low</option><option selected>Medium</option><option>High</option></select></label><label class="field">Estimated hours<input type="number" name="hours" min=".25" max="100" step=".25" value="1" required></label></div><div class="form-actions"><button class="btn primary">Save task</button></div></form></section>`}
function tasksPage(){const list=data.tasks.filter(t=>(t.title+' '+subject(t.subjectId).name+' '+t.type).toLowerCase().includes(taskSearch.toLowerCase())).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));return `${intro('My Tasks','Create and manage assignments, projects, quizzes, and deadlines.',btn('+ Add task','add-task'))}<div id="task-form-holder"></div><div class="toolbar"><input id="task-search" placeholder="Search tasks or subjects..." value="${esc(taskSearch)}"><select id="task-filter"><option value="all">All tasks</option><option value="pending">Pending</option><option value="done">Completed</option></select></div><section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Status</th><th>Task</th><th>Subject</th><th>Due date</th><th>Priority</th><th>Hours</th><th>Action</th></tr></thead><tbody id="task-table">${list.map(t=>`<tr><td><input type="checkbox" class="task-check" data-toggle-task="${t.id}" ${t.done?'checked':''} aria-label="Complete task"></td><td class="${t.done?'done':''}">${esc(t.title)}<div class="muted">${esc(t.type)}</div></td><td>${esc(subject(t.subjectId).name)}</td><td>${dateLabel(t.due)}</td><td><span class="priority ${esc(t.priority)}">${esc(t.priority)}</span></td><td>${Number(t.hours).toFixed(1)}</td><td><button class="btn small danger" data-delete-task="${t.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="7"><div class="empty">No tasks match your search.</div></td></tr>'}</tbody></table></div></section>`}
function plannerPage(){const total=data.sessions.reduce((a,s)=>a+Number(s.hours||0),0),pct=Math.min(100,Math.round(total/Math.max(1,data.weeklyGoal)*100));return `${intro('Study Planner','Allocate weekly study hours and compare them with your goal.')}<section class="card"><div class="card-head"><div><h3>Weekly goal</h3><span class="muted">Set a realistic target for your study time.</span></div><label class="field">Hours per week<input id="weekly-goal" type="number" min="1" max="168" step="1" value="${data.weeklyGoal}"></label></div><div class="grade-result"><div><strong>${total.toFixed(1)} / ${data.weeklyGoal} hrs</strong><small>${pct}% of weekly goal reached</small></div><span class="muted">${Math.max(0,data.weeklyGoal-total).toFixed(1)} hrs remaining</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></section><section class="card section-space"><div class="card-head"><h3>Hours by day</h3><span class="muted">Edit sessions below</span></div><div class="days-grid">${DAYS.map(d=>{let h=data.sessions.filter(s=>s.day===d).reduce((a,s)=>a+Number(s.hours||0),0);return `<div class="day-card"><h4>${d}</h4><strong>${h.toFixed(1)}</strong><small>hours planned</small></div>`}).join('')}</div></section><section class="card section-space"><div class="card-head"><h3>Study sessions</h3>${btn('+ Add session','add-session')}</div><div id="session-form-holder"></div><div class="session-list">${data.sessions.map(s=>`<div class="session"><div><strong>${esc(subject(s.subjectId).name)}</strong><div class="muted">${s.day}</div></div><label class="muted">Hours<br><input type="number" min=".25" max="24" step=".25" value="${s.hours}" data-session-hours="${s.id}" aria-label="Session hours"></label><button class="btn small danger" data-delete-session="${s.id}">Remove</button></div>`).join('')||'<div class="empty">No study sessions yet. Add one to start planning.</div>'}</div></section>`}
function sessionForm(){return `<section class="card form-card"><form id="new-session"><div class="field-grid"><label class="field">Subject<select name="subjectId">${data.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><label class="field">Day<select name="day">${DAYS.map(d=>`<option>${d}</option>`).join('')}</select></label><label class="field">Hours<input name="hours" type="number" min=".25" max="24" step=".25" value="1" required></label></div><div class="form-actions"><button type="button" class="btn" data-action="cancel-session">Cancel</button><button class="btn primary">Save session</button></div></form></section>`}
function gradePage(){if(!data.grades.some(g=>g.subjectId===gradeSubject))gradeSubject=data.subjects[0]?.id||'';const book=data.grades.find(g=>g.subjectId===gradeSubject)||{subjectId:gradeSubject,items:[]},r=weighted(book.items);return `${intro('Grade Analyzer','Calculate weighted grades using assessment scores and percentage weights.')}<section class="card"><div class="field" style="max-width:340px"><label for="grade-subject">Subject</label><select id="grade-subject">${data.subjects.map(s=>`<option value="${s.id}" ${s.id===gradeSubject?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="grade-result"><div><strong>${r.grade===null?'—':r.grade.toFixed(2)+'%'}</strong><small>${r.grade===null?'Weights must total exactly 100%.':'Calculated weighted grade'}</small></div><div><strong style="font-size:20px;color:${Math.abs(r.weight-100)<.0001?'var(--green)':'var(--red)'}">${r.weight.toFixed(1)}%</strong><small>Weights assigned</small></div></div><div class="card-head"><h3>Assessments</h3>${btn('+ Add assessment','add-grade')}</div><div class="grade-item grade-head"><span>Assessment</span><span>Score (%)</span><span>Weight (%)</span><span>Action</span></div><div id="grade-items">${book.items.map(g=>`<div class="grade-item"><input value="${esc(g.name)}" maxlength="70" data-grade-field="name" data-grade-id="${g.id}" aria-label="Assessment name"><input type="number" min="0" max="100" step=".01" value="${g.score}" data-grade-field="score" data-grade-id="${g.id}" aria-label="Score percentage"><input type="number" min="0" max="100" step=".1" value="${g.weight}" data-grade-field="weight" data-grade-id="${g.id}" aria-label="Weight percentage"><button class="btn small danger" data-delete-grade="${g.id}">Delete</button></div>`).join('')||'<div class="empty">No assessments yet. Add an assessment and its score and weight.</div>'}</div><p class="muted">Formula: weighted grade = Σ(score × weight ÷ 100). Scores and weights must be between 0 and 100; all weights must total 100% to show a final grade.</p></section>`}
function subjectsPage(){return `${intro('Subjects','Manage the subjects used in tasks, study sessions, and grade analysis.',btn('+ Add subject','add-subject'))}<div id="subject-form-holder"></div><section class="card">${data.subjects.map(s=>`<div class="subject-card"><div class="subject-name"><span class="subject-color" style="background:${s.color}"></span>${esc(s.name)}</div><div><span class="muted">${data.tasks.filter(t=>t.subjectId===s.id).length} tasks</span> <button class="btn small danger" data-delete-subject="${s.id}">Delete</button></div></div>`).join('')||'<div class="empty">No subjects yet. Add one to get started.</div>'}<p class="muted">A subject cannot be deleted while it is used by a task, grade assessment, or study session.</p></section>`}
function subjectForm(){return `<section class="card form-card"><form id="new-subject"><label class="field">Subject name<input name="name" maxlength="50" required placeholder="e.g. Database Management"></label><div class="form-actions"><button type="button" class="btn" data-action="cancel-subject">Cancel</button><button class="btn primary">Save subject</button></div></form></section>`}
function render(){const view=document.getElementById('view');view.innerHTML=page==='Dashboard'?dashboard():page==='My Tasks'?tasksPage():page==='Study Planner'?plannerPage():page==='Grade Analyzer'?gradePage():subjectsPage();bindPage()}
function bindPage(){
document.querySelectorAll('[data-page]').forEach(b=>{if(!b.dataset.bound){b.dataset.bound='1';b.addEventListener('click',()=>setPage(b.dataset.page))}});
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.action;if(a==='add-task'){const holder=document.getElementById('task-form-holder');if(holder){holder.innerHTML=taskForm();holder.querySelector('#new-task').addEventListener('submit',saveTask);holder.querySelector('[data-action="cancel-task"]').addEventListener('click',()=>holder.innerHTML='');holder.scrollIntoView({behavior:'smooth',block:'center'})}else{setPage('My Tasks');setTimeout(()=>document.querySelector('[data-action="add-task"]')?.click(),0)}}else if(a==='cancel-task'){document.getElementById('task-form-holder').innerHTML=''}else if(a==='add-session'){document.getElementById('session-form-holder').innerHTML=sessionForm();document.getElementById('new-session').addEventListener('submit',saveSession)}else if(a==='cancel-session'){document.getElementById('session-form-holder').innerHTML=''}else if(a==='add-subject'){const h=document.getElementById('subject-form-holder');h.innerHTML=subjectForm();h.querySelector('#new-subject').addEventListener('submit',saveSubject)}else if(a==='cancel-subject'){document.getElementById('subject-form-holder').innerHTML=''}else if(a==='add-grade'){const book=data.grades.find(g=>g.subjectId===gradeSubject);if(!book){data.grades.push({subjectId:gradeSubject,items:[]});}data.grades.find(g=>g.subjectId===gradeSubject).items.push({id:id(),name:'New assessment',score:0,weight:0});save();render()} }));
document.querySelectorAll('[data-toggle-task]').forEach(el=>el.addEventListener('change',()=>{const t=data.tasks.find(x=>x.id===el.dataset.toggleTask);if(t){t.done=el.checked;save();render()}}));
document.querySelectorAll('[data-delete-task]').forEach(b=>b.addEventListener('click',()=>{if(confirm('Delete this task?')){data.tasks=data.tasks.filter(t=>t.id!==b.dataset.deleteTask);save();render();notify('Task deleted')}}));
document.querySelectorAll('[data-delete-session]').forEach(b=>b.addEventListener('click',()=>{data.sessions=data.sessions.filter(s=>s.id!==b.dataset.deleteSession);save();render();notify('Study session removed')}));
document.querySelectorAll('[data-session-hours]').forEach(el=>el.addEventListener('change',()=>{const v=Number(el.value),s=data.sessions.find(x=>x.id===el.dataset.sessionHours);if(!s)return;if(!Number.isFinite(v)||v<.25||v>24){notify('Enter between 0.25 and 24 hours');render();return}s.hours=v;save();render();notify('Study hours updated')}));
document.querySelectorAll('[data-delete-grade]').forEach(b=>b.addEventListener('click',()=>{const book=data.grades.find(g=>g.subjectId===gradeSubject);if(book)book.items=book.items.filter(g=>g.id!==b.dataset.deleteGrade);save();render()}));
document.querySelectorAll('[data-grade-field]').forEach(el=>el.addEventListener('change',()=>{const book=data.grades.find(g=>g.subjectId===gradeSubject),g=book?.items.find(x=>x.id===el.dataset.gradeId);if(!g)return;const f=el.dataset.gradeField;if(f==='name')g.name=el.value.trim()||'Assessment';else{const v=Number(el.value);if(!Number.isFinite(v)||v<0||v>100){notify('Enter a value between 0 and 100');render();return}g[f]=v}save();render()}));
const gs=document.getElementById('grade-subject');if(gs)gs.addEventListener('change',()=>{gradeSubject=gs.value;render()});
const goal=document.getElementById('weekly-goal');if(goal)goal.addEventListener('change',()=>{const v=Number(goal.value);if(!Number.isFinite(v)||v<1||v>168){notify('Weekly goal must be 1–168 hours');render();return}data.weeklyGoal=v;save();render()});
const search=document.getElementById('task-search');if(search){search.addEventListener('input',()=>{taskSearch=search.value;const pos=search.selectionStart;render();const n=document.getElementById('task-search');n.focus();n.setSelectionRange(pos,pos)});const filter=document.getElementById('task-filter');filter.addEventListener('change',()=>{const status=filter.value;document.querySelectorAll('#task-table tr').forEach(tr=>{const c=tr.querySelector('[data-toggle-task]');if(!c)return;tr.classList.toggle('hidden',status==='pending'&&c.checked||status==='done'&&!c.checked)})})}
}
function saveTask(e){e.preventDefault();const f=new FormData(e.target),title=String(f.get('title')||'').trim(),hours=Number(f.get('hours'));if(!title){notify('Enter a task title');return}if(!Number.isFinite(hours)||hours<.25||hours>100){notify('Hours must be between 0.25 and 100');return}data.tasks.push({id:id(),title,subjectId:String(f.get('subjectId')),type:String(f.get('type')),due:String(f.get('due')),priority:String(f.get('priority')),done:false,hours});save();
render();
notify('Task added');
checkDueNotifications();}
function saveSession(e){e.preventDefault();const f=new FormData(e.target),hours=Number(f.get('hours'));if(!Number.isFinite(hours)||hours<.25||hours>24){notify('Hours must be between 0.25 and 24');return}data.sessions.push({id:id(),subjectId:String(f.get('subjectId')),day:String(f.get('day')),hours});save();render();notify('Study session added')}
function saveSubject(e){e.preventDefault();const f=new FormData(e.target),name=String(f.get('name')||'').trim();if(!name){notify('Enter a subject name');return}if(data.subjects.some(s=>s.name.toLowerCase()===name.toLowerCase())){notify('That subject already exists');return}const s={id:id(),name,color:COLORS[data.subjects.length%COLORS.length]};data.subjects.push(s);if(!data.grades.some(g=>g.subjectId===s.id))data.grades.push({subjectId:s.id,items:[]});save();render();notify('Subject added')}
function resetDemo(){if(confirm('Reset all StudySync data to the original sample data? This cannot be undone.')){data=structuredClone(seed);gradeSubject='math';taskSearch='';save();render();notify('Sample data restored')}}
render();

// Supabase account system: cloud sync is enabled after config.js is filled in.
function setAccountUI(){
 const status=document.getElementById('account-status');
 const login=document.getElementById('login-btn'), signup=document.getElementById('signup-btn'), logout=document.getElementById('logout-btn');
 if(currentUser){status.textContent=`Signed in as ${currentUser.email} — your StudySync data syncs to your account.`;login.classList.add('hidden');signup.classList.add('hidden');logout.classList.remove('hidden');}
 else {status.textContent=supabaseClient?'Not signed in — log in to load your saved account data.':'Supabase is not configured yet — local-only mode.';login.classList.remove('hidden');signup.classList.remove('hidden');logout.classList.add('hidden');}
}
async function authForm(mode){
 if(!supabaseClient){alert('Account login is not configured yet. Follow README.md and add your Supabase URL and anon key in config.js.');return;}
 const email=prompt('Enter your email address:'); if(!email)return;
 const password=prompt(mode==='signup'?'Create a password (at least 6 characters):':'Enter your password:'); if(!password)return;
 let result= mode==='signup' ? await supabaseClient.auth.signUp({email:email.trim(),password}) : await supabaseClient.auth.signInWithPassword({email:email.trim(),password});
 if(result.error){alert(result.error.message);return;}
 if(mode==='signup' && !result.data.session){alert('Account created. Check your email to confirm your account, then log in.');return;}
 if(result.data.user){await loadAccount(result.data.user);}
}
async function loadAccount(user){
 currentUser=user; loadingCloud=true;
 const {data:row,error}=await supabaseClient.from('user_data').select('payload').eq('user_id',user.id).maybeSingle();
 if(error){console.error(error);notify('Could not load cloud data. Check Supabase table setup.');}
 if(row && row.payload){data=row.payload;try{localStorage.setItem(activeStorageKey(),JSON.stringify(data));}catch(e){}}
 else {data=structuredClone(seed);}
 loadingCloud=false; setAccountUI(); render();
 if(!row || !row.payload) save();
 notify('Account data loaded');
}
async function initAuth(){
 try {
  if(window.STUDYSYNC_SUPABASE_URL && window.STUDYSYNC_SUPABASE_ANON_KEY && !window.STUDYSYNC_SUPABASE_URL.includes('YOUR_')){
   supabaseClient=window.supabase.createClient(window.STUDYSYNC_SUPABASE_URL,window.STUDYSYNC_SUPABASE_ANON_KEY);
   const {data:sessionData}=await supabaseClient.auth.getSession();
   if(sessionData.session?.user) await loadAccount(sessionData.session.user);
   supabaseClient.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_IN' && session?.user && session.user.id!==currentUser?.id) setTimeout(()=>loadAccount(session.user),0);
    if(event==='SIGNED_OUT'){currentUser=null;data=loadData();setAccountUI();render();}
   });
  }
 } catch(e){console.error(e);}
 setAccountUI();
}
document.getElementById('login-btn').addEventListener('click',()=>authForm('login'));
document.getElementById('signup-btn').addEventListener('click',()=>authForm('signup'));
document.getElementById('logout-btn').addEventListener('click',async()=>{if(!supabaseClient)return;const {error}=await supabaseClient.auth.signOut();if(error)alert(error.message);else notify('Logged out. Your account data remains saved in the cloud.');});

document.getElementById('browser-notify-btn').addEventListener('click', async () => {
  if (!('Notification' in window)) {
    alert('Notifications are not supported in this browser. Please use a supported browser or device.');
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      notify('Browser notifications enabled');
      checkDueNotifications();
    } else {
      alert('Notifications are blocked. Please allow notifications in your browser settings.');
    }
  } catch (error) {
    console.error('Notification error:', error);
    alert('Could not enable notifications on this device.');
  }
});

function checkDueNotifications(){
 if(!('Notification' in window)||Notification.permission!=='granted')return;
 const today=new Date();today.setHours(0,0,0,0);
 const dueSoon=data.tasks.filter(t=>!t.done&&t.due).filter(t=>{const d=new Date(t.due+'T00:00:00');const diff=Math.round((d-today)/86400000);return diff>=0&&diff<=2;});
 const key='studysync-notified-'+(currentUser?.id||'guest')+'-'+today.toISOString().slice(0,10);
 if(dueSoon.length&&!sessionStorage.getItem(key)){new Notification('StudySync deadline reminder',{body:dueSoon.length===1?`Upcoming: ${dueSoon[0].title}`:`You have ${dueSoon.length} tasks due within 2 days.`});sessionStorage.setItem(key,'1');}
}
initAuth().then(()=>checkDueNotifications());
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('service-worker.js').catch(e=>console.warn('Service worker registration failed',e));

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}