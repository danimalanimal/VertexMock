/* ===========================================================================
   Vertex Audio — shared Web Audio synth + Web Speech wrapper
   Lifted from beep-test.js so every test page can play cadence cues.
   Lazy-initialises AudioContext on first beep (required by iOS autoplay).
   =========================================================================== */
(() => {
  'use strict';
  if (window.VertexAudio) return;

  const state = { ctx: null, muted: false };

  function ensureCtx() {
    if (!state.ctx) {
      try { state.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    return state.ctx;
  }

  function beep({ freq = 880, dur = 0.18, vol = 0.5 } = {}) {
    if (state.muted) return;
    const ctx = ensureCtx(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  function speak(text) {
    if (state.muted || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05; u.pitch = 1.0; u.volume = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }

  function setMuted(m) {
    state.muted = !!m;
    if (state.muted && window.speechSynthesis) window.speechSynthesis.cancel();
  }
  function isMuted() { return state.muted; }

  window.VertexAudio = { beep, speak, setMuted, isMuted };
})();
