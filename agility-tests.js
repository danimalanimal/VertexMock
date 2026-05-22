/* ===========================================================================
   Vertex Agility Tests — single-athlete stopwatch, swappable protocols
   Protocols: T-Test, NBA Lane Agility
   =========================================================================== */
(() => {
  'use strict';
  const { beep, speak, setMuted, isMuted } = window.VertexAudio;
  const { fmtMMSS } = window.VertexTimer;

  // hh:mm:ss.cc — for sub-second precision agility times
  function fmtTime(ms) {
    const safe = Math.max(0, ms);
    const totalSec = safe / 1000;
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec - m * 60);
    const cs = Math.floor((safe % 1000) / 10);
    return `${m}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  }

  /* ---- T-Test diagram (4-cone T) ---- */
  const T_TEST_SVG = `<svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg" aria-label="T-Test course">
    <rect width="280" height="180" fill="transparent"/>
    <!-- T arm -->
    <line x1="60"  y1="40" x2="220" y2="40" stroke="#59b7ff" stroke-width="2" stroke-dasharray="6,4"/>
    <!-- T stem -->
    <line x1="140" y1="40" x2="140" y2="150" stroke="#59b7ff" stroke-width="2" stroke-dasharray="6,4"/>
    <!-- Cones -->
    <circle cx="60"  cy="40"  r="6" fill="#ffbf66"/>
    <circle cx="220" cy="40"  r="6" fill="#ffbf66"/>
    <circle cx="140" cy="40"  r="6" fill="#ffbf66"/>
    <circle cx="140" cy="150" r="7" fill="#5fe39c"/>
    <!-- Labels -->
    <text x="60"  y="28"  text-anchor="middle" fill="#93a4bd" font-family="Roboto Mono" font-size="11">B (5yd L)</text>
    <text x="220" y="28"  text-anchor="middle" fill="#93a4bd" font-family="Roboto Mono" font-size="11">C (5yd R)</text>
    <text x="155" y="35"  fill="#93a4bd" font-family="Roboto Mono" font-size="11">D (10yd)</text>
    <text x="155" y="155" fill="#5fe39c" font-family="Roboto Mono" font-size="11">A · start/finish</text>
    <!-- Arrows -->
    <path d="M140 145 L140 50" stroke="#59b7ff" stroke-width="1.5" fill="none" marker-end="url(#ar)"/>
    <defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#59b7ff"/></marker></defs>
  </svg>`;

  /* ---- NBA Lane Agility diagram (rectangle around the key) ---- */
  const LANE_SVG = `<svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg" aria-label="NBA Lane Agility course">
    <rect width="280" height="180" fill="transparent"/>
    <!-- The "key" rectangle (16 ft wide) -->
    <rect x="80" y="35" width="120" height="110" fill="none" stroke="#59b7ff" stroke-width="2" stroke-dasharray="6,4"/>
    <!-- Cones at 4 corners -->
    <circle cx="80"  cy="35"  r="6" fill="#5fe39c"/>
    <circle cx="200" cy="35"  r="6" fill="#ffbf66"/>
    <circle cx="200" cy="145" r="6" fill="#ffbf66"/>
    <circle cx="80"  cy="145" r="6" fill="#ffbf66"/>
    <!-- Labels -->
    <text x="80"  y="25"  text-anchor="middle" fill="#5fe39c" font-family="Roboto Mono" font-size="11">start/finish</text>
    <text x="200" y="25"  text-anchor="middle" fill="#93a4bd" font-family="Roboto Mono" font-size="11">cone 2</text>
    <text x="200" y="162" text-anchor="middle" fill="#93a4bd" font-family="Roboto Mono" font-size="11">cone 3</text>
    <text x="80"  y="162" text-anchor="middle" fill="#93a4bd" font-family="Roboto Mono" font-size="11">cone 4</text>
    <text x="140" y="100" text-anchor="middle" fill="#93a4bd" font-family="Roboto Mono" font-size="10">16 ft × 19 ft</text>
  </svg>`;

  const PROTOCOLS = {
    ttest: {
      name: 'T-Test',
      subtitle: 'T-Test',
      blurb: 'T-Test — 4-cone T course. Forward sprint, lateral shuffle, backpedal.',
      diagram: T_TEST_SVG,
      diagramCap: 'Sprint A→D (10 yd) · shuffle D→B (5 yd) · shuffle B→C (10 yd) · shuffle C→D (5 yd) · backpedal D→A (10 yd).',
      guide: [
        ['Set up','Place cone A on the start line. Measure 10 yd (9.1m) straight ahead and place D. From D, measure 5 yd (4.6m) left → B, and 5 yd right → C. Athletes touch each cone with the corresponding hand.'],
        ['Start position','Athlete stands behind cone A in a 2-point stance. No false start. Coach stands at A with phone, finger over the START button.'],
        ['Cue + start','"Ready, GO." Tap START as the athlete moves. They sprint forward, then shuffle facing forward the whole time.'],
        ['Run pattern','A → D (sprint, touch D with right hand) → B (shuffle left, touch B with left hand) → C (shuffle right, touch C with right hand) → D (shuffle left, touch D with left hand) → A (backpedal back to start).'],
        ['Finish','Tap STOP when both feet cross back over A. Faults (crossing feet, touching wrong cone) = re-attempt.'],
      ],
      checklist: ['4 cones set 10 yd × 5 yd × 5 yd','Course walk-through done','Athletes warmed up','Surface non-slip','Stopwatch + this app ready'],
      bands: [
        // Youth boxing-ish — these are conservative T-test times
        { ageMax: 13, ex: 11.5, good: 12.5, avg: 13.5, label: '12-13' },
        { ageMax: 15, ex: 10.5, good: 11.5, avg: 12.5, label: '14-15' },
        { ageMax: 99, ex:  9.8, good: 10.8, avg: 11.8, label: '16+' },
      ],
    },
    lane: {
      name: 'NBA Lane Agility',
      subtitle: 'NBA Lane Agility',
      blurb: 'NBA Lane Agility — sprint-shuffle-backpedal-shuffle around the painted key.',
      diagram: LANE_SVG,
      diagramCap: 'Sprint cone 1→2 · shuffle 2→3 · backpedal 3→4 · shuffle 4→1. Then reverse direction immediately for the second lap.',
      guide: [
        ['Set up','Use the painted key (16 ft × 19 ft) or set 4 cones in the same dimensions. Cone 1 is start/finish (foul-line corner).'],
        ['Brief the pattern','Lap 1: sprint 1→2 (forward), defensive shuffle 2→3 (sideways), backpedal 3→4, shuffle 4→1. Lap 2: reverse direction immediately. Athletes must stay outside the lane.'],
        ['Start position','Behind cone 1, athletic stance, facing cone 2. Coach at the line with phone.'],
        ['Cue + start','"Ready, GO." Tap START as they leave cone 1. They must touch the line at each cone with the outside foot.'],
        ['Finish','Tap STOP when both feet cross cone 1 after lap 2. Cutting corners or skipping a cone = re-attempt.'],
      ],
      checklist: ['Painted key clean or 4 cones set','Course walk-through with both laps','Athletes warmed up','Surface non-slip','Stopwatch + this app ready'],
      bands: [
        { ageMax: 13, ex: 12.5, good: 13.5, avg: 14.8, label: '12-13' },
        { ageMax: 15, ex: 11.4, good: 12.4, avg: 13.6, label: '14-15' },
        { ageMax: 99, ex: 10.5, good: 11.5, avg: 12.7, label: '16+' },
      ],
    },
  };

  function bandFor(proto, ageRaw, sec) {
    const age = ageRaw || 14;
    const b = (proto.bands || []).find(x => age <= x.ageMax) || proto.bands[proto.bands.length - 1];
    if (sec <= b.ex)   return { tag: 'Excellent',  cls: 'bnd-ex',   ref: b.label };
    if (sec <= b.good) return { tag: 'Good',       cls: 'bnd-good', ref: b.label };
    if (sec <= b.avg)  return { tag: 'Average',    cls: 'bnd-avg',  ref: b.label };
    return                  { tag: 'Below avg.', cls: 'bnd-low',  ref: b.label };
  }

  /* ------------- State ------------- */
  const $ = id => document.getElementById(id);
  const state = {
    athletes: window.BoxerData ? BoxerData.athletes : [],
    selected: new Set(),
    protoKey: 'ttest',
    attempts: 2,
    queue: [],         // ids in order
    qIdx: 0,           // current athlete index
    aIdx: 0,           // current attempt index for current athlete
    results: {},       // athleteId: [ms, ms, ...]
    timer: null,
    running: false,
  };

  /* ------------- Initial protocol resolve via ?proto=... ------------- */
  const params = new URLSearchParams(location.search);
  const initialProto = params.get('proto');
  if (initialProto && PROTOCOLS[initialProto]) state.protoKey = initialProto;

  function applyProtocol() {
    const p = PROTOCOLS[state.protoKey];
    document.querySelectorAll('.proto-btn').forEach(b => {
      const on = b.dataset.proto === state.protoKey;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    $('brandSub').textContent = p.subtitle;
    $('protoBlurb').textContent = p.blurb;
    $('diagram').innerHTML = p.diagram;
    $('diagramCap').textContent = p.diagramCap;
    // Guide steps
    $('guideSteps').innerHTML = p.guide.map(([title, body], i) =>
      `<li><div class="gs-num">${i+1}</div><div><strong>${title}</strong><p>${body}</p></div></li>`).join('');
    // Checklist
    $('checklist').innerHTML = p.checklist.map(item =>
      `<label class="check"><input type="checkbox" /><span>${item}</span></label>`).join('');
  }

  document.querySelectorAll('.proto-btn').forEach(b => {
    b.addEventListener('click', () => {
      state.protoKey = b.dataset.proto;
      applyProtocol();
    });
  });

  document.querySelectorAll('.att-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.att-btn').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      state.attempts = parseInt(b.dataset.att, 10);
    });
  });

  applyProtocol();

  /* ------------- Setup wiring ------------- */
  $('guideToggle').addEventListener('click', () => {
    const body = $('guideBody');
    const open = !body.hasAttribute('hidden');
    if (open) { body.setAttribute('hidden', ''); $('guideToggle').textContent = 'Show'; $('guideToggle').setAttribute('aria-expanded', 'false'); }
    else      { body.removeAttribute('hidden');  $('guideToggle').textContent = 'Hide'; $('guideToggle').setAttribute('aria-expanded', 'true'); }
  });
  $('muteBtn').addEventListener('click', () => {
    const m = !isMuted(); setMuted(m);
    $('muteBtn').textContent = m ? '🔇' : '🔊';
    $('muteBtn').setAttribute('aria-pressed', m ? 'true' : 'false');
  });

  const rosterApi = VertexRoster.mount({
    container: $('rosterGrid'),
    athletes: state.athletes,
    selected: state.selected,
    onChange: refreshStart,
  });
  $('selectAllBtn').addEventListener('click', () => rosterApi.selectAll());
  $('clearAllBtn').addEventListener('click', () => rosterApi.clear());

  function refreshStart() {
    const n = state.selected.size;
    $('rosterCount').textContent = `${n} / ${state.athletes.length} selected`;
    $('startBtn').disabled = n === 0;
    $('startSub').textContent = n === 0 ? 'Pick at least one athlete' : `${n} athlete${n>1?'s':''} · ${state.attempts} attempts each`;
  }
  refreshStart();

  /* ------------- Start session ------------- */
  $('startBtn').addEventListener('click', () => {
    if (state.selected.size === 0) return;
    state.queue = Array.from(state.selected);
    state.qIdx = 0; state.aIdx = 0;
    state.results = {};
    state.queue.forEach(id => { state.results[id] = []; });
    $('setupScreen').setAttribute('hidden', '');
    $('runScreen').removeAttribute('hidden');
    renderCurrent();
  });

  /* ------------- Run logic ------------- */
  function renderCurrent() {
    if (state.qIdx >= state.queue.length) return endSession();
    const id = state.queue[state.qIdx];
    const a = state.athletes.find(x => x.id === id);
    $('agInit').textContent = a?.initials || a?.name?.slice(0,2) || '—';
    $('agInit').style.setProperty('--accent', a?.accent || '#9bd2ff');
    $('agName').textContent = a?.name || '—';
    $('agAttempt').textContent = 'A' + (state.aIdx + 1);
    $('agOfN').textContent = state.attempts;
    const times = state.results[id] || [];
    const best = times.filter(t => t > 0).length ? Math.min(...times.filter(t=>t>0)) : 0;
    $('agBest').textContent = best > 0 ? fmtTime(best) : '—';
    // Reset clock + action
    state.running = false;
    if (state.timer) state.timer.reset();
    $('bigClock').textContent = '0:00.00';
    $('bigClockSub').textContent = 'tap START when athlete moves';
    const ab = $('agActionBtn');
    ab.textContent = '▶ START';
    ab.classList.remove('ag-stop'); ab.classList.add('ag-start');
    renderAttStrip();
  }

  function renderAttStrip() {
    const strip = $('agAttStrip');
    strip.innerHTML = '';
    // Show all completed athlete-attempts in compact chips
    let done = 0, total = state.queue.length * state.attempts;
    state.queue.forEach(id => {
      const a = state.athletes.find(x => x.id === id);
      const arr = state.results[id] || [];
      arr.forEach(ms => {
        done++;
        const chip = document.createElement('div');
        chip.className = 'ag-att-chip' + (ms === 0 ? ' ag-att-skip' : '');
        chip.style.setProperty('--accent', a?.accent || '#9bd2ff');
        chip.innerHTML = `<span class="agc-init">${a?.initials || ''}</span><span class="agc-time">${ms > 0 ? fmtTime(ms) : 'skipped'}</span>`;
        strip.appendChild(chip);
      });
    });
    $('agProgress').textContent = `${done} / ${total}`;
  }

  $('agActionBtn').addEventListener('click', () => {
    if (!state.running) {
      // Start the clock
      state.running = true;
      $('bigClockSub').textContent = 'running…';
      beep({ freq: 1320, dur: 0.25, vol: 0.6 });
      state.timer = VertexTimer.create({
        mode: 'up', tickHz: 50,
        onTick: ms => { $('bigClock').textContent = fmtTime(ms); },
      });
      state.timer.start();
      const ab = $('agActionBtn');
      ab.textContent = '⏹ STOP';
      ab.classList.remove('ag-start'); ab.classList.add('ag-stop');
    } else {
      // Stop the clock + record
      const ms = state.timer.getElapsed();
      state.timer.stop();
      state.running = false;
      beep({ freq: 660, dur: 0.18, vol: 0.6 });
      const id = state.queue[state.qIdx];
      state.results[id].push(ms);
      advance();
    }
  });

  $('agSkipBtn').addEventListener('click', () => {
    // Skip current attempt (logs 0 = skipped)
    if (state.running && state.timer) { state.timer.stop(); state.running = false; }
    const id = state.queue[state.qIdx];
    state.results[id].push(0);
    advance();
  });

  $('agFinishBtn').addEventListener('click', () => {
    if (confirm('End session now? Athletes without recorded attempts will be marked DNF.')) endSession();
  });

  function advance() {
    state.aIdx++;
    if (state.aIdx >= state.attempts) {
      state.aIdx = 0;
      state.qIdx++;
    }
    if (state.qIdx >= state.queue.length) return endSession();
    renderCurrent();
  }

  /* ------------- Results ------------- */
  function endSession() {
    if (state.timer && state.running) state.timer.stop();
    state.running = false;
    $('runScreen').setAttribute('hidden', '');
    $('resultsScreen').removeAttribute('hidden');

    const proto = PROTOCOLS[state.protoKey];
    const rows = state.queue.map(id => {
      const a = state.athletes.find(x => x.id === id);
      const times = (state.results[id] || []).filter(t => t > 0);
      const best = times.length ? Math.min(...times) : 0;
      return { id, name: a?.name || '—', initials: a?.initials || '', age: a?.age, attempts: state.results[id] || [], best };
    }).sort((x, y) => (x.best || Infinity) - (y.best || Infinity));

    $('rsProto').textContent = proto.name;
    const valid = rows.filter(r => r.best > 0);
    $('rsBest').textContent = valid.length ? fmtTime(valid[0].best) : '—';
    const avg = valid.length ? valid.reduce((s, r) => s + r.best, 0) / valid.length : 0;
    $('rsAvg').textContent = valid.length ? fmtTime(avg) : '—';

    const body = $('resultsBody');
    body.innerHTML = '';
    rows.forEach((r, i) => {
      const b = r.best > 0 ? bandFor(proto, r.age, r.best / 1000) : { tag: '—', cls: '', ref: '—' };
      const attsHtml = r.attempts.map(t => {
        if (t === 0) return '<span class="att-cell att-foul">skip</span>';
        const isBest = t === r.best && r.best > 0;
        return `<span class="att-cell ${isBest ? 'att-best' : ''}">${fmtTime(t)}</span>`;
      }).join('');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="rt-rank">${r.best > 0 ? '#'+(i+1) : 'DNF'}</td>
        <td class="rt-name"><span class="rt-init">${r.initials}</span> ${r.name}</td>
        <td><b>${r.best > 0 ? fmtTime(r.best) : '—'}</b></td>
        <td><div class="att-row">${attsHtml}</div></td>
        <td>${r.best > 0 ? `<span class="bnd ${b.cls}">${b.tag}</span><span class="bnd-ref">${b.ref}</span>` : '—'}</td>`;
      body.appendChild(tr);
    });
  }

  $('saveBtn').addEventListener('click', () => {
    const proto = PROTOCOLS[state.protoKey];
    const payload = state.queue.map(id => {
      const a = state.athletes.find(x => x.id === id);
      const times = (state.results[id] || []).filter(t => t > 0);
      const best = times.length ? Math.min(...times) : 0;
      return { id, name: a?.name, age: a?.age, attempts: state.results[id], bestMs: best, bestSec: best/1000 };
    });
    VertexResults.save('agility', payload, { protocol: state.protoKey, protocolName: proto.name });
    const t = $('saveToast'); t.removeAttribute('hidden');
    setTimeout(() => t.setAttribute('hidden', ''), 2200);
  });
  $('againBtn').addEventListener('click', () => location.reload());
  $('exportBtn').addEventListener('click', () => {
    const data = { protocol: state.protoKey, attempts: state.attempts, results: state.results };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `agility-${state.protoKey}-${Date.now()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

})();
