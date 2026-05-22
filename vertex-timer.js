/* ===========================================================================
   Vertex Timer — shared count-up / count-down engine
   Used by plank-test, time-trial (and future Wave 3/4 tests).
   Drift-corrected (clock-based, not interval-based), pause/resume, tick callbacks.

   Usage:
     const t = VertexTimer.create({
       mode: 'up',                    // 'up' or 'down'
       startMs: 0,                    // for 'down' mode this is the initial value
       onTick: (ms) => updateClock(ms),
       onMilestone: (ms) => beep(),   // fired when ms passes any value in milestones
       milestones: [30000, 60000, 90000, 120000, 180000],
       onComplete: () => {},          // for 'down' mode when ms reaches 0
     });
     t.start(); t.pause(); t.resume(); t.stop(); t.reset();
     t.getElapsed() / t.getRemaining()
   =========================================================================== */
(() => {
  'use strict';
  if (window.VertexTimer) return;

  function create({
    mode = 'up',
    startMs = 0,
    onTick = () => {},
    onMilestone = () => {},
    milestones = [],
    onComplete = () => {},
    tickHz = 10,
  } = {}) {
    let raf = null;
    let interval = null;
    let running = false;
    let t0 = 0;          // wall-clock when this run-segment started
    let acc = 0;         // accumulated ms across pauses
    let hitMs = new Set();

    function now() { return performance.now(); }

    function currentMs() {
      const elapsed = acc + (running ? (now() - t0) : 0);
      return mode === 'down' ? Math.max(0, startMs - elapsed) : elapsed;
    }

    function tick() {
      const ms = currentMs();
      onTick(ms);
      // milestones — in 'up' mode fire when we PASS them
      if (mode === 'up') {
        milestones.forEach(m => {
          if (ms >= m && !hitMs.has(m)) { hitMs.add(m); onMilestone(m); }
        });
      } else {
        milestones.forEach(m => {
          if (ms <= m && !hitMs.has(m) && currentMs() <= m) {
            hitMs.add(m); onMilestone(m);
          }
        });
      }
      if (mode === 'down' && ms <= 0 && running) {
        running = false;
        clearInterval(interval); interval = null;
        onComplete();
      }
    }

    function start() {
      if (running) return;
      acc = 0; hitMs.clear();
      t0 = now(); running = true;
      interval = setInterval(tick, 1000 / tickHz);
      tick();
    }
    function pause() {
      if (!running) return;
      acc += now() - t0;
      running = false;
      clearInterval(interval); interval = null;
    }
    function resume() {
      if (running) return;
      t0 = now(); running = true;
      interval = setInterval(tick, 1000 / tickHz);
    }
    function stop() {
      if (running) acc += now() - t0;
      running = false;
      clearInterval(interval); interval = null;
      return acc;
    }
    function reset() {
      running = false;
      clearInterval(interval); interval = null;
      acc = 0; hitMs.clear();
      onTick(mode === 'down' ? startMs : 0);
    }
    function isRunning() { return running; }
    function getElapsed() { return acc + (running ? (now() - t0) : 0); }
    function getRemaining() { return mode === 'down' ? Math.max(0, startMs - getElapsed()) : 0; }

    return { start, pause, resume, stop, reset, isRunning, getElapsed, getRemaining };
  }

  // Format helpers
  function fmtMMSS(ms) {
    const totalSec = Math.floor(Math.max(0, ms) / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function fmtMMSSt(ms) {
    // MM:SS.t  (one decimal)
    const safe = Math.max(0, ms);
    const totalSec = safe / 1000;
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec - m * 60);
    const t = Math.floor((safe % 1000) / 100);
    return `${m}:${String(s).padStart(2, '0')}.${t}`;
  }
  function fmtPace(secPerKm) {
    if (!isFinite(secPerKm) || secPerKm <= 0) return '—';
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${String(s).padStart(2, '0')}/km`;
  }

  window.VertexTimer = { create, fmtMMSS, fmtMMSSt, fmtPace };
})();
