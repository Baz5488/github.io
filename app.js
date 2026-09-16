```javascript
(() => {
  const KEY = 'workout_control_v3';

  // =========================================================
  // EXERCISE CATALOG
  // =========================================================

  const EXERCISE_CATALOG = {
    pull: [
      { id: 'inverted_row', name: 'Inverted Row', unit: 'reps' },
      { id: 'pull_up', name: 'Pull Up', unit: 'reps' },
      { id: 'dead_hang', name: 'Dead Hang', unit: 'sec' }
    ],

    squat: [
      {
        id: 'bulgarian_split_squat',
        name: 'Bulgarian Split Squat',
        unit: 'kg'
      }
    ],

    push: [
      { id: 'push_up', name: 'Push Up', unit: 'reps' },
      { id: 'shoulder_press', name: 'Shoulder Press', unit: 'kg' }
    ],

    hinge: [
      {
        id: 'romanian_deadlift',
        name: 'Romanian Deadlift',
        unit: 'kg'
      },
      {
        id: 'kettlebell_swing',
        name: 'Kettlebell Swing',
        unit: 'kg'
      }
    ],

    other: [
      { id: 'plank', name: 'Plank', unit: 'sec' },
      { id: 'barbell_curl', name: 'Barbell Curl', unit: 'kg' }
    ]
  };


  // =========================================================
  // DEFAULT STATE
  // =========================================================

  const defaultState = {
    profile: {
      weight: '',
      waist: ''
    },

    user: null,

    exercises: [
      {
        id: 'inverted_row',
        name: 'Inverted Row',
        category: 'pull',
        min: 5,
        max: 20,
        load: 0,
        reps: 10,
        sets: 3,
        rir: 2,
        unit: 'reps',
        note: ''
      },

      {
        id: 'bulgarian_split_squat',
        name: 'Bulgarian Split Squat',
        category: 'squat',
        min: 5,
        max: 20,
        load: 10,
        reps: 8,
        sets: 3,
        rir: 2,
        unit: 'kg',
        note: ''
      },

      {
        id: 'push_up',
        name: 'Push Up',
        category: 'push',
        min: 5,
        max: 30,
        load: 0,
        reps: 12,
        sets: 3,
        rir: 2,
        unit: 'reps',
        note: ''
      },

      {
        id: 'romanian_deadlift',
        name: 'Romanian Deadlift',
        category: 'hinge',
        min: 5,
        max: 20,
        load: 40,
        reps: 10,
        sets: 3,
        rir: 2,
        unit: 'kg',
        note: ''
      }
    ],

    bodyLog: [],
    history: [],
    lastSync: null
  };


  // =========================================================
  // APP STATE
  // =========================================================

  let state = load();
  let page = 'home';
  let timer = null;
  let remaining = 0;
  let supabaseClient = null;


  // =========================================================
  // HELPERS
  // =========================================================

  const $ = selector => document.querySelector(selector);

  const $$ = selector => [
    ...document.querySelectorAll(selector)
  ];


  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(defaultState));
  }


  function load() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(KEY) || '{}'
      );

      return {
        ...cloneDefaultState(),
        ...saved,

        profile: {
          ...defaultState.profile,
          ...(saved.profile || {})
        },

        exercises:
          Array.isArray(saved.exercises) && saved.exercises.length
            ? saved.exercises
            : cloneDefaultState().exercises,

        bodyLog:
          Array.isArray(saved.bodyLog)
            ? saved.bodyLog
            : [],

        history:
          Array.isArray(saved.history)
            ? saved.history
            : []
      };

    } catch (error) {
      console.warn('Could not load local data:', error);
      return cloneDefaultState();
    }
  }


  function save() {
    localStorage.setItem(
      KEY,
      JSON.stringify(state)
    );
  }


  function toast(message) {
    const element = $('#toast');

    if (!element) return;

    element.textContent = message;
    element.classList.add('show');

    setTimeout(() => {
      element.classList.remove('show');
    }, 1800);
  }


  function esc(value) {
    return String(value ?? '').replace(
      /[&<>'"]/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[character])
    );
  }


  function fmtDate(date) {
    return new Date(date).toLocaleDateString(
      undefined,
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }
    );
  }


  function nextTarget(exercise) {
    if (exercise.reps < exercise.max) {
      return `${exercise.reps + 1} reps × ${exercise.sets} sets`;
    }

    if (exercise.load > 0) {
      return `${Number(exercise.load) + 2.5} kg × ${exercise.max} reps`;
    }

    return `Increase difficulty × ${exercise.max} reps`;
  }


  function status(exercise) {
    if (exercise.reps < exercise.min) {
      return ['Build volume', 'warn'];
    }

    if (exercise.reps < exercise.max) {
      return ['Add 1 rep', 'good'];
    }

    if (exercise.load > 0) {
      return ['Add 2.5 kg', 'good'];
    }

    return ['Increase difficulty', 'good'];
  }


  function weeklyCount() {
    const weekAgo =
      Date.now() - 6 * 86400000;

    return state.history.filter(
      workout =>
        new Date(workout.date).getTime() >= weekAgo
    ).length;
  }


  // =========================================================
  // RENDER ROUTER
  // =========================================================

  function render() {
    const titles = {
      home: 'Dashboard',
      workout: 'Workout',
      progress: 'Progress',
      history: 'History',
      settings: 'Settings',
      auth: 'Sign in'
    };

    const title = $('#pageTitle');

    if (title) {
      title.textContent =
        titles[page] || 'Dashboard';
    }

    $$('.nav-btn').forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.nav === page
      );
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


  // =========================================================
  // AUTH
  // =========================================================

  function renderAuth() {
    $('#main').innerHTML = `
      <div class="auth-wrap">
        <section class="auth">

          <div class="eyebrow">
            WORKOUT CONTROL
          </div>

          <h2>
            Sign in to sync your training
          </h2>

          <p class="muted">
            You can use the app locally without an account.
            Sign in only when you want cloud sync across devices.
          </p>

          <div id="authStatus" class="status">
            Cloud sync is optional.
          </div>

          <div class="field">
            <label>Email</label>
            <input
              id="email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
            >
          </div>

          <div class="field">
            <label>Password</label>
            <input
              id="password"
              type="password"
              autocomplete="current-password"
              placeholder="At least 6 characters"
            >
          </div>

          <div class="actions">
            <button class="btn" id="login">
              Sign in
            </button>

            <button class="btn secondary" id="signup">
              Create account
            </button>
          </div>

          <p
            class="tiny muted"
            style="margin-top:12px"
          >
            No Supabase configuration?
            Use Settings → Local mode.
          </p>

        </section>
      </div>
    `;

    $('#login').onclick =
      () => auth('login');

    $('#signup').onclick =
      () => auth('signup');
  }


  async function auth(mode) {
    if (!supabaseClient) {
      $('#authStatus').textContent =
        'Cloud database is not configured. Check config.js.';

      $('#authStatus').className =
        'status error';

      return;
    }

    const email =
      $('#email').value.trim();

    const password =
      $('#password').value;

    if (
      !email ||
      password.length < 6
    ) {
      $('#authStatus').textContent =
        'Enter a valid email and a password of at least 6 characters.';

      $('#authStatus').className =
        'status error';

      return;
    }

    $('#authStatus').textContent =
      'Working…';

    try {
      const result =
        mode === 'login'
          ? await supabaseClient.auth.signInWithPassword({
              email,
              password
            })
          : await supabaseClient.auth.signUp({
              email,
              password
            });

      if (result.error) {
        $('#authStatus').textContent =
          result.error.message;

        $('#authStatus').className =
          'status error';

        return;
      }

      if (
        mode === 'signup' &&
        !result.data.session
      ) {
        $('#authStatus').textContent =
          'Account created. Check your email if confirmation is enabled.';

        $('#authStatus').className =
          'status ok';

        return;
      }

      state.user =
        result.data.user;

      save();

      await pullCloud();

      render();

      toast('Signed in');

    } catch (error) {
      console.error(error);

      $('#authStatus').textContent =
        error.message ||
        'Authentication failed.';

      $('#authStatus').className =
        'status error';
    }
  }


  // =========================================================
  // HOME
  // =========================================================

  function renderHome() {
    const today =
      new Date().toLocaleDateString(
        undefined,
        {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        }
      );

    const last =
      state.history[0];

    $('#main').innerHTML = `
      <section class="hero">

        <span class="pill good">
          ${today}
        </span>

        <h2>
          ${
            last
              ? 'Ready for your next session.'
              : 'Start your first session.'
          }
        </h2>

        <p class="muted">
          Log every set, then let the app recommend
          your next progressive-overload target.
        </p>

        <div class="actions">

          <button
            class="btn"
            onclick="window.WC.go('workout')"
          >
            Start Workout
          </button>

          ${
            last
              ? `
                <button
                  class="btn secondary"
                  onclick="window.WC.go('history')"
                >
                  Last Session
                </button>
              `
              : ''
          }

        </div>

      </section>

      <div class="grid grid3">

        <div class="stat">
          <div class="label">
            7-day workouts
          </div>
          <div class="value">
            ${weeklyCount()}
          </div>
        </div>

        <div class="stat">
          <div class="label">
            Weight
          </div>
          <div class="value">
            ${
              state.profile.weight
                ? `${esc(state.profile.weight)} kg`
                : '—'
            }
          </div>
        </div>

        <div class="stat">
          <div class="label">
            Waist
          </div>
          <div class="value">
            ${
              state.profile.waist
                ? `${esc(state.profile.waist)} cm`
                : '—'
            }
          </div>
        </div>

      </div>

      <div class="section-title">
        <h2>Next targets</h2>
        <span class="pill">Automatic</span>
      </div>

      <div class="card">

        ${
          state.exercises
            .map(exercise => {
              const [label, color] =
                status(exercise);

              return `
                <div class="progress-row">

                  <div>

                    <b>
                      ${esc(exercise.name)}
                    </b>

                    <div class="tiny muted">
                      Current:
                      ${exercise.reps}
                      ${exercise.unit === 'sec'
                        ? 'sec'
                        : 'reps'}
                      ${
                        exercise.load
                          ? ` @ ${exercise.load} kg`
                          : ''
                      }
                      · RIR ${exercise.rir}
                    </div>

                    <div class="bar">
                      <i
                        style="
                          width:
                          ${Math.min(
                            100,
                            Math.round(
                              exercise.reps /
                              exercise.max *
                              100
                            )
                          )}%
                        "
                      ></i>
                    </div>

                  </div>

                  <span class="pill ${color}">
                    ${esc(label)}
                  </span>

                </div>
              `;
            })
            .join('')
        }

      </div>

      <div class="card">

        <h3>
          Cloud status
        </h3>

        <p class="tiny muted">

          ${
            state.user
              ? `
                Signed in as
                ${esc(state.user.email)}.
                Last sync:
                ${
                  state.lastSync
                    ? fmtDate(state.lastSync)
                    : 'not yet synced'
                }.
              `
              : `
                Local mode.
                Your data is stored on this device
                until you sign in.
              `
          }

        </p>

      </div>
    `;
  }


  // =========================================================
  // WORKOUT
  // =========================================================

  function renderWorkout() {

    const existingOther =
      state.exercises.find(
        exercise =>
          exercise.category === 'other'
      );

    const currentOtherId =
      existingOther
        ? existingOther.id
        : '';


    const otherSelectHTML = `
      <section
        class="card"
        style="
          margin-top:15px;
          padding:12px;
        "
      >

        <div
          class="tiny muted"
          style="margin-bottom:5px"
        >
          ➕ Add 5th Exercise (Optional)
        </div>

        <select
          class="field"
          style="
            margin:0;
            width:100%;
          "
          onchange="
            WC.changeExercise(
              'other',
              this.value
            )
          "
        >

          <option value="">
            -- No Extra Exercise --
          </option>

          ${
            EXERCISE_CATALOG.other
              .map(exercise => `
                <option
                  value="${exercise.id}"
                  ${
                    currentOtherId === exercise.id
                      ? 'selected'
                      : ''
                  }
                >
                  ${esc(exercise.name)}
                </option>
              `)
              .join('')
          }

        </select>

      </section>
    `;


    $('#main').innerHTML = `

      <section class="hero">

        <span class="pill">
          Full Body · 3× / week
        </span>

        <h2>
          Today's Session
        </h2>

        <p class="muted">
          Controlled reps. Leave about 1–3 reps
          in reserve. Stop or modify any movement
          that causes pain.
        </p>

        <div class="actions">

          <button
            class="btn secondary"
            onclick="WC.startRest(90)"
          >
            Start 90s Rest
          </button>

          <button
            class="btn"
            onclick="WC.finishWorkout()"
          >
            Finish Workout
          </button>

        </div>

        <div
          id="timerText"
          class="tiny muted"
          style="margin-top:9px"
        ></div>

      </section>

      ${
        state.exercises
          .map(
            (exercise, index) =>
              exerciseCard(
                exercise,
                index
              )
          )
          .join('')
      }

      ${otherSelectHTML}

    `;
  }


  // =========================================================
  // EXERCISE CARD
  // =========================================================

  function exerciseCard(exercise, index) {

    let switchMenuHTML = '';

    if (
      exercise.category &&
      exercise.category !== 'other'
    ) {

      const options =
        EXERCISE_CATALOG[
          exercise.category
        ] || [];

      switchMenuHTML = `
        <div style="margin-top:10px">

          <select
            class="field tiny"
            style="
              margin:0;
              font-size:12px;
              padding:4px 8px;
              height:auto;
              width:auto;
            "
            onchange="
              WC.changeExercise(
                '${exercise.category}',
                this.value
              )
            "
          >

            ${
              options
                .map(option => `
                  <option
                    value="${option.id}"
                    ${
                      exercise.id === option.id
                        ? 'selected'
                        : ''
                    }
                  >
                    🔄 Switch:
                    ${esc(option.name)}
                  </option>
                `)
                .join('')
            }

          </select>

        </div>
      `;
    }


    const isTimedExercise =
      exercise.id === 'plank' ||
      exercise.id === 'dead_hang';


    const timerButtonsHTML =
      isTimedExercise
        ? `
          <div
            class="quick-timers"
            style="
              margin:10px 0 0;
              display:flex;
              gap:8px;
            "
          >

            <button
              class="btn secondary small"
              style="
                padding:4px 8px;
                font-size:12px;
              "
              onclick="WC.startRest(30)"
            >
              ⏱️ 30s
            </button>

            <button
              class="btn secondary small"
              style="
                padding:4px 8px;
                font-size:12px;
              "
              onclick="WC.startRest(60)"
            >
              ⏱️ 60s
            </button>

            <button
              class="btn secondary small"
              style="
                padding:4px 8px;
                font-size:12px;
              "
              onclick="
                WC.startRest(${exercise.reps})
              "
            >
              ⏱️ Target (${exercise.reps}s)
            </button>

          </div>
        `
        : '';


    const rirOptions =
      Array.from(
        { length: 6 },
        (_, index) => index
      )
      .map(
        value => `
          <option
            ${
              Number(exercise.rir) === value
                ? 'selected'
                : ''
            }
          >
            ${value}
          </option>
        `
      )
      .join('');


    return `
      <article class="exercise">

        <div class="exercise-head">

          <div>

            <h3>
              ${index + 1}.
              ${esc(exercise.name)}
            </h3>

            <div class="meta">
              ${esc(exercise.note || '')}
            </div>

            ${switchMenuHTML}

          </div>

          <span class="pill">
            ${exercise.sets} sets
          </span>

        </div>


        <div class="target-box">

          <div class="tiny muted">
            NEXT TARGET
          </div>

          <b>
            ${esc(nextTarget(exercise))}
          </b>

          <div class="tiny muted">

            Current:
            ${exercise.reps}
            ${
              exercise.unit === 'sec'
                ? 'sec'
                : 'reps'
            }

            ${
              exercise.load
                ? ` @ ${exercise.load} kg`
                : ''
            }

            · RIR ${exercise.rir}

          </div>

        </div>


        ${timerButtonsHTML}


        <div class="controls">

          <div>

            <div
              class="tiny muted"
              style="text-align:center"
            >
              ${
                exercise.unit === 'sec'
                  ? 'Seconds'
                  : 'Reps'
              }
            </div>

            <div class="stepper">

              <button
                class="circle"
                onclick="
                  WC.bump(
                    '${exercise.id}',
                    -1
                  )
                "
              >
                −
              </button>

              <strong
                id="rep-${exercise.id}"
              >
                ${exercise.reps}
              </strong>

              <button
                class="circle"
                onclick="
                  WC.bump(
                    '${exercise.id}',
                    1
                  )
                "
              >
                +
              </button>

            </div>

          </div>


          <div>

            <div class="tiny muted">
              RIR
            </div>

            <select
              class="field"
              style="margin:0"
              onchange="
                WC.setRir(
                  '${exercise.id}',
                  this.value
                )
              "
            >
              ${rirOptions}
            </select>

          </div>


          <div>

            <div class="tiny muted">
              Load
            </div>

            <input
              class="field"
              style="
                margin:0;
                padding:10px
              "
              type="number"
              step="0.5"
              min="0"
              value="${exercise.load}"
              onchange="
                WC.setLoad(
                  '${exercise.id}',
                  this.value
                )
              "
            >

          </div>

        </div>

      </article>
    `;
  }


  // =========================================================
  // EXERCISE SWITCHING
  // =========================================================

  function changeExercise(
    category,
    newExerciseId
  ) {

    // Removing optional 5th exercise
    if (!newExerciseId) {

      if (category === 'other') {

        state.exercises =
          state.exercises.filter(
            exercise =>
              exercise.category !== 'other'
          );

        save();

        if (state.user) {
          sync().catch(console.error);
        }

        render();
      }

      return;
    }


    const catalogList =
      EXERCISE_CATALOG[category];

    if (!catalogList) return;


    const newExercise =
      catalogList.find(
        exercise =>
          exercise.id === newExerciseId
      );

    if (!newExercise) return;


    // -------------------------------------------------------
    // Main 4 exercise slots
    // -------------------------------------------------------

    if (category !== 'other') {

      const index =
        state.exercises.findIndex(
          exercise =>
            exercise.category === category
        );

      if (index === -1) return;


      const old =
        state.exercises[index];


      state.exercises[index] = {
        ...old,

        id: newExercise.id,
        name: newExercise.name,
        unit: newExercise.unit,

        min:
          newExercise.unit === 'sec'
            ? 10
            : 5,

        max:
          newExercise.unit === 'sec'
            ? 120
            : old.max,

        load:
          newExercise.unit === 'kg'
            ? Math.max(
                0,
                Number(old.load) || 20
              )
            : 0,

        reps:
          newExercise.unit === 'sec'
            ? 30
            : old.reps,

        note: old.note || ''
      };

    }

    // -------------------------------------------------------
    // Optional 5th exercise
    // -------------------------------------------------------

    else {

      const index =
        state.exercises.findIndex(
          exercise =>
            exercise.category === 'other'
        );


      const newOtherData = {
        id: newExercise.id,
        name: newExercise.name,
        category: 'other',

        min:
          newExercise.unit === 'sec'
            ? 10
            : 5,

        max:
          newExercise.unit === 'sec'
            ? 120
            : 100,

        load:
          newExercise.unit === 'kg'
            ? 10
            : 0,

        reps:
          newExercise.unit === 'sec'
            ? 60
            : 10,

        sets: 3,
        rir: 1,
        unit: newExercise.unit,
        note: ''
      };


      if (index !== -1) {
        state.exercises[index] =
          newOtherData;
      } else {
        state.exercises.push(
          newOtherData
        );
      }
    }


    save();

    if (state.user) {
      sync().catch(error =>
        console.error(
          'Background sync failed:',
          error
        )
      );
    }

    render();
  }


  // =========================================================
  // PROGRESS
  // =========================================================

  function renderProgress() {

    const rows =
      state.exercises
        .map(exercise => `
          <div class="progress-row">

            <div>

              <b>
                ${esc(exercise.name)}
              </b>

              <div class="tiny muted">

                ${exercise.reps}/${exercise.max}
                ${
                  exercise.unit === 'sec'
                    ? 'sec'
                    : 'reps'
                }

                ·
                ${
                  exercise.load
                    ? exercise.load + ' kg'
                    : 'Bodyweight'
                }

                · RIR ${exercise.rir}

              </div>

              <div class="bar">

                <i
                  style="
                    width:
                    ${Math.min(
                      100,
                      exercise.reps /
                      exercise.max *
                      100
                    )}%
                  "
                ></i>

              </div>

            </div>

            <strong>
              ${esc(nextTarget(exercise))}
            </strong>

          </div>
        `)
        .join('');


    const body =
      state.bodyLog.slice(-8);


    $('#main').innerHTML = `

      <section class="hero">

        <span class="pill good">
          Progressive Overload Engine
        </span>

        <h2>
          Progress
        </h2>

        <p class="muted">
          Add reps inside the range.
          Once the top of the range is reached,
          add load or difficulty.
        </p>

      </section>


      <div class="card">

        <h3>
          Exercise progression
        </h3>

        ${rows}

      </div>


      <div class="card">

        <h3>
          Body trend
        </h3>

        ${
          body.length < 2

            ? `
              <div class="empty">
                Add at least two weight/waist
                entries in Settings to see your trend.
              </div>
            `

            : `
              <canvas
                id="bodyChart"
                class="chart"
                width="900"
                height="300"
              ></canvas>
            `
        }

      </div>

    `;


    if (body.length >= 2) {
      drawChart(body);
    }
  }


  function drawChart(data) {

    const canvas =
      $('#bodyChart');

    if (!canvas) return;


    const context =
      canvas.getContext('2d');

    const width =
      canvas.width;

    const height =
      canvas.height;


    context.clearRect(
      0,
      0,
      width,
      height
    );


    const values =
      data
        .map(item =>
          Number(item.weight)
        )
        .filter(Boolean);


    if (!values.length) return;


    const min =
      Math.min(...values) - 1;

    const max =
      Math.max(...values) + 1;


    context.strokeStyle =
      '#263247';

    context.lineWidth = 1;


    for (let i = 0; i < 5; i++) {

      const y =
        30 +
        i *
        (height - 60) /
        4;

      context.beginPath();

      context.moveTo(
        40,
        y
      );

      context.lineTo(
        width - 20,
        y
      );

      context.stroke();
    }


    context.strokeStyle =
      '#62d6a7';

    context.lineWidth = 4;

    context.beginPath();


    data.forEach(
      (point, index) => {

        const x =
          45 +
          index *
          (width - 75) /
          Math.max(
            1,
            data.length - 1
          );


        const y =
          30 +
          (
            max -
            Number(point.weight)
          ) /
          (max - min) *
          (height - 60);


        if (index) {
          context.lineTo(x, y);
        } else {
          context.moveTo(x, y);
        }
      }
    );


    context.stroke();


    context.fillStyle =
      '#f4f7fb';

    context.font =
      '14px system-ui';


    context.fillText(
      `${max.toFixed(1)} kg`,
      45,
      22
    );


    context.fillText(
      `${min.toFixed(1)} kg`,
      45,
      height - 8
    );
  }


  // =========================================================
  // HISTORY
  // =========================================================

  function renderHistory() {

    if (!state.history.length) {

      $('#main').innerHTML = `
        <div class="empty">

          No completed workouts yet.

          <br><br>

          <button
            class="btn"
            onclick="WC.go('workout')"
          >
            Start Workout
          </button>

        </div>
      `;

      return;
    }


    $('#main').innerHTML =
      state.history
        .map(workout => `

          <article class="card">

            <div
              class="section-title"
              style="margin:0 0 8px"
            >

              <h3>
                ${fmtDate(workout.date)}
              </h3>

              <span class="pill good">
                Completed
              </span>

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

                ${workout.exercises
                  .map(exercise => `

                    <tr>

                      <td>
                        ${esc(exercise.name)}
                      </td>

                      <td>
                        ${exercise.reps}
                        ×
                        ${exercise.sets}
                      </td>

                      <td>
                        ${
                          exercise.load
                            ? exercise.load + ' kg'
                            : 'BW'
                        }
                      </td>

                      <td>
                        ${exercise.rir}
                      </td>

                    </tr>

                  `)
                  .join('')}

              </tbody>

            </table>

          </article>

        `)
        .join('');
  }


  // =========================================================
  // SETTINGS
  // =========================================================

  function renderSettings() {

    $('#main').innerHTML = `

      <section class="card">

        <h3>
          Profile
        </h3>

        <div class="form-grid">

          <div class="field">

            <label>
              Body weight (kg)
            </label>

            <input
              id="weight"
              type="number"
              step="0.1"
              value="${esc(
                state.profile.weight
              )}"
            >

          </div>


          <div class="field">

            <label>
              Waist (cm)
            </label>

            <input
              id="waist"
              type="number"
              step="0.1"
              value="${esc(
                state.profile.waist
              )}"
            >

          </div>

        </div>


        <button
          class="btn"
          onclick="WC.saveProfile()"
        >
          Save profile
        </button>

      </section>


      <section class="card">

        <h3>
          Cloud account
        </h3>

        <div
          class="status ${
            state.user ? 'ok' : ''
          }"
        >

          ${
            state.user
              ? `Signed in: ${esc(state.user.email)}`
              : 'Not signed in'
          }

        </div>


        <div class="actions">

          ${
            state.user

              ? `
                <button
                  class="btn secondary"
                  onclick="WC.sync()"
                >
                  Sync now
                </button>

                <button
                  class="btn danger"
                  onclick="WC.logout()"
                >
                  Sign out
                </button>
              `

              : `
                <button
                  class="btn"
                  onclick="WC.goAuth()"
                >
                  Sign in / Create account
                </button>
              `
          }

        </div>


        <p
          class="tiny muted"
          style="margin-top:10px"
        >
          Cloud sync needs Supabase URL +
          anon/publishable key in config.js.
          Local mode works without it.
        </p>

      </section>


      <section class="card">

        <h3>
          Backup
        </h3>

        <p class="tiny muted">
          Export a JSON backup before making
          major changes. Import replaces local data.
        </p>


        <div class="actions">

          <button
            class="btn secondary"
            onclick="WC.exportData()"
          >
            Export backup
          </button>


          <label class="btn secondary">

            Import backup

            <input
              id="importFile"
              type="file"
              accept="application/json"
              hidden
            >

          </label>

        </div>

      </section>


      <section class="card">

        <h3>
          App
        </h3>

        <p class="tiny muted">
          Workout Control v3 · PWA · local-first ·
          optional Supabase sync.
        </p>


        <button
          class="btn danger"
          onclick="WC.resetLocal()"
        >
          Reset local data
        </button>

      </section>

    `;


    const importInput =
      $('#importFile');

    if (importInput) {
      importInput.onchange =
        importData;
    }
  }


  // =========================================================
  // PROFILE
  // =========================================================

  async function saveProfile() {

    state.profile.weight =
      $('#weight').value;

    state.profile.waist =
      $('#waist').value;


    state.bodyLog.unshift({

      date:
        new Date().toISOString(),

      weight:
        Number(state.profile.weight) ||
        null,

      waist:
        Number(state.profile.waist) ||
        null

    });


    state.bodyLog =
      state.bodyLog.slice(0, 30);


    save();

    toast(
      'Profile saved locally'
    );


    if (state.user) {

      try {

        toast(
          'Syncing with Supabase...'
        );

        await sync();

      } catch (error) {

        console.error(error);

        toast(
          'Cloud sync failed, saved locally'
        );
      }
    }
  }


  // =========================================================
  // WORKOUT CONTROLS
  // =========================================================

  async function bump(id, amount) {

    const exercise =
      state.exercises.find(
        item => item.id === id
      );

    if (!exercise) return;


    exercise.reps =
      Math.max(
        0,
        Math.min(
          exercise.max,
          Number(exercise.reps) +
          amount
        )
      );


    save();


    const element =
      $(`#rep-${id}`);

    if (element) {
      element.textContent =
        exercise.reps;
    }


    if (state.user) {

      try {
        await sync();
      } catch (error) {
        console.error(error);
      }

    }
  }


  async function setRir(id, value) {

    const exercise =
      state.exercises.find(
        item => item.id === id
      );

    if (!exercise) return;


    exercise.rir =
      Number(value);


    save();


    if (state.user) {

      try {
        await sync();
      } catch (error) {
        console.error(error);
      }

    }
  }


  async function setLoad(id, value) {

    const exercise =
      state.exercises.find(
        item => item.id === id
      );

    if (!exercise) return;


    exercise.load =
      Math.max(
        0,
        Number(value) || 0
      );


    save();


    if (state.user) {

      try {
        await sync();
      } catch (error) {
        console.error(error);
      }

    }
  }


  function finishWorkout() {

    const now =
      new Date().toISOString();


    const id =
      crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now());


    const workout = {

      id,

      date: now,

      exercises:
        state.exercises.map(
          exercise => ({
            id: exercise.id,
            name: exercise.name,
            reps: exercise.reps,
            sets: exercise.sets,
            load: exercise.load,
            rir: exercise.rir,
            unit: exercise.unit
          })
        )

    };


    state.history.unshift(
      workout
    );


    state.history =
      state.history.slice(0, 100);


    state.lastSync = null;


    save();


    toast(
      'Workout completed'
    );


    if (state.user) {

      sync().catch(error =>
        console.error(
          'Workout sync failed:',
          error
        )
      );

    }


    render();
  }


  // =========================================================
  // REST TIMER
  // =========================================================

  function startRest(seconds) {

    clearInterval(timer);

    remaining =
      Number(seconds) || 0;

    updateTimer();


    timer =
      setInterval(() => {

        remaining--;

        updateTimer();


        if (remaining <= 0) {

          clearInterval(timer);

          timer = null;

          remaining = 0;

          updateTimer();

          toast(
            'Rest complete'
          );


          if (
            navigator.vibrate
          ) {
            navigator.vibrate(
              [150, 80, 150]
            );
          }
        }

      }, 1000);
  }


  function updateTimer() {

    const element =
      $('#timerText');

    if (!element) return;


    element.textContent =
      remaining
        ? `Rest timer: ${Math.floor(
            remaining / 60
          )}:${String(
            remaining % 60
          ).padStart(2, '0')}`
        : '';
  }


  // =========================================================
  // BACKUP
  // =========================================================

  function exportData() {

    const blob =
      new Blob(
        [
          JSON.stringify(
            state,
            null,
            2
          )
        ],
        {
          type:
            'application/json'
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const anchor =
      document.createElement(
        'a'
      );

    anchor.href = url;

    anchor.download =
      `workout-control-backup-${
        new Date()
          .toISOString()
          .slice(0, 10)
      }.json`;


    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(
      url
    );
  }


  function importData(event) {

    const file =
      event.target.files[0];

    if (!file) return;


    const reader =
      new FileReader();


    reader.onload = () => {

      try {

        const imported =
          JSON.parse(
            reader.result
          );


        if (
          !imported.exercises ||
          !imported.history
        ) {
          throw new Error(
            'Invalid backup'
          );
        }


        state = {
          ...cloneDefaultState(),
          ...imported
        };


        save();

        render();

        toast(
          'Backup imported'
        );

      } catch (error) {

        console.error(error);

        toast(
          'Invalid backup'
        );
      }
    };


    reader.readAsText(file);
  }


  function resetLocal() {

    if (
      !confirm(
        'Reset all local workout data on this device?'
      )
    ) {
      return;
    }


    localStorage.removeItem(
      KEY
    );


    state =
      cloneDefaultState();


    render();

    toast(
      'Local data reset'
    );
  }


  // =========================================================
  // SUPABASE
  // =========================================================

  async function sync() {

    if (
      !supabaseClient ||
      !state.user
    ) {
      toast(
        'Cloud sync is not available'
      );

      return;
    }


    await pushCloud();

    await pullCloud();


    state.lastSync =
      new Date().toISOString();


    save();


    toast(
      'Synced'
    );


    render();
  }


  async function pushCloud() {

    const uid =
      state.user.id;


    // -------------------------------------------------------
    // Profile
    // -------------------------------------------------------

    const profile = {

      user_id: uid,

      weight:
        Number(
          state.profile.weight
        ) || null,

      waist:
        Number(
          state.profile.waist
        ) || null,

      updated_at:
        new Date().toISOString()

    };


    const profileResult =
      await supabaseClient
        .from('profiles')
        .upsert(
          profile,
          {
            onConflict:
              'user_id'
          }
        );


    if (
      profileResult.error
    ) {
      throw profileResult.error;
    }


    // -------------------------------------------------------
    // Exercises
    // -------------------------------------------------------

    const exerciseRows =
      state.exercises.map(
        exercise => ({

          user_id: uid,

          exercise_id:
            exercise.id,

          name:
            exercise.name,

          type:
            exercise.category || null,

          min_reps:
            exercise.min,

          max_reps:
            exercise.max,

          load:
            exercise.load,

          unit:
            exercise.unit,

          reps:
            exercise.reps,

          rir:
            exercise.rir,

          sets:
            exercise.sets,

          note:
            exercise.note,

          updated_at:
            new Date().toISOString()

        })
      );


    const exerciseResult =
      await supabaseClient
        .from('exercise_state')
        .upsert(
          exerciseRows,
          {
            onConflict:
              'user_id,exercise_id'
          }
        );


    if (
      exerciseResult.error
    ) {
      throw exerciseResult.error;
    }


    // -------------------------------------------------------
    // History
    // -------------------------------------------------------

    if (
      state.history.length
    ) {

      const historyRows =
        state.history.map(
          workout => ({

            id:
              workout.id,

            user_id:
              uid,

            workout_date:
              workout.date,

            payload:
              workout

          })
        );


      const historyResult =
        await supabaseClient
          .from('workout_history')
          .upsert(
            historyRows,
            {
              onConflict:
                'id'
            }
          );


      if (
        historyResult.error
      ) {
        throw historyResult.error;
      }
    }
  }


  async function pullCloud() {

    if (
      !supabaseClient ||
      !state.user
    ) {
      return;
    }


    const uid =
      state.user.id;


    // -------------------------------------------------------
    // Profile
    // -------------------------------------------------------

    const profileResult =
      await supabaseClient
        .from('profiles')
        .select('*')
        .eq(
          'user_id',
          uid
        )
        .maybeSingle();


    if (
      profileResult.error
    ) {
      console.error(
        'Profile pull failed:',
        profileResult.error
      );
    }


    if (
      profileResult.data
    ) {

      state.profile.weight =
        profileResult.data.weight ??
        '';

      state.profile.waist =
        profileResult.data.waist ??
        '';
    }


    // -------------------------------------------------------
    // Exercises
    // -------------------------------------------------------

    const exerciseResult =
      await supabaseClient
        .from('exercise_state')
        .select('*')
        .eq(
          'user_id',
          uid
        );


    if (
      exerciseResult.error
    ) {
      console.error(
        'Exercise pull failed:',
        exerciseResult.error
      );
    }


    if (
      exerciseResult.data &&
      exerciseResult.data.length
    ) {

      const cloudExercises =
        exerciseResult.data;


      state.exercises =
        state.exercises.map(
          localExercise => {

            const cloudExercise =
              cloudExercises.find(
                row =>
                  row.exercise_id ===
                  localExercise.id
              );


            if (
              !cloudExercise
            ) {
              return localExercise;
            }


            return {
              ...localExercise,

              reps:
                cloudExercise.reps ??
                localExercise.reps,

              rir:
                cloudExercise.rir ??
                localExercise.rir,

              load:
                cloudExercise.load ??
                localExercise.load,

              sets:
                cloudExercise.sets ??
                localExercise.sets,

              note:
                cloudExercise.note ??
                localExercise.note

            };
          }
        );
    }


    // -------------------------------------------------------
    // History
    // -------------------------------------------------------

    const historyResult =
      await supabaseClient
        .from('workout_history')
        .select('payload')
        .eq(
          'user_id',
          uid
        )
        .order(
          'workout_date',
          {
            ascending: false
          }
        )
        .limit(100);


    if (
      historyResult.error
    ) {
      console.error(
        'History pull failed:',
        historyResult.error
      );
    }


    if (
      historyResult.data
    ) {

      state.history =
        historyResult.data
          .map(row =>
            row.payload
          )
          .filter(Boolean);
    }


    save();
  }


  async function logout() {

    if (
      supabaseClient
    ) {
      await supabaseClient.auth.signOut();
    }


    state.user = null;

    state.lastSync = null;

    save();

    render();

    toast(
      'Signed out'
    );
  }


  // =========================================================
  // SUPABASE INITIALIZATION
  // =========================================================

  function initializeSupabase() {

    const config =
      window.WORKOUT_CONFIG || {};


    if (
      window.supabase &&
      config.SUPABASE_URL &&
      config.SUPABASE_ANON_KEY
    ) {

      try {

        supabaseClient =
          window.supabase.createClient(
            config.SUPABASE_URL,
            config.SUPABASE_ANON_KEY
          );


        supabaseClient.auth
          .getSession()
          .then(
            async ({ data }) => {

              if (
                data &&
                data.session
              ) {

                state.user =
                  data.session.user;

                try {

                  await pullCloud();

                } catch (error) {

                  console.error(
                    'Initial cloud pull failed:',
                    error
                  );
                }


                render();
              }
            }
          )
          .catch(error => {

            console.error(
              'Could not get Supabase session:',
              error
            );

          });


        supabaseClient.auth
          .onAuthStateChange(
            (_event, session) => {

              state.user =
                session?.user || null;

              save();

              render();
            }
          );


      } catch (error) {

        console.error(
          'Supabase initialization failed:',
          error
        );

        supabaseClient = null;
      }

    } else {

      console.warn(
        'Supabase is not configured. Running in local mode.'
      );
    }
  }


  // =========================================================
  // GLOBAL APP API
  // =========================================================

  window.WC = {

    go: targetPage => {

      page =
        targetPage;

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


  // =========================================================
  // NAVIGATION
  // =========================================================

  $$('.nav-btn').forEach(
    button => {

      button.onclick = () => {

        page =
          button.dataset.nav;

        render();
      };
    }
  );


  const syncButton =
    $('#syncBtn');


  if (syncButton) {

    syncButton.onclick = () => {

      if (state.user) {
        sync().catch(error =>
          console.error(
            'Sync failed:',
            error
          )
        );
      } else {
        toast(
          'Local mode'
        );
      }
    };
  }


  // =========================================================
  // START APP
  // =========================================================

  initializeSupabase();

  render();


  // =========================================================
  // SERVICE WORKER
  // =========================================================

  if (
    'serviceWorker' in navigator
  ) {

    window.addEventListener(
      'load',
      () => {

        navigator.serviceWorker
          .register('sw.js')
          .catch(error => {

            console.warn(
              'Service worker registration failed:',
              error
            );

          });

      }
    );
  }

})();
```
