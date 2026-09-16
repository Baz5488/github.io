(() => {
  const KEY = 'workout_control_v3';

  const EXERCISE_CATALOG = {
    pull: [
      { id: 'inverted_row', name: 'Inverted Row', unit: 'reps' },
      { id: 'pull_up', name: 'Pull Up', unit: 'reps' },
      { id: 'dead_hang', name: 'Dead Hang', unit: 'sec' }
    ],
    squat: [
      { id: 'bulgarian_split_squat', name: 'Bulgarian Split Squat', unit: 'kg' },
      { id: 'front_squat', name: 'Front Squat', unit: 'kg' }
    ],
    push: [
      { id: 'push_up', name: 'Push Up', unit: 'reps' },
      { id: 'shoulder_press', name: 'Shoulder Press', unit: 'kg' }
    ],
    hinge: [
      { id: 'romanian_deadlift', name: 'Romanian Deadlift', unit: 'kg' },
      { id: 'kettlebell_swing', name: 'Kettlebell Swing', unit: 'kg' }
    ],
    other: [
      { id: 'plank', name: 'Plank', unit: 'sec' },
      { id: 'barbell_curl', name: 'Barbell Curl', unit: 'kg' }
    ]
  };

  const defaultState = {
    profile: { weight: '', waist: '' },
    user: null,
    exercises: [
      { id: 'inverted_row', name: 'Inverted Row', category: 'pull', min: 5, max: 20, load: 0, reps: 10, sets: 3, rir: 2, unit: 'reps', note: '' },
      { id: 'bulgarian_split_squat', name: 'Bulgarian Split Squat', category: 'squat', min: 5, max: 20, load: 10, reps: 8, sets: 3, rir: 2, unit: 'kg', note: '' },
      { id: 'push_up', name: 'Push Up', category: 'push', min: 5, max: 30, load: 0, reps: 12, sets: 3, rir: 2, unit: 'reps', note: '' },
      { id: 'romanian_deadlift', name: 'Romanian Deadlift', category: 'hinge', min: 5, max: 20, load: 40, reps: 10, sets: 3, rir: 2, unit: 'kg', note: '' }
    ],
    bodyLog: [],
    history: [],
    lastSync: null
  };

  let state = load();
  let page = 'home';
  let timer = null;
  let remaining = 0;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function load() {
    try {
      return { ...defaultState, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return structuredClone(defaultState);
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1800);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function fmtDate(value) {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function nextTarget(exercise) {
    if (exercise.reps < exercise.max) return `${exercise.reps + 1} reps × ${exercise.sets} sets`;
    if (exercise.load > 0) return `${(Number(exercise.load) + 2.5).toFixed(1).replace('.0', '')} kg × ${exercise.max} reps`;
    return `Increase difficulty × ${exercise.max} reps`;
  }

  function status(exercise) {
    if (exercise.reps < exercise.min) return ['Build volume', 'warn'];
    if (exercise.reps < exercise.max) return ['Add 1 rep', 'good'];
    if (exercise.load > 0) return ['Add 2.5 kg', 'good'];
    return ['Increase difficulty', 'good'];
  }

  function weeklyCount() {
    const weekAgo = Date.now() - 6 * 86400000;
    return state.history.filter((entry) => new Date(entry.date).getTime() >= weekAgo).length;
  }

  function render() {
    const titles = {
      home: 'Dashboard',
      workout: 'Workout',
      progress: 'Progress',
      history: 'History',
      settings: 'Settings',
      auth: 'Sign in'
    };

    const pageTitle = $('#pageTitle');
    if (pageTitle) pageTitle.textContent = titles[page] || 'Dashboard';

    $$('.nav-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.nav === page);
    });

    if (page === 'auth') {
      renderAuth();
      return;
    }

    const renderers = {
      home: renderHome,
      workout: renderWorkout,
      progress: renderProgress,
      history: renderHistory,
      settings: renderSettings
    };

    (renderers[page] || renderHome)();
  }

  function renderAuth() {
    $('#main').innerHTML = `
      <div class="auth-wrap">
        <section class="auth">
          <div class="eyebrow">WORKOUT CONTROL</div>
          <h2>Sign in to sync your training</h2>
          <p class="muted">You can use the app locally without an account. Sign in only when you want cloud sync across devices.</p>
          <div id="authStatus" class="status">Cloud sync is optional.</div>
          <div class="field"><label>Email</label><input id="email" type="email" autocomplete="email" placeholder="you@example.com"></div>
          <div class="field"><label>Password</label><input id="password" type="password" autocomplete="current-password" placeholder="At least 6 characters"></div>
          <div class="actions">
            <button class="btn" id="login">Sign in</button>
            <button class="btn secondary" id="signup">Create account</button>
          </div>
          <p class="tiny muted" style="margin-top:12px">No Supabase configuration? Use Settings → Local mode.</p>
        </section>
      </div>
    `;

    $('#login').onclick = () => auth('login');
    $('#signup').onclick = () => auth('signup');
  }

  async function auth(mode) {
    if (!supabaseClient) {
      $('#authStatus').textContent = 'Cloud database is not configured yet. Add Supabase settings in config.js.';
      $('#authStatus').className = 'status error';
      return;
    }

    const email = $('#email').value.trim();
    const password = $('#password').value;

    if (!email || password.length < 6) {
      $('#authStatus').textContent = 'Enter a valid email and a password of at least 6 characters.';
      $('#authStatus').className = 'status error';
      return;
    }

    $('#authStatus').textContent = 'Working…';

    const result = mode === 'login'
      ? await supabaseClient.auth.signInWithPassword({ email, password })
      : await supabaseClient.auth.signUp({ email, password });

    if (result.error) {
      $('#authStatus').textContent = result.error.message;
      $('#authStatus').className = 'status error';
      return;
    }

    if (mode === 'signup' && !result.data.session) {
      $('#authStatus').textContent = 'Account created. Check your email if confirmation is enabled.';
      $('#authStatus').className = 'status ok';
      return;
    }

    state.user = result.data.user;
    save();
    await pullCloud();
    render();
    toast('Signed in');
  }

  function renderHome() {
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    const last = state.history[0];

    const sections = state.exercises.map((exercise) => {
      const [label, tone] = status(exercise);
      return `<div class="progress-row">
        <div>
          <b>${esc(exercise.name)}</b>
          <div class="tiny muted">Current: ${exercise.reps} reps${exercise.load ? ` @ ${exercise.load} kg` : ''} · RIR ${exercise.rir}</div>
          <div class="bar"><i style="width:${Math.min(100, Math.round((exercise.reps / exercise.max) * 100))}%"></i></div>
        </div>
        <span class="pill ${tone}">${esc(label)}</span>
      </div>`;
    }).join('');

    $('#main').innerHTML = `
      <section class="hero">
        <span class="pill good">${today}</span>
        <h2>${last ? 'Ready for your next session.' : 'Start your first session.'}</h2>
        <p class="muted">Log every set, then let the app recommend your next progressive-overload target.</p>
        <div class="actions">
          <button class="btn" onclick="window.WC.go('workout')">Start Workout</button>
          ${last ? `<button class="btn secondary" onclick="window.WC.go('history')">Last Session</button>` : ''}
        </div>
      </section>
      <div class="grid grid3">
        <div class="stat"><div class="label">7-day workouts</div><div class="value">${weeklyCount()}</div></div>
        <div class="stat"><div class="label">Weight</div><div class="value">${state.profile.weight ? `${esc(state.profile.weight)} kg` : '—'}</div></div>
        <div class="stat"><div class="label">Waist</div><div class="value">${state.profile.waist ? `${esc(state.profile.waist)} cm` : '—'}</div></div>
      </div>
      <div class="section-title"><h2>Next targets</h2><span class="pill">Automatic</span></div>
      <div class="card">${sections}</div>
      <div class="card">
        <h3>Cloud status</h3>
        <p class="tiny muted">${state.user ? `Signed in as ${esc(state.user.email)}. Last sync: ${state.lastSync ? fmtDate(state.lastSync) : 'not yet synced'}.` : 'Local mode. Your data is stored on this device until you sign in.'}</p>
      </div>
    `;
  }

  function renderWorkout() {
    const existingOther = state.exercises.find((exercise) => exercise.category === 'other');
    const currentOtherId = existingOther ? existingOther.id : '';

    const otherSelectHTML = `
      <section class="card" style="margin-top: 15px; padding: 12px;">
        <div class="tiny muted" style="margin-bottom: 5px;">➕ Add 5th Exercise (Optional)</div>
        <select class="field" style="margin:0; width:100%;" onchange="WC.changeExercise('other', this.value)">
          <option value="">-- No Extra Exercise --</option>
          ${EXERCISE_CATALOG.other.map((item) => `<option value="${item.id}" ${currentOtherId === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
        </select>
      </section>
    `;

    $('#main').innerHTML = `
      <section class="hero">
        <span class="pill">Full Body · 3× / week</span>
        <h2>Today's Session</h2>
        <p class="muted">Controlled reps. Leave about 1–3 reps in reserve. Stop or modify any movement that causes pain.</p>
        <div class="actions">
          <button class="btn secondary" onclick="WC.startRest(90)">Start 90s Rest</button>
          <button class="btn" onclick="WC.finishWorkout()">Finish Workout</button>
        </div>
        <div id="timerText" class="tiny muted" style="margin-top:9px"></div>
      </section>
      ${state.exercises.map((exercise, index) => exerciseCard(exercise, index)).join('')}
      ${otherSelectHTML}
    `;
  }

  function exerciseCard(exercise, index) {
    let switchMenuHTML = '';

    if (exercise.category && exercise.category !== 'other') {
      const options = EXERCISE_CATALOG[exercise.category] || [];
      switchMenuHTML = `
        <div style="margin-top: 10px;">
          <select class="field tiny" style="margin:0; font-size:12px; padding:4px 8px; height:auto; width:auto;" onchange="WC.changeExercise('${exercise.category}', this.value)">
            ${options.map((item) => `<option value="${item.id}" ${exercise.id === item.id ? 'selected' : ''}>🔄 Switch: ${esc(item.name)}</option>`).join('')}
          </select>
        </div>
      `;
    }

    const isTimedExercise = exercise.id === 'plank' || exercise.id === 'dead_hang';
    const timerButtonsHTML = isTimedExercise ? `
      <div class="quick-timers" style="margin: 10px 0 0; display: flex; gap: 8px;">
        <button class="btn secondary small" style="padding: 4px 8px; font-size: 12px;" onclick="WC.startRest(30)">⏱️ 30s</button>
        <button class="btn secondary small" style="padding: 4px 8px; font-size: 12px;" onclick="WC.startRest(60)">⏱️ 60s</button>
        <button class="btn secondary small" style="padding: 4px 8px; font-size: 12px;" onclick="WC.startRest(${exercise.reps})">⏱️ Target (${exercise.reps}s)</button>
      </div>
    ` : '';

    const rirOptions = Array.from({ length: 6 }, (_, idx) => idx).map((value) => `<option ${Number(exercise.rir) === value ? 'selected' : ''}>${value}</option>`).join('');

    return `
      <article class="exercise">
        <div class="exercise-head">
          <div>
            <h3>${index + 1}. ${esc(exercise.name)}</h3>
            <div class="meta">${esc(exercise.note)}</div>
            ${switchMenuHTML}
          </div>
          <span class="pill">${exercise.sets} sets</span>
        </div>
        <div class="target-box">
          <div class="tiny muted">NEXT TARGET</div>
          <b>${esc(nextTarget(exercise))}</b>
          <div class="tiny muted">Current: ${exercise.reps} ${exercise.unit === 'sec' ? 'sec' : 'reps'}${exercise.load ? ` @ ${exercise.load} kg` : ''} · RIR ${exercise.rir}</div>
        </div>
        ${timerButtonsHTML}
        <div class="controls">
          <div>
            <div class="tiny muted" style="text-align:center">${exercise.unit === 'sec' ? 'Seconds' : 'Reps'}</div>
            <div class="stepper">
              <button class="circle" onclick="WC.bump('${exercise.id}',-1)">−</button>
              <strong id="rep-${exercise.id}">${exercise.reps}</strong>
              <button class="circle" onclick="WC.bump('${exercise.id}',1)">+</button>
            </div>
          </div>
          <div>
            <div class="tiny muted">RIR</div>
            <select class="field" style="margin:0" onchange="WC.setRir('${exercise.id}', this.value)">${rirOptions}</select>
          </div>
          <div>
            <div class="tiny muted">Load</div>
            <input class="field" style="margin:0;padding:10px" type="number" step="0.5" min="0" value="${exercise.load}" onchange="WC.setLoad('${exercise.id}', this.value)">
          </div>
        </div>
      </article>
    `;
  }

  function renderProgress() {
    const rows = state.exercises.map((exercise) => `
      <div class="progress-row">
        <div>
          <b>${esc(exercise.name)}</b>
          <div class="tiny muted">${exercise.reps}/${exercise.max} reps · ${exercise.load ? `${exercise.load} kg` : 'Bodyweight'} · RIR ${exercise.rir}</div>
          <div class="bar"><i style="width:${Math.min(100, (exercise.reps / exercise.max) * 100)}%"></i></div>
        </div>
        <strong>${esc(nextTarget(exercise))}</strong>
      </div>
    `).join('');

    const body = state.bodyLog.slice(-8);
    $('#main').innerHTML = `
      <section class="hero">
        <span class="pill good">Progressive Overload Engine</span>
        <h2>Progress</h2>
        <p class="muted">The rule is simple: add reps inside the range; once the top of the range is reached, add load or difficulty.</p>
      </section>
      <div class="card"><h3>Exercise progression</h3>${rows}</div>
      <div class="card">
        <h3>Body trend</h3>
        ${body.length < 2 ? '<div class="empty">Add at least two weight/waist entries in Settings to see your trend.</div>' : '<canvas id="bodyChart" class="chart" width="900" height="300"></canvas>'}
      </div>
    `;

    if (body.length >= 2) drawChart(body);
  }

  function drawChart(data) {
    const canvas = $('#bodyChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const values = data.map((point) => Number(point.weight)).filter(Boolean);
    if (!values.length) return;

    const min = Math.min(...values) - 1;
    const max = Math.max(...values) + 1;

    ctx.strokeStyle = '#263247';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = 30 + i * (height - 60) / 4;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#62d6a7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    data.forEach((point, index) => {
      const x = 45 + index * (width - 75) / Math.max(1, data.length - 1);
      const y = 30 + (max - Number(point.weight)) / (max - min) * (height - 60);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    ctx.fillStyle = '#f4f7fb';
    ctx.font = '14px system-ui';
    ctx.fillText(`${max.toFixed(1)} kg`, 45, 22);
    ctx.fillText(`${min.toFixed(1)} kg`, 45, height - 8);
  }

  function renderHistory() {
    if (!state.history.length) {
      $('#main').innerHTML = `<div class="empty">No completed workouts yet.<br><br><button class="btn" onclick="WC.go('workout')">Start Workout</button></div>`;
      return;
    }

    $('#main').innerHTML = state.history.map((entry) => `
      <article class="card">
        <div class="section-title" style="margin:0 0 8px">
          <h3>${fmtDate(entry.date)}</h3>
          <span class="pill good">Completed</span>
        </div>
        <table class="table">
          <thead>
            <tr><th>Exercise</th><th>Reps</th><th>Load</th><th>RIR</th></tr>
          </thead>
          <tbody>
            ${entry.exercises.map((exercise) => `
              <tr>
                <td>${esc(exercise.name)}</td>
                <td>${exercise.reps} × ${exercise.sets}</td>
                <td>${exercise.load ? `${exercise.load} kg` : 'BW'}</td>
                <td>${exercise.rir}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </article>
    `).join('');
  }

  function renderSettings() {
    $('#main').innerHTML = `
      <section class="card">
        <h3>Profile</h3>
        <div class="form-grid">
          <div class="field"><label>Body weight (kg)</label><input id="weight" type="number" step="0.1" value="${esc(state.profile.weight)}"></div>
          <div class="field"><label>Waist (cm)</label><input id="waist" type="number" step="0.1" value="${esc(state.profile.waist)}"></div>
        </div>
        <button class="btn" onclick="WC.saveProfile()">Save profile</button>
      </section>
      <section class="card">
        <h3>Cloud account</h3>
        <div class="status ${state.user ? 'ok' : ''}">${state.user ? `Signed in: ${esc(state.user.email)}` : 'Not signed in'}</div>
        <div class="actions">
          ${state.user ? '<button class="btn secondary" onclick="WC.sync()">Sync now</button><button class="btn danger" onclick="WC.logout()">Sign out</button>' : '<button class="btn" onclick="WC.goAuth()">Sign in / Create account</button>'}
        </div>
        <p class="tiny muted" style="margin-top:10px">Cloud sync needs Supabase URL + anon/publishable key in <code>config.js</code>. Local mode works without it.</p>
      </section>
      <section class="card">
        <h3>Backup</h3>
        <p class="tiny muted">Export a JSON backup before making major changes. Import replaces local data.</p>
        <div class="actions">
          <button class="btn secondary" onclick="WC.exportData()">Export backup</button>
          <label class="btn secondary">Import backup<input id="importFile" type="file" accept="application/json" hidden></label>
        </div>
      </section>
      <section class="card">
        <h3>App</h3>
        <p class="tiny muted">Workout Control v3 · PWA · local-first · optional Supabase sync.</p>
        <button class="btn danger" onclick="WC.resetLocal()">Reset local data</button>
      </section>
    `;

    const importInput = $('#importFile');
    if (importInput) importInput.onchange = importData;
  }

  function changeExercise(category, newExerciseId) {
    if (!newExerciseId) {
      if (category === 'other') {
        state.exercises = state.exercises.filter((exercise) => exercise.category !== 'other');
      }
      save();
      render();
      return;
    }

    const catalogList = EXERCISE_CATALOG[category];
    const newExercise = catalogList && catalogList.find((item) => item.id === newExerciseId);
    if (!newExercise) return;

    if (category !== 'other') {
      const index = state.exercises.findIndex((exercise) => exercise.category === category);
      if (index !== -1) {
        state.exercises[index].id = newExercise.id;
        state.exercises[index].name = newExercise.name;
        state.exercises[index].unit = newExercise.unit;
        state.exercises[index].load = newExercise.unit === 'kg' ? 20 : 0;
        state.exercises[index].reps = newExercise.unit === 'sec' ? 30 : 8;
      }
    } else {
      const index = state.exercises.findIndex((exercise) => exercise.category === 'other');
      const newOtherData = {
        id: newExercise.id,
        name: newExercise.name,
        category: 'other',
        min: 5,
        max: 100,
        load: newExercise.unit === 'kg' ? 10 : 0,
        reps: newExercise.unit === 'sec' ? 60 : 10,
        sets: 3,
        rir: 1,
        unit: newExercise.unit,
        note: ''
      };

      if (index !== -1) {
        state.exercises[index] = newOtherData;
      } else {
        state.exercises.push(newOtherData);
      }
    }

    save();
    if (state.user && typeof sync === 'function') sync();
    render();
  }

  async function saveProfile() {
    state.profile.weight = $('#weight').value;
    state.profile.waist = $('#waist').value;

    state.bodyLog.unshift({
      date: new Date().toISOString(),
      weight: Number(state.profile.weight) || null,
      waist: Number(state.profile.waist) || null
    });
    state.bodyLog = state.bodyLog.slice(0, 30);

    save();
    toast('Profile saved locally');

    if (state.user && typeof sync === 'function') {
      try {
        toast('Syncing with Supabase...');
        await sync();
      } catch (error) {
        console.error(error);
        toast('Cloud sync failed, saved locally');
      }
    }
  }

  async function bump(id, delta) {
    const exercise = state.exercises.find((item) => item.id === id);
    if (!exercise) return;

    exercise.reps = Math.max(0, Math.min(exercise.max, exercise.reps + delta));
    save();

    const element = $(`#rep-${id}`);
    if (element) element.textContent = exercise.reps;

    if (state.user && typeof sync === 'function') {
      await sync();
    }
  }

  async function setRir(id, value) {
    const exercise = state.exercises.find((item) => item.id === id);
    if (!exercise) return;

    exercise.rir = Number(value);
    save();

    if (state.user && typeof sync === 'function') {
      await sync();
    }
  }

  async function setLoad(id, value) {
    const exercise = state.exercises.find((item) => item.id === id);
    if (!exercise) return;

    exercise.load = Math.max(0, Number(value) || 0);
    save();

    if (state.user && typeof sync === 'function') {
      await sync();
    }
  }

  function finishWorkout() {
    const now = new Date().toISOString();
    const log = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      date: now,
      exercises: state.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        reps: exercise.reps,
        sets: exercise.sets,
        load: exercise.load,
        rir: exercise.rir
      }))
    };

    state.history.unshift(log);
    state.history = state.history.slice(0, 100);
    state.lastSync = null;
    save();
    toast('Workout completed');
    if (state.user) sync();
    render();
  }

  function startRest(sec) {
    clearInterval(timer);
    remaining = sec;
    updateTimer();
    timer = setInterval(() => {
      remaining -= 1;
      updateTimer();
      if (remaining <= 0) {
        clearInterval(timer);
        toast('Rest complete');
        navigator.vibrate?.([150, 80, 150]);
      }
    }, 1000);
  }

  function updateTimer() {
    const element = $('#timerText');
    if (!element) return;
    element.textContent = remaining
      ? `Rest timer: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
      : '';
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `workout-control-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.exercises || !parsed.history) throw new Error('Invalid backup');
        state = { ...defaultState, ...parsed };
        save();
        render();
        toast('Backup imported');
      } catch {
        toast('Invalid backup');
      }
    };
    reader.readAsText(file);
  }

  function resetLocal() {
    if (confirm('Reset all local workout data on this device?')) {
      localStorage.removeItem(KEY);
      state = structuredClone(defaultState);
      render();
      toast('Local data reset');
    }
  }

  async function sync() {
    if (!supabaseClient || !state.user) {
      toast('Cloud sync is not available');
      return;
    }

    await pushCloud();
    await pullCloud();
    state.lastSync = new Date().toISOString();
    save();
    toast('Synced');
    render();
  }

  async function pushCloud() {
    const uid = state.user.id;

    const profile = {
      user_id: uid,
      weight: Number(state.profile.weight) || null,
      waist: Number(state.profile.waist) || null,
      updated_at: new Date().toISOString()
    };

    const { error: profileError } = await supabaseClient.from('profiles').upsert(profile, { onConflict: 'user_id' });
    if (profileError) throw profileError;

    const exerciseRows = state.exercises.map((exercise) => ({
      user_id: uid,
      exercise_id: exercise.id,
      name: exercise.name,
      type: exercise.category,
      min_reps: exercise.min,
      max_reps: exercise.max,
      load: exercise.load,
      unit: exercise.unit,
      reps: exercise.reps,
      rir: exercise.rir,
      sets: exercise.sets,
      note: exercise.note,
      updated_at: new Date().toISOString()
    }));

    const { error: exerciseError } = await supabaseClient.from('exercise_state').upsert(exerciseRows, { onConflict: 'user_id,exercise_id' });
    if (exerciseError) throw exerciseError;

    if (state.history.length) {
      const rows = state.history.map((entry) => ({
        id: entry.id,
        user_id: uid,
        workout_date: entry.date,
        payload: entry
      }));
      const { error: historyError } = await supabaseClient.from('workout_history').upsert(rows, { onConflict: 'id' });
      if (historyError) throw historyError;
    }
  }

  async function pullCloud() {
    if (!supabaseClient || !state.user) return;

    const uid = state.user.id;
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('user_id', uid).maybeSingle();
    if (profile) {
      state.profile.weight = profile.weight ?? '';
      state.profile.waist = profile.waist ?? '';
    }

    const { data: exerciseRows } = await supabaseClient.from('exercise_state').select('*').eq('user_id', uid);
    if (exerciseRows && exerciseRows.length) {
      state.exercises = state.exercises.map((exercise) => {
        const saved = exerciseRows.find((row) => row.exercise_id === exercise.id);
        return saved ? { ...exercise, reps: saved.reps, rir: saved.rir, load: saved.load, sets: saved.sets } : exercise;
      });
    }

    const { data: historyRows } = await supabaseClient.from('workout_history').select('payload').eq('user_id', uid).order('workout_date', { ascending: false }).limit(100);
    if (historyRows) {
      state.history = historyRows.map((row) => row.payload).filter(Boolean);
    }

    save();
  }

  async function logout() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    state.user = null;
    save();
    render();
    toast('Signed out');
  }

  let supabaseClient = null;
  const cfg = window.WORKOUT_CONFIG || {};

  if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    supabaseClient.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        state.user = data.session.user;
        await pullCloud();
        render();
      }
    }).catch(() => {});

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      state.user = session?.user || null;
      save();
      render();
    });
  }

  window.WC = {
    go: (target) => {
      page = target;
      render();
    },
    goAuth: () => {
      page = 'auth';
      render();
    },
    bump,
    setRir,
    setLoad,
    finishWorkout,
    startRest,
    saveProfile,
    exportData,
    resetLocal,
    sync,
    logout,
    changeExercise
  };

  $$('.nav-btn').forEach((button) => {
    button.onclick = () => {
      page = button.dataset.nav;
      render();
    };
  });

  const syncButton = $('#syncBtn');
  if (syncButton) {
    syncButton.onclick = () => (state.user ? sync() : toast('Local mode'));
  }

  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
