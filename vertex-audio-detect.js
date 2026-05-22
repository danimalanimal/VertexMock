/* ===========================================================================
   Vertex Audio Detect — bandpass + transient onset detector
   Used by vertical-jump (and future audio-driven tests).

   Usage:
     const det = await VertexAudioDetect.create({
       bandpass: [80, 600],
       sampleRate: 48000,
       frameSize: 256,         // ~5ms @ 48kHz
       deadTimeMs: 100,        // min gap between onsets
       onLevel: (rms) => updateVU(rms),
       onOnset: (timeSec, rms) => {},
     });
     await det.requestMic();   // prompts permission, builds graph
     det.start();              // begins emitting onLevel + onOnset
     det.calibrate(2000).then(({ noiseFloor, noiseCeiling, ok }) => {...});
     det.setThreshold(noiseFloor * 6);
     det.stop();
     det.dispose();

   Public methods:
     requestMic()        - getUserMedia + build audio graph (returns Promise)
     start()             - begin emitting frames
     stop()              - pause emitting (mic stream stays open)
     dispose()           - release mic + close context
     calibrate(ms)       - sample ambient for `ms` ms, return stats
     setThreshold(v)     - set absolute RMS threshold for onset
     getThreshold()      - current threshold
     getRecentSamples()  - return Float32Array of last ~3s of bandpassed audio
     getNowSec()         - AudioContext.currentTime (sample-accurate)
   =========================================================================== */
(() => {
  'use strict';
  if (window.VertexAudioDetect) return;

  async function create({
    bandpass = [80, 600],
    frameSize = 256,
    deadTimeMs = 100,
    onLevel = () => {},
    onOnset = () => {},
    bufferSeconds = 3,
  } = {}) {
    const state = {
      ctx: null,
      stream: null,
      src: null,
      filter: null,
      analyser: null,
      processor: null,
      threshold: 0.05,        // sensible default; calibrate will override
      lastOnsetTime: 0,        // AudioContext seconds
      preFrameRms: 0,          // for spectral-flux-ish gating
      running: false,
      ringBuffer: null,        // Float32Array, circular
      ringWriteIdx: 0,
      ringSamples: 0,
      onLevel, onOnset,
      bandpass, frameSize, deadTimeMs,
      bufferSeconds,
      micPermission: 'prompt', // 'granted' | 'denied' | 'prompt'
    };

    async function requestMic() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }
      try {
        state.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
          },
        });
      } catch (e) {
        state.micPermission = 'denied';
        throw e;
      }
      state.micPermission = 'granted';

      // Build graph
      const AC = window.AudioContext || window.webkitAudioContext;
      state.ctx = new AC();
      // Some browsers start the context suspended; resume on user gesture upstream
      if (state.ctx.state === 'suspended') {
        try { await state.ctx.resume(); } catch (_) {}
      }
      const sr = state.ctx.sampleRate;
      state.ringBuffer = new Float32Array(Math.floor(sr * state.bufferSeconds));
      state.ringWriteIdx = 0;
      state.ringSamples = 0;

      state.src = state.ctx.createMediaStreamSource(state.stream);

      // Bandpass via two cascaded biquads (highpass + lowpass) for steeper roll-off
      const hp = state.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = bandpass[0];
      hp.Q.value = 0.7;
      const lp = state.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = bandpass[1];
      lp.Q.value = 0.7;

      state.filter = { hp, lp };
      state.src.connect(hp);
      hp.connect(lp);

      // ScriptProcessor — works in all browsers including iOS Safari.
      // (AudioWorklet is the modern path but ScriptProcessor is more reliable
      //  cross-device for a feature like this; deprecated but functional.)
      const proc = state.ctx.createScriptProcessor(state.frameSize, 1, 1);
      proc.onaudioprocess = onAudioProcess;
      lp.connect(proc);
      // ScriptProcessor must connect to destination to actually run on some browsers,
      // but we don't want to play mic back. Use a muted gain.
      const muteGain = state.ctx.createGain();
      muteGain.gain.value = 0;
      proc.connect(muteGain);
      muteGain.connect(state.ctx.destination);
      state.processor = proc;
      state.muteGain = muteGain;

      return { sampleRate: sr };
    }

    function onAudioProcess(e) {
      if (!state.running) return;
      const input = e.inputBuffer.getChannelData(0);
      const n = input.length;

      // Write to ring buffer
      const rb = state.ringBuffer;
      const rbLen = rb.length;
      for (let i = 0; i < n; i++) {
        rb[state.ringWriteIdx] = input[i];
        state.ringWriteIdx = (state.ringWriteIdx + 1) % rbLen;
      }
      state.ringSamples = Math.min(state.ringSamples + n, rbLen);

      // Compute RMS over the frame
      let sumSq = 0;
      for (let i = 0; i < n; i++) sumSq += input[i] * input[i];
      const rms = Math.sqrt(sumSq / n);

      // Emit level
      try { state.onLevel(rms); } catch (_) {}

      // Onset detection: rising-edge above threshold, with dead-time
      const now = state.ctx.currentTime;
      const sinceLast = (now - state.lastOnsetTime) * 1000; // ms
      const wasQuiet = state.preFrameRms < state.threshold * 0.6; // hysteresis

      if (rms >= state.threshold && wasQuiet && sinceLast >= state.deadTimeMs) {
        state.lastOnsetTime = now;
        try { state.onOnset(now, rms); } catch (_) {}
      }
      state.preFrameRms = rms;
    }

    function start() {
      if (!state.ctx) return false;
      state.running = true;
      // Reset gating state on each start
      state.preFrameRms = 0;
      state.lastOnsetTime = 0;
      return true;
    }
    function stop() { state.running = false; }

    function dispose() {
      state.running = false;
      try { state.processor && state.processor.disconnect(); } catch (_) {}
      try { state.muteGain && state.muteGain.disconnect(); } catch (_) {}
      try { state.filter && state.filter.hp.disconnect(); } catch (_) {}
      try { state.filter && state.filter.lp.disconnect(); } catch (_) {}
      try { state.src && state.src.disconnect(); } catch (_) {}
      try { state.stream && state.stream.getTracks().forEach(t => t.stop()); } catch (_) {}
      try { state.ctx && state.ctx.close(); } catch (_) {}
      state.ctx = state.stream = state.src = state.filter = state.processor = null;
    }

    /**
     * Sample ambient noise for `ms` milliseconds and return stats.
     * Returns { noiseFloorRms, noiseCeilingRms, peakRms, dynamicDb, frames, ok, reason }
     */
    function calibrate(ms = 2000) {
      return new Promise((resolve) => {
        const samples = [];
        const prevOnLevel = state.onLevel;
        const prevOnOnset = state.onOnset;
        // Override during calibration
        state.onLevel = (rms) => {
          samples.push(rms);
          try { prevOnLevel(rms); } catch (_) {}
        };
        state.onOnset = () => {}; // ignore onsets during calibration
        const wasRunning = state.running;
        if (!wasRunning) start();

        setTimeout(() => {
          // Restore handlers
          state.onLevel = prevOnLevel;
          state.onOnset = prevOnOnset;

          if (samples.length < 4) {
            resolve({ ok: false, reason: 'no-samples', frames: samples.length });
            return;
          }
          const sorted = samples.slice().sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          const p95    = sorted[Math.floor(sorted.length * 0.95)];
          const peak   = sorted[sorted.length - 1];
          const dynamicDb = 20 * Math.log10(Math.max(p95, 1e-6) / Math.max(median, 1e-6));

          // Verdicts
          // Empirical: anything > 0.04 RMS in a quiet gym is "loud"; < 0.005 is "very quiet"
          const TOO_LOUD = 0.04;
          const STABLE_DB = 9;     // dynamic range above this = unstable / spike-prone
          let verdict, reason;
          if (median > TOO_LOUD) {
            verdict = 'too-loud';
            reason = 'Background noise too high';
          } else if (dynamicDb > STABLE_DB || peak > median * 8) {
            verdict = 'mixed';
            reason = 'Detected noise spikes — try again or continue carefully';
          } else {
            verdict = 'good';
            reason = 'Room is quiet enough';
          }

          resolve({
            ok: verdict !== 'too-loud',
            verdict, reason,
            noiseFloorRms: median,
            noiseCeilingRms: p95,
            peakRms: peak,
            dynamicDb,
            frames: samples.length,
          });
        }, ms);
      });
    }

    function setThreshold(v) { state.threshold = Math.max(v, 0.005); }
    function getThreshold()  { return state.threshold; }

    function getRecentSamples(seconds) {
      const want = Math.min(state.ctx.sampleRate * seconds, state.ringBuffer.length);
      const out = new Float32Array(want);
      // Read backwards from the write head
      const rb = state.ringBuffer;
      const rbLen = rb.length;
      let idx = (state.ringWriteIdx - want + rbLen) % rbLen;
      for (let i = 0; i < want; i++) {
        out[i] = rb[idx];
        idx = (idx + 1) % rbLen;
      }
      return out;
    }
    function getNowSec() { return state.ctx ? state.ctx.currentTime : 0; }

    return {
      requestMic, start, stop, dispose, calibrate,
      setThreshold, getThreshold,
      getRecentSamples, getNowSec,
      get state() { return state.micPermission; },
      // Allow runtime swap of handlers (used during state changes)
      setHandlers({ onLevel, onOnset }) {
        if (onLevel) state.onLevel = onLevel;
        if (onOnset) state.onOnset = onOnset;
      },
    };
  }

  window.VertexAudioDetect = { create };
})();
