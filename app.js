(() => {
  const KEY='workout_control_v3';
  const defaultState={
    profile:{weight:'',waist:''},
    user:null,
    exercises:[
      {id:'inverted-row',name:'Inverted Row',type:'pull',min:8,max:12,load:0,unit:'BW',reps:10,rir:2,sets:3,note:'Controlled 2–3 sec lowering.'},
      {id:'bulgarian-split-squat',name:'Bulgarian Split Squat',type:'legs',min:8,max:12,load:5,unit:'kg',reps:10,rir:2,sets:3,note:'Each leg. Stable, controlled ROM.'},
      {id:'neutral-push-up',name:'Neutral-Grip Push-up',type:'push',min:6,max:10,load:0,unit:'BW',reps:8,rir:2,sets:3,note:'Elbows about 45°. No painful ROM.'},
      {id:'romanian-deadlift',name:'Romanian Deadlift',type:'legs',min:10,max:15,load:5,unit:'kg',reps:12,rir:2,sets:3,note:'Smooth tempo; stay within comfortable ROM.'}
    ],
    history:[], bodyLog:[], lastSync:null
  };
  let state=load(); let page='home'; let timer=null; let remaining=0;
  const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
  function load(){try{return {...defaultState,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return structuredClone(defaultState)}}
  function save(){localStorage.setItem(KEY,JSON.stringify(state))}
  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
  function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function fmtDate(d){return new Date(d).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
  function nextTarget(e){
    if(e.reps<e.max) return `${e.reps+1} reps × ${e.sets} sets`;
    if(e.load>0) return `${(Number(e.load)+2.5).toFixed(1).replace('.0','')} kg × ${e.max} reps`;
    return `Increase difficulty × ${e.max} reps`;
  }
  function status(e){if(e.reps<e.min)return ['Build volume','warn'];if(e.reps<e.max)return ['Add 1 rep','good'];if(e.load>0)return ['Add 2.5 kg','good'];return ['Increase difficulty','good']}
  function weeklyCount(){const weekAgo=Date.now()-6*86400000;return state.history.filter(h=>new Date(h.date).getTime()>=weekAgo).length}
  function render(){
    const titles={home:'Dashboard',workout:'Workout',progress:'Progress',history:'History',settings:'Settings',auth:'Sign in'};$('#pageTitle').textContent=titles[page]||'Dashboard';$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.nav===page));
    if(page==='auth') renderAuth(); else ({home:renderHome,workout:renderWorkout,progress:renderProgress,history:renderHistory,settings:renderSettings}[page]||renderHome)();
  }
  function renderAuth(){
    $('#main').innerHTML=`<div class="auth-wrap"><section class="auth"><div class="eyebrow">WORKOUT CONTROL</div><h2>Sign in to sync your training</h2><p class="muted">You can use the app locally without an account. Sign in only when you want cloud sync across devices.</p><div id="authStatus" class="status">Cloud sync is optional.</div><div class="field"><label>Email</label><input id="email" type="email" autocomplete="email" placeholder="you@example.com"></div><div class="field"><label>Password</label><input id="password" type="password" autocomplete="current-password" placeholder="At least 6 characters"></div><div class="actions"><button class="btn" id="login">Sign in</button><button class="btn secondary" id="signup">Create account</button></div><p class="tiny muted" style="margin-top:12px">No Supabase configuration? Use Settings → Local mode.</p></section></div>`;
    $('#login').onclick=()=>auth('login');$('#signup').onclick=()=>auth('signup');
  }
  async function auth(mode){
    if(!supabaseClient){$('#authStatus').textContent='Cloud database is not configured yet. Add Supabase settings in config.js.';$('#authStatus').className='status error';return}
    const email=$('#email').value.trim(),password=$('#password').value;if(!email||password.length<6){$('#authStatus').textContent='Enter a valid email and a password of at least 6 characters.';$('#authStatus').className='status error';return}
    $('#authStatus').textContent='Working…';
    const r=mode==='login'?await supabaseClient.auth.signInWithPassword({email,password}):await supabaseClient.auth.signUp({email,password});
    if(r.error){$('#authStatus').textContent=r.error.message;$('#authStatus').className='status error';return}
    if(mode==='signup'&&!r.data.session){$('#authStatus').textContent='Account created. Check your email if confirmation is enabled.';$('#authStatus').className='status ok';return}
    state.user=r.data.user;save();await pullCloud();render();toast('Signed in');
  }
  function renderHome(){
    const today=new Date().toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});const last=state.history[0];
    $('#main').innerHTML=`<section class="hero"><span class="pill good">${today}</span><h2>${last?'Ready for your next session.':'Start your first session.'}</h2><p class="muted">Log every set, then let the app recommend your next progressive-overload target.</p><div class="actions"><button class="btn" onclick="window.WC.go('workout')">Start Workout</button>${last?`<button class="btn secondary" onclick="window.WC.go('history')">Last Session</button>`:''}</div></section>
    <div class="grid grid3"><div class="stat"><div class="label">7-day workouts</div><div class="value">${weeklyCount()}</div></div><div class="stat"><div class="label">Weight</div><div class="value">${state.profile.weight?esc(state.profile.weight)+' kg':'—'}</div></div><div class="stat"><div class="label">Waist</div><div class="value">${state.profile.waist?esc(state.profile.waist)+' cm':'—'}</div></div></div>
    <div class="section-title"><h2>Next targets</h2><span class="pill">Automatic</span></div><div class="card">${state.exercises.map(e=>{const [s,c]=status(e);return `<div class="progress-row"><div><b>${esc(e.name)}</b><div class="tiny muted">Current: ${e.reps} reps${e.load?` @ ${e.load} kg`:''} · RIR ${e.rir}</div><div class="bar"><i style="width:${Math.min(100,Math.round(e.reps/e.max*100))}%"></i></div></div><span class="pill ${c}">${esc(s)}</span></div>`}).join('')}</div>
    <div class="card"><h3>Cloud status</h3><p class="tiny muted">${state.user?`Signed in as ${esc(state.user.email)}. Last sync: ${state.lastSync?fmtDate(state.lastSync):'not yet synced'}.`:'Local mode. Your data is stored on this device until you sign in.'}</p></div>`;
  }
  function renderWorkout(){
    $('#main').innerHTML=`<section class="hero"><span class="pill">Full Body · 3× / week</span><h2>Today's Session</h2><p class="muted">Controlled reps. Leave about 1–3 reps in reserve. Stop or modify any movement that causes pain.</p><div class="actions"><button class="btn secondary" onclick="WC.startRest(90)">Start 90s Rest</button><button class="btn" onclick="WC.finishWorkout()">Finish Workout</button></div><div id="timerText" class="timer-display"></div></section>${state.exercises.map((e,i)=>exerciseCard(e,i)).join('')}`;
  }
  function exerciseCard(e,i){return `<article class="exercise"><div class="exercise-head"><div><h3>${i+1}. ${esc(e.name)}</h3><div class="meta">${esc(e.note)}</div></div><span class="pill">${e.sets} sets</span></div><div class="target-box"><div class="tiny muted">NEXT TARGET</div><b>${esc(nextTarget(e))}</b><div class="tiny muted">Current: ${e.reps} reps${e.load?` @ ${e.load} kg`:''} · RIR ${e.rir}</div></div><div class="controls"><div><div class="tiny muted" style="text-align:center">Reps</div><div class="stepper"><button class="circle" onclick="WC.bump('${e.id}',-1)">−</button><strong id="rep-${e.id}">${e.reps}</strong><button class="circle" onclick="WC.bump('${e.id}',1)">+</button></div></div><div><div class="tiny muted">RIR</div><select class="field" style="margin:0" onchange="WC.setRir('${e.id}',this.value)">${[0,1,2,3,4,5].map(x=>`<option ${Number(e.rir)===x?'selected':''}>${x}</option>`).join('')}</select></div><div><div class="tiny muted">Load</div><input class="field" style="margin:0;padding:10px" type="number" step="0.5" min="0" value="${e.load}" onchange="WC.setLoad('${e.id}',this.value)"></div></div></article>`}
  function renderProgress(){
  const rows = state.exercises.map(e => `
    <div class="progress-row">
      <div>
        <b>${esc(e.name)}</b>
        <div class="tiny muted">
          ${e.reps}/${e.max} reps ·
          ${e.load ? e.load+' kg' : 'Bodyweight'} ·
          RIR ${e.rir}
        </div>
        <div class="bar">
          <i style="width:${(Math.min(100, (e.reps / e.max) * 100))}%"></i>
        </div>
      </div>
      <strong>${esc(nextTarget(e))}</strong>
    </div>
  `).join('');

  const body = state.bodyLog.slice(-8);

  $('#main').innerHTML = `
    <section class="hero">
      <span class="pill good">Progressive Overload Engine</span>
      <h2>Progress</h2>
      <p class="muted">
        Add reps inside the range. Once the top of the range is reached,
        add load or difficulty.
      </p>
    </section>

    <div class="card">
      <h3>Exercise progression</h3>
      ${rows}
    </div>

    <div class="progress-charts">

      <!-- BODY TREND -->
      <section class="card chart-card">
        <div class="chart-header">
          <div>
            <h3>Body Trend</h3>
            <div class="tiny muted">Body weight over time</div>
          </div>
        </div>

        ${
          body.length < 2
          ? `
            <div class="empty">
              Add at least two weight entries in Settings
              to see your body trend.
            </div>
          `
          : `
            <canvas
              id="bodyChart"
              class="chart"
              width="900"
              height="300">
            </canvas>
          `
        }
      </section>

      <!-- TRAINING PROGRESSION -->
      <section class="card chart-card">
        <div class="chart-header">
          <div>
            <h3>Training Progression</h3>
            <div class="tiny muted">
              Performance across completed workouts
            </div>
          </div>
        </div>

        <div class="chart-controls">

          <div class="field">
            <label>Exercise</label>
            <select id="trainingExercise">
              ${state.exercises.map(e => `
                <option value="${esc(e.id)}">
                  ${esc(e.name)}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="field">
            <label>Metric</label>
            <select id="trainingMetric">
              <option value="reps">Reps</option>
              <option value="load">Load</option>
            </select>
          </div>

        </div>

        <canvas
          id="trainingChart"
          class="chart"
          width="900"
          height="300">
        </canvas>

      </section>

    </div>
  `;

  // Draw body chart
  if(body.length >= 2){
    drawChart(body);
  }

  // Draw training progression
  drawTrainingChart();

  // Update training graph when exercise or metric changes
  const exerciseSelect = $('#trainingExercise');
  const metricSelect = $('#trainingMetric');

  if(exerciseSelect){
    exerciseSelect.onchange = drawTrainingChart;
  }

  if(metricSelect){
    metricSelect.onchange = drawTrainingChart;
  }
}


function drawChart(data){
  const c = $('#bodyChart');

  if(!c) return;

  const ctx = c.getContext('2d');
  const w = c.width;
  const h = c.height;

  ctx.clearRect(0,0,w,h);

  const vals = data
    .map(x => Number(x.weight))
    .filter(Boolean);

  if(!vals.length) return;

  const min = Math.min(...vals) - 1;
  const max = Math.max(...vals) + 1;

  // Grid
  ctx.strokeStyle = '#263247';
  ctx.lineWidth = 1;

  for(let i=0;i<5;i++){
    const y = 30 + i*(h-60)/4;

    ctx.beginPath();
    ctx.moveTo(40,y);
    ctx.lineTo(w-20,y);
    ctx.stroke();
  }

  // Line
  ctx.strokeStyle = '#62d6a7';
  ctx.lineWidth = 4;
  ctx.beginPath();

  data.forEach((p,i) => {

    const x =
      45 +
      i*(w-75)/Math.max(1,data.length-1);

    const y =
      30 +
      (max-Number(p.weight))/(max-min)*(h-60);

    if(i){
      ctx.lineTo(x,y);
    }else{
      ctx.moveTo(x,y);
    }

  });

  ctx.stroke();

  // Points
  ctx.fillStyle = '#62d6a7';

  data.forEach((p,i) => {

    const x =
      45 +
      i*(w-75)/Math.max(1,data.length-1);

    const y =
      30 +
      (max-Number(p.weight))/(max-min)*(h-60);

    ctx.beginPath();
    ctx.arc(x,y,5,0,Math.PI*2);
    ctx.fill();

  });

  // Labels
  ctx.fillStyle = '#f4f7fb';
  ctx.font = '14px system-ui';

  ctx.fillText(
    `${max.toFixed(1)} kg`,
    45,
    22
  );

  ctx.fillText(
    `${min.toFixed(1)} kg`,
    45,
    h-8
  );
}


function drawTrainingChart(){

  const c = $('#trainingChart');

  if(!c) return;

  const ctx = c.getContext('2d');
  const w = c.width;
  const h = c.height;

  ctx.clearRect(0,0,w,h);

  const exerciseId = $('#trainingExercise')?.value;
  const metric = $('#trainingMetric')?.value || 'reps';

  if(!exerciseId) return;

  // History is stored newest first,
  // so reverse it for chronological graphing.
  const workouts = [...state.history].reverse();

  const points = [];

  workouts.forEach(h => {

    const ex = h.exercises?.find(
      x => x.id === exerciseId
    );

    if(!ex) return;

    let value;

    if(metric === 'load'){
      value = Number(ex.load) || 0;
    }else{
      value = Number(ex.reps) || 0;
    }

    points.push({
      date: h.date,
      value
    });

  });

  if(points.length < 1){

    ctx.fillStyle = '#9aa7ba';
    ctx.font = '14px system-ui';

    ctx.fillText(
      'Complete a workout to start tracking progression.',
      45,
      h/2
    );

    return;
  }

  const values = points.map(p => p.value);

  let min = Math.min(...values);
  let max = Math.max(...values);

  // Give the graph some breathing room
  if(min === max){
    min = Math.max(0,min-1);
    max = max+1;
  }else{
    const padding = (max-min)*0.15;
    min = Math.max(0,min-padding);
    max = max+padding;
  }

  // Grid
  ctx.strokeStyle = '#263247';
  ctx.lineWidth = 1;

  for(let i=0;i<5;i++){

    const y =
      30 +
      i*(h-60)/4;

    ctx.beginPath();
    ctx.moveTo(40,y);
    ctx.lineTo(w-20,y);
    ctx.stroke();

  }

  // Training line
  ctx.strokeStyle = '#6ea8ff';
  ctx.lineWidth = 4;
  ctx.beginPath();

  points.forEach((p,i) => {

    const x =
      45 +
      i*(w-75)/Math.max(1,points.length-1);

    const y =
      30 +
      (max-p.value)/(max-min)*(h-60);

    if(i){
      ctx.lineTo(x,y);
    }else{
      ctx.moveTo(x,y);
    }

  });

  ctx.stroke();

  // Points
  ctx.fillStyle = '#6ea8ff';

  points.forEach((p,i) => {

    const x =
      45 +
      i*(w-75)/Math.max(1,points.length-1);

    const y =
      30 +
      (max-p.value)/(max-min)*(h-60);

    ctx.beginPath();
    ctx.arc(x,y,5,0,Math.PI*2);
    ctx.fill();

  });

  // Current value
  const last = points[points.length-1];

  ctx.fillStyle = '#f4f7fb';
  ctx.font = '14px system-ui';

  const unit =
    metric === 'load'
      ? ' kg'
      : ' reps';

  ctx.fillText(
    `${last.value}${unit}`,
    45,
    22
  );

  // Bottom date labels
  ctx.fillStyle = '#9aa7ba';
  ctx.font = '11px system-ui';

  const firstDate =
    new Date(points[0].date)
      .toLocaleDateString(undefined,{
        month:'short',
        day:'numeric'
      });

  const lastDate =
    new Date(points[points.length-1].date)
      .toLocaleDateString(undefined,{
        month:'short',
        day:'numeric'
      });

  ctx.fillText(
    firstDate,
    45,
    h-8
  );

  if(points.length > 1){

    const textWidth =
      ctx.measureText(lastDate).width;

    ctx.fillText(
      lastDate,
      w-20-textWidth,
      h-8
    );

  }
}

  $('#main').innerHTML=state.history.map((h,i)=>`
    <article class="card">
      <div class="section-title" style="margin:0 0 8px">
        <h3>${fmtDate(h.date)}</h3>

        <div class="actions">
          <span class="pill good">Completed</span>
          <button
            class="btn danger small"
            onclick="WC.deleteHistory('${esc(h.id)}')">
            Delete
          </button>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Exercise</th>
            <th>Reps</th>
            <th>Load</th>
            <th>RIR</th>
          </tr>
        </thead>

        <tbody>
          ${h.exercises.map(x=>`
            <tr>
              <td>${esc(x.name)}</td>
              <td>${x.reps} × ${x.sets}</td>
              <td>${x.load?x.load+' kg':'BW'}</td>
              <td>${x.rir}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </article>
  `).join('');
}
  function renderSettings(){
    $('#main').innerHTML=`<section class="card"><h3>Profile</h3><div class="form-grid"><div class="field"><label>Body weight (kg)</label><input id="weight" type="number" step="0.1" value="${esc(state.profile.weight)}"></div><div class="field"><label>Waist (cm)</label><input id="waist" type="number" step="0.1" value="${esc(state.profile.waist)}"></div></div><button class="btn" onclick="WC.saveProfile()">Save profile</button></section>
    <section class="card"><h3>Cloud account</h3><div class="status ${state.user?'ok':''}">${state.user?`Signed in: ${esc(state.user.email)}`:'Not signed in'}</div><div class="actions">${state.user?'<button class="btn secondary" onclick="WC.sync()">Sync now</button><button class="btn danger" onclick="WC.logout()">Sign out</button>':'<button class="btn" onclick="WC.goAuth()">Sign in / Create account</button>'}</div><p class="tiny muted" style="margin-top:10px">Cloud sync needs Supabase URL + anon/publishable key in <code>config.js</code>. Local mode works without it.</p></section>
    <section class="card"><h3>Backup</h3><p class="tiny muted">Export a JSON backup before making major changes. Import replaces local data.</p><div class="actions"><button class="btn secondary" onclick="WC.exportData()">Export backup</button><label class="btn secondary">Import backup<input id="importFile" type="file" accept="application/json" hidden></label></div></section>
    <section class="card"><h3>App</h3><p class="tiny muted">Workout Control v3 · PWA · local-first · optional Supabase sync.</p><button class="btn danger" onclick="WC.resetLocal()">Reset local data</button></section>`;
    $('#importFile').onchange=importData;
  }
    async function saveProfile(){
    state.profile.weight = $('#weight').value;
    state.profile.waist = $('#waist').value;
    
    state.bodyLog.unshift({
      date: new Date().toISOString(),
      weight: Number(state.profile.weight) || null,
      waist: Number(state.profile.waist) || null
    });
    state.bodyLog = state.bodyLog.slice(0,30);
    
    save(); // ローカルに保存
    toast('Profile saved locally');

    // 【追加】もしログイン中なら、自動でSupabaseにも保存（同期）する
    if (state.user && typeof sync === 'function') {
      try {
        toast('Syncing with Supabase...');
        await sync(); 
      } catch (e) {
        console.error(e);
        toast('Cloud sync failed, saved locally');
      }
    }
    
    render();
  }

    async function bump(id,d){
    const e=state.exercises.find(x=>x.id===id);
    e.reps=Math.max(0,Math.min(e.max,e.reps+d));
    save();
    const el=$(`#rep-${id}`);
    if(el)el.textContent=e.reps;
    
    // 【追加】変更をSupabaseに自動同期
    if(state.user && typeof sync==='function') {
      await sync();
    }
  }

  async function setRir(id,v){
    state.exercises.find(x=>x.id===id).rir=Number(v);
    save();
    
    // 【追加】変更をSupabaseに自動同期
    if(state.user && typeof sync==='function') {
      await sync();
    }
  }

  async function setLoad(id,v){
    state.exercises.find(x=>x.id===id).load=Math.max(0,Number(v)||0);
    save();
    
    // 【追加】変更をSupabaseに自動同期
    if(state.user && typeof sync==='function') {
      await sync();
    }
  }

  function finishWorkout(){const now=new Date().toISOString();const log={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),date:now,exercises:state.exercises.map(e=>({id:e.id,name:e.name,reps:e.reps,sets:e.sets,load:e.load,rir:e.rir}))};state.history.unshift(log);state.history=state.history.slice(0,100);state.lastSync=null;save();toast('Workout completed');if(state.user)sync();render();}
  function startRest(sec){clearInterval(timer);remaining=sec;updateTimer();timer=setInterval(()=>{remaining--;updateTimer();if(remaining<=0){clearInterval(timer);toast('Rest complete');navigator.vibrate?.([150,80,150])}},1000)}
  function updateTimer(){
  const el = $('#timerText');
  if(el) {
    el.textContent = remaining
      ? `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`
      : '';
  }
}
  async function deleteHistory(id){
  const item = state.history.find(h => h.id === id);

  if(!item) return;

  if(!confirm(`Delete workout from ${fmtDate(item.date)}?`)){
    return;
  }

  // Remove locally
  state.history = state.history.filter(h => h.id !== id);
  save();

  // Remove from Supabase if signed in
  if(state.user && supabaseClient){
    try{
      const {error} = await supabaseClient
        .from('workout_history')
        .delete()
        .eq('id', id)
        .eq('user_id', state.user.id);

      if(error) throw error;

      toast('History deleted');
    }catch(e){
      console.error('Delete history failed:', e);
      toast('Deleted locally; cloud delete failed');
    }
  }else{
    toast('History deleted');
  }

  render();
}
  function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`workout-control-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)}
  function importData(ev){const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!x.exercises||!x.history)throw Error('Invalid backup');state={...defaultState,...x};save();render();toast('Backup imported')}catch(e){toast('Invalid backup')}};r.readAsText(f)}
  function resetLocal(){if(confirm('Reset all local workout data on this device?')){localStorage.removeItem(KEY);state=structuredClone(defaultState);render();toast('Local data reset')}}
  async function sync(){if(!supabaseClient||!state.user){toast('Cloud sync is not available');return}await pushCloud();await pullCloud();state.lastSync=new Date().toISOString();save();toast('Synced');render()}
  async function pushCloud(){
    const uid=state.user.id;
    const profile={user_id:uid,weight:Number(state.profile.weight)||null,waist:Number(state.profile.waist)||null,updated_at:new Date().toISOString()};
    const {error:e1}=await supabaseClient.from('profiles').upsert(profile,{onConflict:'user_id'});if(e1)throw e1;
    const exRows=state.exercises.map(e=>({user_id:uid,exercise_id:e.id,name:e.name,type:e.type,min_reps:e.min,max_reps:e.max,load:e.load,unit:e.unit,reps:e.reps,rir:e.rir,sets:e.sets,note:e.note,updated_at:new Date().toISOString()}));
    const {error:e2}=await supabaseClient.from('exercise_state').upsert(exRows,{onConflict:'user_id,exercise_id'});if(e2)throw e2;
    if(state.history.length){const rows=state.history.map(h=>({id:h.id,user_id:uid,workout_date:h.date,payload:h}));const {error:e3}=await supabaseClient.from('workout_history').upsert(rows,{onConflict:'id'});if(e3)throw e3}
  }
  async function pullCloud(){
    if(!supabaseClient||!state.user)return;
    const uid=state.user.id;const {data:p}=await supabaseClient.from('profiles').select('*').eq('user_id',uid).maybeSingle();if(p){state.profile.weight=p.weight??'';state.profile.waist=p.waist??''}
    const {data:es}=await supabaseClient.from('exercise_state').select('*').eq('user_id',uid);if(es?.length){state.exercises=state.exercises.map(e=>{const x=es.find(r=>r.exercise_id===e.id);return x?{...e,reps:x.reps,rir:x.rir,load:x.load,sets:x.sets}:e})}
    const {data:hs}=await supabaseClient.from('workout_history').select('payload').eq('user_id',uid).order('workout_date',{ascending:false}).limit(100);if(hs)state.history=hs.map(x=>x.payload).filter(Boolean);save()
  }
  async function logout(){if(supabaseClient)await supabaseClient.auth.signOut();state.user=null;save();render();toast('Signed out')}
  let supabaseClient=null;const cfg=window.WORKOUT_CONFIG||{};if(window.supabase&&cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY){supabaseClient=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);supabaseClient.auth.getSession().then(async({data})=>{if(data.session){state.user=data.session.user;await pullCloud();render()}});supabaseClient.auth.onAuthStateChange((_e,s)=>{state.user=s?.user||null;save();render()})}
  window.WC={
  go:p=>{page=p;render()},
  goAuth:()=>{page='auth';render()},
  bump,
  setRir,
  setLoad,
  finishWorkout,
  deleteHistory,
  startRest,
  saveProfile,
  exportData,
  resetLocal,
  sync,
  logout
};
  $$('.nav-btn').forEach(b=>b.onclick=()=>{page=b.dataset.nav;render()});$('#syncBtn').onclick=()=>state.user?sync():toast('Local mode');
  render();
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();
