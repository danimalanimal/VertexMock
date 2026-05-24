/* ===========================================================================
   Vertex Audio Detect — bandpass + transient onset detector
   Used by vertical-jump, cmj, and future audio-driven tests.

   v2: Tier-1 accuracy upgrades
     - Spectral fingerprint at trigger (4-band power ratio from FFT of ~50ms window)
     - Onset-shape gating (attack/decay ratio)
     - Adaptive rolling noise floor + threshold
     - Gain-shift detection (iOS AGC) with optional re-cal callback
     - onOnset(time, rms, classification) — classification is { kind, bands, attack, decay, conf }

   Usage:
     const det = await VertexAudioDetect.create({
       bandpass: [80, 4000],
       frameSize: 256,
       deadTimeMs: 100,
       adaptive: true,              // enable rolling noise floor (default true)
       onLevel: (rms) => updateVU(rms),
       onOnset: (timeSec, rms, classification) => {},
       onGainShift: ({oldFloor, newFloor}) => {},
     });
     await det.requestMic();
     det.start();
     det.calibrate(2000).then(...);

   Classification kinds (post-FFT verdict):
     'rip'        — broadband, high-freq dominant (tape rip, paper tear, scuff)
     'thud'       — low-freq dominant, slow decay (foot landing, body impact)
     'voice'      — mid-freq formants, slow attack (speech, music)
     'clap'       — broadband, very short, mid-freq peak (hand clap)
     'unknown'    — energy spike but doesn't fit any class
   =========================================================================== */
(() => {
  'use strict';
  if (window.VertexAudioDetect) return;

  // ---------- FFT (small radix-2 in-place Cooley-Tukey) -----------------------
  // Operates on real input of length N (power of 2). Returns magnitude array of length N/2.
  function fftMag(input) {
    const N = input.length;
    // Copy real, zero imaginary
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    for (let i = 0; i < N; i++) re[i] = input[i];
    // Bit-reversal
    let j = 0;
    for (let i = 1; i < N; i++) {
      let bit = N >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    // Cooley-Tukey
    for (let len = 2; len <= N; len <<= 1) {
      const half = len >> 1;
      const ang = -2 * Math.PI / len;
      const wRe = Math.cos(ang), wIm = Math.sin(ang);
      for (let i = 0; i < N; i += len) {
        let curRe = 1, curIm = 0;
        for (let k = 0; k < half; k++) {
          const tRe = curRe * re[i + k + half] - curIm * im[i + k + half];
          const tIm = curRe * im[i + k + half] + curIm * re[i + k + half];
          re[i + k + half] = re[i + k] - tRe;
          im[i + k + half] = im[i + k] - tIm;
          re[i + k] += tRe;
          im[i + k] += tIm;
          const nRe = curRe * wRe - curIm * wIm;
          curIm = curRe * wIm + curIm * wRe;
          curRe = nRe;
        }
      }
    }
    const mag = new Float32Array(N / 2);
    for (let i = 0; i < N / 2; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    return mag;
  }

  // ---------- Classifier ------------------------------------------------------
  // Given a magnitude spectrum + sample rate + attack/decay shape, return a verdict.
  function classifyOnset({ mag, sampleRate, attack, decay, peakRms }) {
    const N2 = mag.length; // FFT bins (N/2)
    const binHz = sampleRate / 2 / N2;
    // Band integrators
    const bands = {
      sub:    energyInBand(mag, binHz,    0,  150),  // body thud, room rumble
      low:    energyInBand(mag, binHz,  150,  600),  // landing thud body
      mid:    energyInBand(mag, binHz,  600, 1800),  // voice fundamentals, claps
      high:   energyInBand(mag, binHz, 1800, 6000),  // tape rip, scuff, sibilance
    };
    const total = bands.sub + bands.low + bands.mid + bands.high + 1e-9;
    const ratios = {
      sub:  bands.sub  / total,
      low:  bands.low  / total,
      mid:  bands.mid  / total,
      high: bands.high / total,
    };
    const lowDom  = ratios.sub + ratios.low;   // 0–600 Hz
    const highDom = ratios.high;               // 1.8–6 kHz
    const midDom  = ratios.mid;                // 600–1800 Hz

    // Default: unknown
    let kind = 'unknown', conf = 0.3;

    // Thud: low-frequency dominant, longer decay (impacts ring)
    if (lowDom > 0.55 && highDom < 0.20) {
      kind = 'thud';
      conf = Math.min(0.95, 0.55 + (lowDom - 0.55) * 1.2 + (decay > 0.5 ? 0.1 : 0));
    }
    // Rip: broad spectrum with significant high-band energy, fast attack
    else if (highDom > 0.22 && attack < 0.4) {
      kind = 'rip';
      conf = Math.min(0.95, 0.55 + (highDom - 0.22) * 1.5 + (attack < 0.25 ? 0.1 : 0));
    }
    // Clap: very broad, mid-band peak, very fast attack, very fast decay
    else if (midDom > 0.35 && attack < 0.25 && decay < 0.4) {
      kind = 'clap';
      conf = 0.6;
    }
    // Voice: mid-band dominant, slower attack
    else if (midDom > 0.40 && attack > 0.35) {
      kind = 'voice';
      conf = 0.55;
    }
    return { kind, conf, bands: ratios, attack, decay, peakRms };
  }

  function energyInBand(mag, binHz, fLo, fHi) {
    const lo = Math.max(1, Math.floor(fLo / binHz));
    const hi = Math.min(mag.length - 1, Math.ceil(fHi / binHz));
    let s = 0;
    for (let i = lo; i <= hi; i++) s += mag[i] * mag[i];
    return Math.sqrt(s);
  }

  // ---------- Detector --------------------------------------------------------
  async function create({
    bandpass = [80, 4000],
    frameSize = 256,
    deadTimeMs = 100,
    bufferSeconds = 3,
    adaptive = true,
    fftSize = 1024,             // ~21ms @ 48k — good time/freq trade-off
    classifyTailFrames = 4,     // accumulate this many frames after trigger before classifying
    onLevel = () => {},
    onOnset = () => {},
    onGainShift = null,
  } = {}) {

    const state = {
      ctx: null,
      stream: null,
      src: null,
      filter: null,
      analyser: null,
      processor: null,
      // Raw (unfiltered) source for spectral analysis — bandpass would distort the classifier
      rawSrc: null, rawProcessor: null, rawBuffer: null, rawWriteIdx: 0,

      threshold: 0.05,
      baseThreshold: 0.05,
      secondaryThreshold: null,
      secondaryUntil: 0,
      lastOnsetTime: 0,
      preFrameRms: 0,
      running: false,
      ringBuffer: null,        // bandpassed audio for waveform display
      ringWriteIdx: 0,
      ringSamples: 0,

      // Adaptive noise floor (rolling median-ish via low-pass on RMS)
      adaptive,
      rollingFloor: 0.005,
      rollingFloorAlpha: 0.02,  // ~5s @ 100 fps
      lastReportedFloor: 0.005,
      gainShiftThresh: 2.5,     // 2.5x floor change = gain shift

      // Pending onset awaiting tail-frames for classification
      pendingOnset: null,        // { time, rms, framesCollected, attackEnergy, peakEnergy, tailEnergies, frames: [] }

      onLevel, onOnset, onGainShift,
      bandpass, frameSize, deadTimeMs,
      bufferSeconds, fftSize, classifyTailFrames,
      micPermission: 'prompt',
    };

    async function requestMic() {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia not supported');
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

      const AC = window.AudioContext || window.webkitAudioContext;
      state.ctx = new AC();
      if (state.ctx.state === 'suspended') {
        try { await state.ctx.resume(); } catch (_) {}
      }
      const sr = state.ctx.sampleRate;
      state.ringBuffer = new Float32Array(Math.floor(sr * state.bufferSeconds));
      state.ringWriteIdx = 0;
      state.ringSamples = 0;

      // Raw-audio ring for FFT classifier (we want unfiltered signal for spectral analysis)
      state.rawBuffer = new Float32Array(Math.max(state.fftSize * 4, 8192));
      state.rawWriteIdx = 0;

      state.src = state.ctx.createMediaStreamSource(state.stream);

      // === Filtered chain for threshold detection ===
      const hp = state.ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = bandpass[0]; hp.Q.value = 0.7;
      const lp = state.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = bandpass[1]; lp.Q.value = 0.7;
      state.filter = { hp, lp };
      state.src.connect(hp); hp.connect(lp);

      const proc = state.ctx.createScriptProcessor(state.frameSize, 1, 1);
      proc.onaudioprocess = onAudioProcess;
      lp.connect(proc);
      const muteGain = state.ctx.createGain();
      muteGain.gain.value = 0;
      proc.connect(muteGain); muteGain.connect(state.ctx.destination);
      state.processor = proc;
      state.muteGain = muteGain;

      // === Raw chain for spectral analysis ===
      const rawProc = state.ctx.createScriptProcessor(state.frameSize, 1, 1);
      rawProc.onaudioprocess = onRawAudioProcess;
      state.src.connect(rawProc);
      const rawMute = state.ctx.createGain();
      rawMute.gain.value = 0;
      rawProc.connect(rawMute); rawMute.connect(state.ctx.destination);
      state.rawProcessor = rawProc;
      state.rawMute = rawMute;

      return { sampleRate: sr };
    }

    function onRawAudioProcess(e) {
      if (!state.running) return;
      const input = e.inputBuffer.getChannelData(0);
      const n = input.length;
      const rb = state.rawBuffer;
      const rbLen = rb.length;
      for (let i = 0; i < n; i++) {
        rb[state.rawWriteIdx] = input[i];
        state.rawWriteIdx = (state.rawWriteIdx + 1) % rbLen;
      }
    }

    // Read last `N` raw samples for FFT
    function getRawWindow(N) {
      const rb = state.rawBuffer;
      const rbLen = rb.length;
      const out = new Float32Array(N);
      let idx = (state.rawWriteIdx - N + rbLen) % rbLen;
      for (let i = 0; i < N; i++) { out[i] = rb[idx]; idx = (idx + 1) % rbLen; }
      // Hann window to reduce spectral leakage
      for (let i = 0; i < N; i++) {
        const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
        out[i] *= w;
      }
      return out;
    }

    function onAudioProcess(e) {
      if (!state.running) return;
      const input = e.inputBuffer.getChannelData(0);
      const n = input.length;

      const rb = state.ringBuffer;
      const rbLen = rb.length;
      for (let i = 0; i < n; i++) {
        rb[state.ringWriteIdx] = input[i];
        state.ringWriteIdx = (state.ringWriteIdx + 1) % rbLen;
      }
      state.ringSamples = Math.min(state.ringSamples + n, rbLen);

      let sumSq = 0;
      for (let i = 0; i < n; i++) sumSq += input[i] * input[i];
      const rms = Math.sqrt(sumSq / n);

      try { state.onLevel(rms); } catch (_) {}

      const now = state.ctx.currentTime;
      const sinceLast = (now - state.lastOnsetTime) * 1000;

      // ---- Adaptive rolling floor + gain-shift detection -------------------
      if (state.adaptive && !state.pendingOnset) {
        // Update rolling floor only when not in/near an onset (avoid biasing toward loud frames)
        if (rms < state.baseThreshold) {
          const a = state.rollingFloorAlpha;
          state.rollingFloor = (1 - a) * state.rollingFloor + a * rms;

          // Detect gain shift: rolling floor diverges from last-reported floor
          if (state.lastReportedFloor > 0) {
            const ratio = state.rollingFloor / state.lastReportedFloor;
            if ((ratio > state.gainShiftThresh || ratio < 1 / state.gainShiftThresh) && state.onGainShift) {
              try { state.onGainShift({ oldFloor: state.lastReportedFloor, newFloor: state.rollingFloor, ratio }); } catch (_) {}
              state.lastReportedFloor = state.rollingFloor;
            }
          }
        }
      }

      // ---- Active threshold (secondary > base) -----------------------------
      let activeThresh = state.baseThreshold;
      if (state.secondaryThreshold != null && now < state.secondaryUntil) {
        activeThresh = state.secondaryThreshold;
      } else if (state.secondaryThreshold != null && now >= state.secondaryUntil) {
        state.secondaryThreshold = null;
      }
      state.threshold = activeThresh;

      // ---- Pending-onset tail collection (for classification) --------------
      if (state.pendingOnset) {
        state.pendingOnset.tailEnergies.push(rms);
        if (rms > state.pendingOnset.peakEnergy) state.pendingOnset.peakEnergy = rms;
        state.pendingOnset.framesCollected++;
        if (state.pendingOnset.framesCollected >= state.classifyTailFrames) {
          finalizeOnset();
        }
      }

      // ---- Trigger detection -----------------------------------------------
      const wasQuiet = state.preFrameRms < activeThresh * 0.6;
      if (rms >= activeThresh && wasQuiet && sinceLast >= state.deadTimeMs && !state.pendingOnset) {
        // Begin a pending onset — gather a few tail frames before classifying
        state.lastOnsetTime = now;
        state.pendingOnset = {
          time: now,
          rms,
          peakEnergy: rms,
          attackEnergy: state.preFrameRms,
          tailEnergies: [rms],
          framesCollected: 1,
        };
      }
      state.preFrameRms = rms;
    }

    function finalizeOnset() {
      const p = state.pendingOnset;
      state.pendingOnset = null;
      if (!p) return;

      // attack ratio: how quickly did energy ramp from pre-frame to peak?
      // attack ∈ [0,1] where 0 = instant transient, 1 = slow ramp
      const attack = p.attackEnergy / Math.max(p.peakEnergy, 1e-6);

      // decay shape: average of tail / peak. Lower = sharper transient.
      let tailSum = 0;
      for (let i = 1; i < p.tailEnergies.length; i++) tailSum += p.tailEnergies[i];
      const tailAvg = tailSum / Math.max(p.tailEnergies.length - 1, 1);
      const decay = tailAvg / Math.max(p.peakEnergy, 1e-6);

      // FFT of raw window around the onset
      const N = state.fftSize;
      const raw = getRawWindow(N);
      const mag = fftMag(raw);

      const verdict = classifyOnset({
        mag, sampleRate: state.ctx.sampleRate,
        attack, decay, peakRms: p.peakEnergy,
      });

      try { state.onOnset(p.time, p.rms, verdict); } catch (e) { /* swallow */ }
    }

    function start() {
      if (!state.ctx) return false;
      state.running = true;
      state.preFrameRms = 0;
      state.lastOnsetTime = 0;
      state.pendingOnset = null;
      return true;
    }
    function stop() { state.running = false; }

    function dispose() {
      state.running = false;
      try { state.processor?.disconnect(); } catch (_) {}
      try { state.rawProcessor?.disconnect(); } catch (_) {}
      try { state.muteGain?.disconnect(); } catch (_) {}
      try { state.rawMute?.disconnect(); } catch (_) {}
      try { state.filter?.hp.disconnect(); } catch (_) {}
      try { state.filter?.lp.disconnect(); } catch (_) {}
      try { state.src?.disconnect(); } catch (_) {}
      try { state.stream?.getTracks().forEach(t => t.stop()); } catch (_) {}
      try { state.ctx?.close(); } catch (_) {}
      state.ctx = state.stream = state.src = state.filter = state.processor = null;
    }

    function calibrate(ms = 2000) {
      return new Promise((resolve) => {
        const samples = [];
        const prevOnLevel = state.onLevel;
        const prevOnOnset = state.onOnset;
        state.onLevel = (rms) => { samples.push(rms); try { prevOnLevel(rms); } catch (_) {} };
        state.onOnset = () => {};
        const wasRunning = state.running;
        if (!wasRunning) start();

        setTimeout(() => {
          state.onLevel = prevOnLevel;
          state.onOnset = prevOnOnset;
          if (samples.length < 4) { resolve({ ok: false, reason: 'no-samples', frames: samples.length }); return; }
          const sorted = samples.slice().sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          const p95    = sorted[Math.floor(sorted.length * 0.95)];
          const peak   = sorted[sorted.length - 1];
          const dynamicDb = 20 * Math.log10(Math.max(p95, 1e-6) / Math.max(median, 1e-6));

          const TOO_LOUD = 0.04;
          const STABLE_DB = 9;
          let verdict, reason;
          if (median > TOO_LOUD)                         { verdict = 'too-loud'; reason = 'Background noise too high'; }
          else if (dynamicDb > STABLE_DB || peak > median * 8) { verdict = 'mixed'; reason = 'Detected noise spikes — try again or continue carefully'; }
          else                                           { verdict = 'good'; reason = 'Room is quiet enough'; }

          // Seed the rolling floor + lastReportedFloor
          state.rollingFloor = median;
          state.lastReportedFloor = median;

          resolve({
            ok: verdict !== 'too-loud', verdict, reason,
            noiseFloorRms: median, noiseCeilingRms: p95, peakRms: peak,
            dynamicDb, frames: samples.length,
          });
        }, ms);
      });
    }

    function setThreshold(v) {
      const safe = Math.max(v, 0.005);
      state.baseThreshold = safe;
      if (state.secondaryThreshold == null) state.threshold = safe;
    }
    function getThreshold() { return state.threshold; }
    function getRollingFloor() { return state.rollingFloor; }

    function setSecondaryThreshold(v, windowMs = 400) {
      if (v == null) { state.secondaryThreshold = null; state.secondaryUntil = 0; return; }
      state.secondaryThreshold = Math.max(v, 0.003);
      state.secondaryUntil = (state.ctx ? state.ctx.currentTime : 0) + (windowMs / 1000);
    }

    function getRecentSamples(seconds) {
      const want = Math.min(state.ctx.sampleRate * seconds, state.ringBuffer.length);
      const out = new Float32Array(want);
      const rb = state.ringBuffer;
      const rbLen = rb.length;
      let idx = (state.ringWriteIdx - want + rbLen) % rbLen;
      for (let i = 0; i < want; i++) { out[i] = rb[idx]; idx = (idx + 1) % rbLen; }
      return out;
    }
    // Raw (unfiltered) samples for clip recording & ML training
    function getRawSamples(seconds) {
      const want = Math.min(state.ctx.sampleRate * seconds, state.rawBuffer.length);
      const out = new Float32Array(want);
      const rb = state.rawBuffer;
      const rbLen = rb.length;
      let idx = (state.rawWriteIdx - want + rbLen) % rbLen;
      for (let i = 0; i < want; i++) { out[i] = rb[idx]; idx = (idx + 1) % rbLen; }
      return out;
    }
    function getNowSec() { return state.ctx ? state.ctx.currentTime : 0; }
    function getSampleRate() { return state.ctx ? state.ctx.sampleRate : 0; }

    return {
      requestMic, start, stop, dispose, calibrate,
      setThreshold, getThreshold, setSecondaryThreshold,
      getRollingFloor,
      getRecentSamples, getRawSamples, getNowSec, getSampleRate,
      get state() { return state.micPermission; },
      setHandlers({ onLevel, onOnset, onGainShift }) {
        if (onLevel) state.onLevel = onLevel;
        if (onOnset) state.onOnset = onOnset;
        if (onGainShift !== undefined) state.onGainShift = onGainShift;
      },
    };
  }

  window.VertexAudioDetect = { create, _fftMag: fftMag, _classifyOnset: classifyOnset };
})();
