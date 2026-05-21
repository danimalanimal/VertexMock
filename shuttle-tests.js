/* ===========================================================================
   Vertex Shuttle Tests — Beep test / Yo-Yo IR1 / 30-15 IFT
   Protocol-driven cadence engine on a single page.
   =========================================================================== */
(() => {
  'use strict';
  const { beep, speak, setMuted, isMuted } = window.VertexAudio;

  /* ---------------- Protocols ---------------- */
  // Each protocol exposes:
  //   levels:    [{ spd, sh, secs (run secs per shuttle), recoverSecs? }]
  //   pattern:   'continuous' | 'recovery' | 'work-rest'
  //   labels:    customisable HUD labels & result columns
  //   score:     (out, allSelected, lvl, sh) => { columns, foot, extra }
  //   guide:     html string for the setup page
  //   checklist: extra checklist items beyond defaults
  //   topName:   page title

  const PROTOCOLS = {
    /* ------ BEEP TEST (Léger 20m MSFT) ------ */
    beep: {
      name: 'Beep test',
      topName: 'Beep Test',
      pattern: 'continuous',
      blurb: 'Léger 20m beep test — standard aerobic capacity benchmark.',
      levels: ([
        { spd: 8.0,  sh: 7  }, { spd: 9.0,  sh: 8  }, { spd: 9.5,  sh: 8  },
        { spd: 10.0, sh: 9  }, { spd: 10.5, sh: 9  }, { spd: 11.0, sh: 10 },
        { spd: 11.5, sh: 10 }, { spd: 12.0, sh: 11 }, { spd: 12.5, sh: 11 },
        { spd: 13.0, sh: 11 }, { spd: 13.5, sh: 12 }, { spd: 14.0, sh: 12 },
        { spd: 14.5, sh: 13 }, { spd: 15.0, sh: 13 }, { spd: 15.5, sh: 13 },
        { spd: 16.0, sh: 14 }, { spd: 16.5, sh: 14 }, { spd: 17.0, sh: 15 },
        { spd: 17.5, sh: 15 }, { spd: 18.0, sh: 16 }, { spd: 18.5, sh: 16 },
      ]).map(L => ({ ...L, secs: +(20 / (L.spd * 1000 / 3600)).toFixed(3) })),
      labels: { level: 'Level', shuttle: 'Shuttle', maxK: 'Max level' },
      guide: `
        <ol class="guide-steps">
          <li><div class="gs-num">1</div><div><strong>Course</strong><p>Two parallel lines exactly <b>20m apart</b>. Cones, tape, or chalk. Indoor surface preferred. Allow 1m clearance behind each line for turning.</p></div></li>
          <li><div class="gs-num">2</div><div><strong>Mechanics</strong><p>Athletes line up behind line A. On each beep, one foot must be across the opposite line. Two consecutive misses = out. Speed increases every minute (new level).</p></div></li>
          <li><div class="gs-num">3</div><div><strong>Scoring</strong><p>Final score = highest level + shuttle reached. VO₂max estimated via Léger formula. Elite youth boxers reach L10+; recreational adults sit around L6-8.</p></div></li>
          <li><div class="gs-num">4</div><div><strong>Eliminations</strong><p>Tap an athlete's tile when they can't keep up. Their final L·S is recorded. Undo toast gives you 5s to bring them back.</p></div></li>
        </ol>
        <div class="guide-safety"><strong>Safety</strong><ul>
          <li>No fasted athletes — small carb snack 60–90 min prior</li>
          <li>Asthma inhalers within reach · stop on chest pain or dizziness</li>
          <li>10-min warm-up first (jog + dynamic stretches + 2× practice shuttles)</li>
        </ul></div>`,
      checklist: [
        '20 m course marked', 'Audio tested at furthest cone',
        'Athletes warmed up (10 min)', 'Water station ready',
        'Inhalers / first aid accessible', 'Coach at finish line to spot misses',
      ],
      // VO₂max — Léger
      vo2max(level, shuttle, age, levels) {
        const speed = levels[Math.min(level - 1, levels.length - 1)].spd;
        return Math.round((31.025 + 3.238 * speed - 3.248 * age + 0.1536 * age * speed) * 10) / 10;
      },
      results(out, lvls) {
        return {
          head: '<tr><th>#</th><th>Athlete</th><th>Level</th><th>Shuttle</th><th>Total laps</th><th>VO₂max est.</th></tr>',
          rows: (a, r, i) => `
            <td class="rt-rank">#${i+1}</td>
            <td class="rt-name"><span class="rt-init">${a.initials || a.name.slice(0,2)}</span> ${a.name}</td>
            <td>${r.level}</td>
            <td>${r.shuttle}</td>
            <td>${r.laps}</td>
            <td><b>${this.vo2max(r.level, r.shuttle, a.age || 14, lvls)}</b><span class="rt-unit"> ml/kg/min</span></td>`,
          sortKey: r => [r.level, r.shuttle],
          maxLabel: out => 'L' + Math.max(...out.map(r => r.level), 0),
          foot: 'VO₂max estimated with the Léger formula (20m MSFT). Indicative only.',
        };
      },
    },

    /* ------ YO-YO INTERMITTENT RECOVERY LEVEL 1 ------ */
    yoyoIR1: {
      name: 'Yo-Yo IR1',
      topName: 'Yo-Yo IR1',
      pattern: 'recovery',
      blurb: 'Yo-Yo Intermittent Recovery Test (Level 1) — 2×20m runs + 10s active recovery walks. Standard for field/court sports.',
      // Yo-Yo IR1 stages: each "shuttle" is one 2×20m run; recoverSecs between shuttles is 10s.
      levels: [
        { spd: 10.0, sh: 1 }, { spd: 12.0, sh: 1 }, { spd: 13.0, sh: 2 },
        { spd: 13.5, sh: 3 }, { spd: 14.0, sh: 4 }, { spd: 14.5, sh: 8 },
        { spd: 15.0, sh: 8 }, { spd: 15.5, sh: 8 }, { spd: 16.0, sh: 8 },
        { spd: 16.5, sh: 8 }, { spd: 17.0, sh: 8 }, { spd: 17.5, sh: 8 },
        { spd: 18.0, sh: 8 }, { spd: 18.5, sh: 8 },
      ].map(L => ({
        ...L,
        // 2× 20m run at level speed
        secs: +(40 / (L.spd * 1000 / 3600)).toFixed(3),
        recoverSecs: 10,
      })),
      labels: { level: 'Stage', shuttle: 'Shuttle', maxK: 'Final stage' },
      guide: `
        <ol class="guide-steps">
          <li><div class="gs-num">1</div><div><strong>Course</strong><p>20m main course + a <b>5m walk-back zone</b> behind start line. Three cones: start, finish (20m), recovery (5m behind start).</p></div></li>
          <li><div class="gs-num">2</div><div><strong>Mechanics</strong><p>Each "shuttle" = run to 20m line, return to start (2×20m = 40m). Then a <b>10s active recovery walk</b> to the recovery cone and back. Audio cues call "Walk" and "Go".</p></div></li>
          <li><div class="gs-num">3</div><div><strong>Scoring</strong><p>Score = <b>total distance covered in metres</b>. Elite footballers/AFL players reach 2000-2400m; youth athletes 800-1400m. VO₂max from Bangsbo formula.</p></div></li>
          <li><div class="gs-num">4</div><div><strong>Eliminations</strong><p>Two consecutive failures to reach the line in time = out. Same tap-to-drop behaviour as the beep test.</p></div></li>
        </ol>
        <div class="guide-safety"><strong>Safety</strong><ul>
          <li>Course is longer than beep — confirm walk-back lane is clear</li>
          <li>Recovery walk is mandatory; missing it = out</li>
          <li>Modern replacement for beep test in elite team sports</li>
        </ul></div>`,
      checklist: [
        '20m + 5m walk-back course marked (3 cones)', 'Audio tested at finish line',
        'Athletes warmed up (10 min)', 'Water station ready',
        'Inhalers / first aid accessible', 'Coach at finish line to spot misses',
      ],
      vo2max(distance) {
        // Bangsbo: VO₂max = IR1 distance (m) × 0.0084 + 36.4
        return Math.round((distance * 0.0084 + 36.4) * 10) / 10;
      },
      results(out, lvls) {
        return {
          head: '<tr><th>#</th><th>Athlete</th><th>Stage</th><th>Shuttles</th><th>Distance</th><th>VO₂max est.</th></tr>',
          rows: (a, r, i) => {
            const distance = r.laps * 40; // each shuttle = 40m
            return `
              <td class="rt-rank">#${i+1}</td>
              <td class="rt-name"><span class="rt-init">${a.initials || a.name.slice(0,2)}</span> ${a.name}</td>
              <td>${r.level}</td>
              <td>${r.laps}</td>
              <td>${distance} m</td>
              <td><b>${this.vo2max(distance)}</b><span class="rt-unit"> ml/kg/min</span></td>`;
          },
          sortKey: r => [r.laps, r.level],
          maxLabel: out => 'St ' + Math.max(...out.map(r => r.level), 0),
          foot: 'Distance = shuttles × 40m. VO₂max from Bangsbo IR1 formula. Indicative only.',
        };
      },
    },

    /* ------ 30-15 INTERMITTENT FITNESS TEST ------ */
    ift3015: {
      name: '30-15 IFT',
      topName: '30-15 IFT',
      pattern: 'work-rest',
      blurb: '30-15 Intermittent Fitness Test — 30s running between markers, 15s passive rest. Modern team-sport standard. Used to prescribe HIIT.',
      // Speed progression: starts 8.0 km/h, +0.5 km/h per stage. Distance covered in 30s = speed*(30/3600)*1000.
      levels: (() => {
        const arr = [];
        for (let i = 0; i < 24; i++) {
          const spd = 8.0 + i * 0.5;
          // distance run per 30s work bout (m). Athlete must cover that distance back and forth on a 40m course.
          const distance = +(spd * 1000 / 3600 * 30).toFixed(1);
          // 'sh' here = number of 40m laps achievable (approx) at this stage
          arr.push({ spd, sh: 1, secs: 30, recoverSecs: 15, distance });
        }
        return arr;
      })(),
      labels: { level: 'Stage', shuttle: 'Phase', maxK: 'V-IFT' },
      guide: `
        <ol class="guide-steps">
          <li><div class="gs-num">1</div><div><strong>Course</strong><p>40m course with cones at <b>0m, 20m, and 40m</b>. Athletes run between markers, reversing direction at each end.</p></div></li>
          <li><div class="gs-num">2</div><div><strong>Mechanics</strong><p><b>30 seconds running</b> at stage speed, then <b>15 seconds passive rest</b> walking to nearest marker. Stage speed increases 0.5 km/h every cycle. Athletes try to reach the next marker before each 30s tick.</p></div></li>
          <li><div class="gs-num">3</div><div><strong>Scoring</strong><p>Score = <b>V-IFT</b> (velocity at final stage, in km/h). Used to prescribe HIIT — e.g. 15s on / 15s off at 95% V-IFT is a standard interval session.</p></div></li>
          <li><div class="gs-num">4</div><div><strong>Eliminations</strong><p>Out when athlete can't reach the marker within 3m for two consecutive 30s bouts. Modern replacement for beep test in soccer / handball / basketball.</p></div></li>
        </ol>
        <div class="guide-safety"><strong>Safety</strong><ul>
          <li>40m course needs more space — confirm dimensions before starting</li>
          <li>Audio cue every 30s + every 15s rest — phase pill on screen confirms</li>
          <li>Designed by Buchheit; widely used in elite team sport conditioning</li>
        </ul></div>`,
      checklist: [
        '40m course marked (3 cones at 0/20/40)', 'Audio tested at furthest cone',
        'Athletes warmed up (10 min)', 'Water station ready',
        'Inhalers / first aid accessible', 'Coach at finish line to spot misses',
      ],
      results(out, lvls) {
        return {
          head: '<tr><th>#</th><th>Athlete</th><th>Stage</th><th>V-IFT</th><th>95% V-IFT</th><th>HIIT pace</th></tr>',
          rows: (a, r, i) => {
            const lvl = lvls[Math.min(r.level - 1, lvls.length - 1)];
            const vift = lvl.spd;
            const ninetyFive = +(vift * 0.95).toFixed(2);
            const hiitMps = +(ninetyFive * 1000 / 3600).toFixed(2);
            const hiitDist = Math.round(hiitMps * 15); // metres in 15s at 95% V-IFT
            return `
              <td class="rt-rank">#${i+1}</td>
              <td class="rt-name"><span class="rt-init">${a.initials || a.name.slice(0,2)}</span> ${a.name}</td>
              <td>${r.level}</td>
              <td><b>${vift.toFixed(1)}</b><span class="rt-unit"> km/h</span></td>
              <td>${ninetyFive.toFixed(1)} km/h</td>
              <td>${hiitDist} m / 15s</td>`;
          },
          sortKey: r => [r.level, r.shuttle],
          maxLabel: out => {
            const top = Math.max(...out.map(r => r.level), 0);
            const spd = lvls[Math.min(top - 1, lvls.length - 1)]?.spd ?? 0;
            return spd.toFixed(1) + ' km/h';
          },
          foot: 'V-IFT = velocity at final stage. 95% V-IFT pace is a standard HIIT prescription (15s on / 15s off).',
          extra: out => `
            <p>Use these prescribed paces in conditioning sessions this week:</p>
            <ul style="color:var(--muted); font-size:13px; line-height:1.7;">
              <li><b>HIIT 15s/15s:</b> athletes run their "95% V-IFT" distance every 15s for 4-6 sets of 8-10 reps.</li>
              <li><b>Anaerobic intervals:</b> 30s on / 30s off at 105% V-IFT (~5-6 reps).</li>
              <li><b>Long aerobic:</b> 4 min at 85% V-IFT × 4 sets, 3 min rest.</li>
            </ul>`,
        };
      },
    },
  };

  /* ---------------- State ---------------- */
  const state = {
    proto: PROTOCOLS.beep,
    protoKey: 'beep',
    screen: 'setup',
    roster: [], selected: new Set(), active: new Set(), out: [],
    levelIdx: 0, shuttle: 0, totalLaps: 0,
    phase: 'run',                  // 'run' | 'rest' | 'recover'
    phaseStartMs: 0,
    startMs: 0, pausedFor: 0, pausedAt: 0, paused: false,
    timeoutId: null, undoStack: [], rosterApi: null,
  };

  /* ---------------- DOM ---------------- */
  const $ = sel => document.querySelector(sel);
  const setupScreen = $('#setupScreen'), runScreen = $('#runScreen'), resScreen = $('#resultsScreen');
  const rosterGrid  = $('#rosterGrid'), rosterCount = $('#rosterCount');
  const startBtn = $('#startBtn'), startSub = $('#startSub'), muteBtn = $('#muteBtn');
  const guideToggle = $('#guideToggle'), guideBody = $('#guideBody'), guideTitle = $('#guideTitle');
  const audioTest = $('#audioTestBtn'), checklist = $('#checklist'), protoBlurb = $('#protoBlurb');
  const topbarTitle = $('#topbarTitle');

  const hudLevel = $('#hudLevel'), hudShuttle = $('#hudShuttle'), hudTime = $('#hudTime');
  const hudActive = $('#hudActive'), hudLevelLabel = $('#hudLevelLabel'), hudShuttleLabel = $('#hudShuttleLabel');
  const rbSpeed = $('#rbSpeed'), rbPace = $('#rbPace'), rbNext = $('#rbNext'), rbNextK = $('#rbNextK');
  const runGrid = $('#runGrid'), outStrip = $('#outStrip'), outCount = $('#outCount');
  const pauseBtn = $('#pauseBtn'), stopBtn = $('#stopBtn');
  const undoToast = $('#undoToast'), undoMsg = $('#undoMsg'), undoBtn = $('#undoBtn');
  const phasePill = $('#phasePill'), phaseText = $('#phaseText'), phaseTime = $('#phaseTime');

  const rsAthletes = $('#rsAthletes'), rsMax = $('#rsMax'), rsMaxK = $('#rsMaxK'), rsDur = $('#rsDur');
  const resBody = $('#resultsBody'), resHead = $('#resultsHead'), resultsFoot = $('#resultsFoot');
  const protoExtra = $('#protoExtra'), extraBody = $('#extraBody');
  const saveBtn = $('#saveBtn'), againBtn = $('#againBtn'), exportBtn = $('#exportBtn'), saveToast = $('#saveToast');

  /* ---------------- Protocol switching ---------------- */
  document.querySelectorAll('.proto-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.proto-btn').forEach(b => {
        b.classList.remove('on'); b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('on'); btn.setAttribute('aria-checked', 'true');
      state.protoKey = btn.dataset.proto;
      state.proto = PROTOCOLS[state.protoKey];
      applyProtocol();
    });
  });
  function applyProtocol() {
    const P = state.proto;
    topbarTitle.textContent = P.topName;
    protoBlurb.textContent = P.blurb;
    guideTitle.textContent = `How to run the ${P.name.toLowerCase()}`;
    guideBody.innerHTML = P.guide;
    checklist.innerHTML = P.checklist.map(item =>
      `<label class="check"><input type="checkbox" /><span>${item}</span></label>`).join('');
    hudLevelLabel.textContent   = P.labels.level;
    hudShuttleLabel.textContent = P.labels.shuttle;
    rsMaxK.textContent          = P.labels.maxK;
  }

  /* ---------------- Roster ---------------- */
  function loadRoster() {
    const D = window.BoxerData;
    if (!D || !D.athletes) { rosterGrid.innerHTML = '<p style="opacity:.6">Athlete data not loaded.</p>'; return; }
    state.roster = D.athletes.map(a => a);
    state.rosterApi = window.VertexRoster.mount({
      container: rosterGrid,
      athletes: state.roster,
      selected: state.selected,
      onChange: updateRosterCount,
    });
    updateRosterCount();
  }
  function updateRosterCount() {
    const n = state.selected.size, total = state.roster.length;
    rosterCount.textContent = `${n} / ${total} selected`;
    startBtn.disabled = n === 0;
    startSub.textContent = n === 0 ? 'Pick at least one athlete' : `${n} athlete${n>1?'s':''} ready · tap to begin`;
  }
  $('#selectAllBtn').addEventListener('click', () => state.rosterApi && state.rosterApi.selectAll());
  $('#clearAllBtn').addEventListener('click',  () => state.rosterApi && state.rosterApi.clear());

  guideToggle.addEventListener('click', () => {
    const expanded = guideToggle.getAttribute('aria-expanded') === 'true';
    guideToggle.setAttribute('aria-expanded', String(!expanded));
    guideToggle.textContent = expanded ? 'Show' : 'Hide';
    guideBody.hidden = expanded;
  });
  audioTest.addEventListener('click', () => beep({ freq: 880, dur: 0.25, vol: 0.55 }));
  muteBtn.addEventListener('click', () => {
    setMuted(!isMuted());
    muteBtn.textContent = isMuted() ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', String(isMuted()));
  });

  /* ---------------- Start session ---------------- */
  startBtn.addEventListener('click', () => {
    if (state.selected.size === 0) return;
    state.active = new Set(state.selected);
    state.out = []; state.levelIdx = 0; state.shuttle = 0; state.totalLaps = 0;
    state.pausedFor = 0; state.paused = false; state.undoStack = [];
    state.phase = 'run';

    setupScreen.hidden = true; runScreen.hidden = false; state.screen = 'run';
    renderRunGrid(); renderOutStrip(); updateHud();
    setupPhasePill();
    countdownThenStart();
  });
  function setupPhasePill() {
    if (state.proto.pattern === 'continuous') { phasePill.hidden = true; return; }
    phasePill.hidden = false;
  }
  function countdownThenStart() {
    let n = 3;
    speak('Get ready');
    hudLevel.textContent = n; hudShuttle.textContent = '—';
    const tick = () => {
      if (n <= 0) {
        hudLevel.textContent = '1'; hudShuttle.textContent = '0';
        speak(state.proto.name + ', stage 1');
        beep({ freq: 1320, dur: 0.35, vol: 0.6 });
        state.startMs = performance.now();
        startPhase('run');
        return;
      }
      beep({ freq: 600, dur: 0.15, vol: 0.4 });
      hudLevel.textContent = n; n--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  /* ---------------- Loop ---------------- */
  function startPhase(phase) {
    if (state.paused) return;
    state.phase = phase;
    state.phaseStartMs = performance.now();
    const lvl = state.proto.levels[state.levelIdx];
    if (!lvl) return endSession();

    if (state.proto.pattern === 'continuous') {
      // Single shuttle, schedule next beep at lvl.secs
      phasePill.hidden = true;
      state.timeoutId = setTimeout(onShuttleBeep, lvl.secs * 1000);
    } else if (state.proto.pattern === 'recovery') {
      // Yo-Yo: run a single 2×20m shuttle, then 10s recovery, then next shuttle
      if (phase === 'run') {
        phaseText.textContent = 'RUN'; phasePill.className = 'phase-pill run';
        state.timeoutId = setTimeout(() => {
          onShuttleBeep();
          if (state.active.size === 0) return;
          startPhase('recover');
        }, lvl.secs * 1000);
      } else if (phase === 'recover') {
        phaseText.textContent = 'WALK'; phasePill.className = 'phase-pill rest';
        speak('Walk back');
        beep({ freq: 440, dur: 0.18, vol: 0.4 });
        state.timeoutId = setTimeout(() => {
          if (state.active.size === 0) return;
          speak('Go');
          beep({ freq: 880, dur: 0.18, vol: 0.5 });
          startPhase('run');
        }, lvl.recoverSecs * 1000);
      }
    } else if (state.proto.pattern === 'work-rest') {
      // 30-15: 30s work, 15s rest, then next stage
      if (phase === 'run') {
        phaseText.textContent = 'RUN'; phasePill.className = 'phase-pill run';
        state.totalLaps += 1; // count one work-bout as a lap
        state.shuttle = 1;
        updateHud();
        state.timeoutId = setTimeout(() => {
          if (state.active.size === 0) return endSession();
          beep({ freq: 660, dur: 0.4, vol: 0.55 });
          speak('Rest');
          startPhase('rest');
        }, lvl.secs * 1000);
      } else if (phase === 'rest') {
        phaseText.textContent = 'REST'; phasePill.className = 'phase-pill rest';
        state.shuttle = 0;
        updateHud();
        state.timeoutId = setTimeout(() => {
          if (state.active.size === 0) return;
          // advance stage
          state.levelIdx += 1;
          const newLvl = state.levelIdx + 1;
          beep({ freq: 1320, dur: 0.45, vol: 0.65 });
          speak(`Stage ${newLvl}`);
          startPhase('run');
        }, lvl.recoverSecs * 1000);
      }
    }
  }

  function onShuttleBeep() {
    state.shuttle += 1; state.totalLaps += 1;
    const lvl = state.proto.levels[state.levelIdx];

    if (state.proto.pattern === 'continuous') {
      if (state.shuttle >= lvl.sh) {
        state.levelIdx += 1; state.shuttle = 0;
        const newLvl = state.levelIdx + 1;
        beep({ freq: 1320, dur: 0.45, vol: 0.65 });
        speak(`Level ${newLvl}`);
      } else {
        beep({ freq: 880, dur: 0.16, vol: 0.5 });
      }
      updateHud();
      if (state.active.size === 0) return endSession();
      const next = state.proto.levels[state.levelIdx];
      if (!next) return endSession();
      state.timeoutId = setTimeout(onShuttleBeep, next.secs * 1000);
    } else if (state.proto.pattern === 'recovery') {
      // Yo-Yo: shuttle increment + check level boundary
      if (state.shuttle >= lvl.sh) {
        state.levelIdx += 1; state.shuttle = 0;
        const newStg = state.levelIdx + 1;
        beep({ freq: 1320, dur: 0.45, vol: 0.65 });
        speak(`Stage ${newStg}`);
      } else {
        beep({ freq: 880, dur: 0.16, vol: 0.5 });
      }
      updateHud();
    }
  }

  function updateHud() {
    const lvl = state.proto.levels[state.levelIdx] || state.proto.levels[state.proto.levels.length - 1];
    hudLevel.textContent = String(state.levelIdx + 1);
    if (state.proto.pattern === 'work-rest') {
      hudShuttle.textContent = state.phase === 'rest' ? 'rest' : 'run';
    } else {
      hudShuttle.textContent = `${state.shuttle} / ${lvl.sh}`;
    }
    hudActive.textContent  = `${state.active.size} / ${state.selected.size}`;
    rbSpeed.textContent = `${lvl.spd.toFixed(1)} km/h`;
    if (state.proto.pattern === 'work-rest') {
      rbPace.textContent = '30s on / 15s off';
      rbNextK.textContent = 'Distance/bout';
      rbNext.textContent = `${lvl.distance} m`;
    } else {
      rbPace.textContent  = `${lvl.secs.toFixed(2)} s/shuttle`;
      rbNextK.textContent = 'Next stage';
      rbNext.textContent  = `${lvl.sh - state.shuttle} to go`;
    }
    hudTime.textContent = fmtElapsed();

    // Phase pill countdown for non-continuous protocols
    if (state.proto.pattern !== 'continuous' && state.phaseStartMs) {
      const lvlObj = state.proto.levels[state.levelIdx];
      const total = (state.phase === 'rest' || state.phase === 'recover') ? lvlObj.recoverSecs : lvlObj.secs;
      const remain = Math.max(0, total - (performance.now() - state.phaseStartMs) / 1000);
      phaseTime.textContent = remain.toFixed(0) + 's';
    }
  }
  function fmtElapsed() {
    if (!state.startMs) return '0:00';
    const ms = (state.paused ? state.pausedAt : performance.now()) - state.startMs - state.pausedFor;
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  }
  setInterval(() => { if (state.screen === 'run') { hudTime.textContent = fmtElapsed(); updateHud(); } }, 250);

  /* ---------------- Grid rendering ---------------- */
  function renderRunGrid() {
    runGrid.innerHTML = '';
    state.roster.filter(a => state.active.has(a.id)).forEach(a => {
      const tile = document.createElement('button');
      tile.type = 'button'; tile.className = 'run-tile'; tile.dataset.id = a.id;
      tile.style.setProperty('--accent', a.accent || '#9bd2ff');
      tile.innerHTML = `
        <span class="rt-init">${a.initials || a.name.slice(0,2)}</span>
        <span class="rt-name">${a.name}</span>
        <span class="rt-hint">tap when done</span>`;
      tile.addEventListener('click', () => dropAthlete(a.id));
      runGrid.appendChild(tile);
    });
  }
  function renderOutStrip() {
    outStrip.innerHTML = '';
    state.out.forEach((rec, i) => {
      const a = state.roster.find(x => x.id === rec.id);
      if (!a) return;
      const chip = document.createElement('div');
      chip.className = 'out-chip';
      chip.style.setProperty('--accent', a.accent || '#9bd2ff');
      const scoreLabel = state.proto.pattern === 'work-rest'
        ? `St${rec.level}`
        : `L${rec.level}·${rec.shuttle}`;
      chip.innerHTML = `
        <span class="oc-rank">#${state.out.length - i}</span>
        <span class="oc-init">${a.initials || a.name.slice(0,2)}</span>
        <span class="oc-name">${a.name}</span>
        <span class="oc-score">${scoreLabel}</span>`;
      outStrip.appendChild(chip);
    });
    outCount.textContent = String(state.out.length);
  }
  function dropAthlete(id) {
    if (!state.active.has(id)) return;
    const a = state.roster.find(x => x.id === id);
    const rec = { id, level: state.levelIdx + 1, shuttle: state.shuttle, laps: state.totalLaps };
    state.active.delete(id); state.out.unshift(rec); state.undoStack.push(rec);
    beep({ freq: 440, dur: 0.12, vol: 0.35 });
    renderRunGrid(); renderOutStrip(); updateHud();
    const scoreLbl = state.proto.pattern === 'work-rest' ? `St${rec.level}` : `L${rec.level}·${rec.shuttle}`;
    showUndo(`Dropped ${a.name} at ${scoreLbl}`);
    if (state.active.size === 0) setTimeout(endSession, 600);
  }
  function showUndo(msg) {
    undoMsg.textContent = msg; undoToast.hidden = false;
    clearTimeout(showUndo._t);
    showUndo._t = setTimeout(() => { undoToast.hidden = true; }, 5000);
  }
  function doUndo(ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    const rec = state.undoStack.pop();
    if (!rec) { undoToast.hidden = true; return; }
    state.active.add(rec.id);
    state.out = state.out.filter(r => r !== rec);
    renderRunGrid(); renderOutStrip(); updateHud();
    clearTimeout(showUndo._t); undoToast.hidden = true;
  }
  undoBtn.addEventListener('click', doUndo);
  undoBtn.addEventListener('touchend', (e) => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t || !undoBtn._touchStart) return doUndo(e);
    const dx = Math.abs(t.clientX - undoBtn._touchStart.x);
    const dy = Math.abs(t.clientY - undoBtn._touchStart.y);
    if (dx < 10 && dy < 10) doUndo(e);
  }, { passive: false });
  undoBtn.addEventListener('touchstart', (e) => {
    const t = e.changedTouches && e.changedTouches[0];
    if (t) undoBtn._touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  /* ---------------- Pause / Stop ---------------- */
  pauseBtn.addEventListener('click', () => {
    if (state.screen !== 'run') return;
    if (!state.paused) {
      state.paused = true; state.pausedAt = performance.now();
      clearTimeout(state.timeoutId);
      pauseBtn.textContent = '▶ Resume'; pauseBtn.classList.add('on');
    } else {
      state.paused = false;
      state.pausedFor += performance.now() - state.pausedAt;
      pauseBtn.textContent = '⏸ Pause'; pauseBtn.classList.remove('on');
      startPhase(state.phase);
    }
  });
  stopBtn.addEventListener('click', () => {
    if (state.screen !== 'run') return;
    state.roster.filter(a => state.active.has(a.id)).forEach(a => {
      state.out.unshift({
        id: a.id, level: state.levelIdx + 1, shuttle: state.shuttle, laps: state.totalLaps,
      });
    });
    state.active.clear();
    endSession();
  });

  /* ---------------- End / Results ---------------- */
  function endSession() {
    clearTimeout(state.timeoutId);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    beep({ freq: 660, dur: 0.6, vol: 0.5 });
    setTimeout(() => beep({ freq: 880, dur: 0.6, vol: 0.5 }), 250);
    runScreen.hidden = true; resScreen.hidden = false; state.screen = 'results';
    renderResults();
  }
  function renderResults() {
    const P = state.proto;
    const out = P.results(state.out, P.levels);

    rsAthletes.textContent = state.selected.size;
    rsMax.textContent = out.maxLabel(state.out);
    rsDur.textContent = fmtElapsed();

    resHead.innerHTML = out.head;
    const ranked = [...state.out].sort((a, b) => {
      const A = out.sortKey(a), B = out.sortKey(b);
      for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return B[i] - A[i];
      return 0;
    });
    resBody.innerHTML = '';
    ranked.forEach((r, i) => {
      const a = state.roster.find(x => x.id === r.id);
      const tr = document.createElement('tr');
      tr.style.setProperty('--accent', a.accent || '#9bd2ff');
      tr.innerHTML = out.rows.call(P, a, r, i);
      resBody.appendChild(tr);
    });
    resultsFoot.textContent = out.foot || '';

    if (out.extra) {
      protoExtra.hidden = false;
      extraBody.innerHTML = out.extra(state.out);
    } else {
      protoExtra.hidden = true;
    }
  }

  saveBtn.addEventListener('click', () => {
    const payload = state.out.map(r => {
      const a = state.roster.find(x => x.id === r.id);
      const entry = { id: r.id, name: a.name, level: r.level, shuttle: r.shuttle, laps: r.laps, ts: Date.now() };
      if (state.protoKey === 'beep') {
        entry.vo2max = state.proto.vo2max(r.level, r.shuttle, a.age || 14, state.proto.levels);
      } else if (state.protoKey === 'yoyoIR1') {
        entry.distance = r.laps * 40;
        entry.vo2max = state.proto.vo2max(entry.distance);
      } else if (state.protoKey === 'ift3015') {
        const lvl = state.proto.levels[Math.min(r.level - 1, state.proto.levels.length - 1)];
        entry.vift = lvl.spd;
      }
      return entry;
    });
    window.VertexResults.save(state.protoKey, payload, { protocol: state.proto.name });
    // Keep backward-compat alias
    if (state.protoKey === 'beep') window.__beepResults = payload;
    saveToast.hidden = false;
    setTimeout(() => { saveToast.hidden = true; }, 2400);
  });
  againBtn.addEventListener('click', () => {
    state.selected = new Set(); state.active = new Set(); state.out = [];
    state.levelIdx = 0; state.shuttle = 0;
    resScreen.hidden = true; setupScreen.hidden = false; state.screen = 'setup';
    if (state.rosterApi) state.rosterApi.clear();
    updateRosterCount();
  });
  exportBtn.addEventListener('click', () => {
    const payload = JSON.stringify(window.VertexResults.latest(state.protoKey) || state.out, null, 2);
    navigator.clipboard?.writeText(payload).then(() => {
      saveToast.querySelector('.bt-msg').textContent = 'JSON copied to clipboard';
      saveToast.hidden = false;
      setTimeout(() => { saveToast.hidden = true; }, 2200);
    }).catch(() => alert(payload));
  });

  /* ---------------- Boot ---------------- */
  function boot() { applyProtocol(); loadRoster(); }
  document.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
})();
