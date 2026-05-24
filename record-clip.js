/* record-clip.js — coach-facing audio clip capture tool
 *
 * Pipeline:
 *   1. Tap RECORD → unlock AudioContext (iOS Safari requires tap-gated start)
 *   2. Acquire mic via VertexAudioDetect (gives us raw samples + sample rate)
 *   3. Run a 4s capture window. Continuously buffer samples; auto-stop at 4s.
 *   4. Render waveform preview to <canvas>.
 *   5. On UPLOAD: encode buffered Float32 → 16-bit PCM WAV, upload via @vercel/blob/client.
 *
 * We re-use VertexAudioDetect on purpose:
 *   - mic constraints already disable AGC/echo/noise (clean signal)
 *   - getRawSamples() returns unfiltered audio (we DO NOT want the bandpassed signal — uploads should preserve the full
 *     spectrum so future detector tuning can be done on the original)
 *   - getSampleRate() exposes ctx.sampleRate
 */

(function () {
  'use strict';

  // KEEP IN SYNC with api/upload-clip.js VALID_LABELS
  const LABELS = [
    { key: 'clean-rip-land',    title: 'Clean rip + land', sub: 'CMJ: tape rip → landing thud' },
    { key: 'clean-drop-triple', title: 'Clean drop triple', sub: 'Drop jump: drop → scuff → land' },
    { key: 'clean-drop-double', title: 'Clean drop double', sub: 'Drop jump: just drop + land (no scuff)' },
    { key: 'soft-landing',      title: 'Soft landing', sub: 'Real jump, landing too quiet to detect' },
    { key: 'partial-rip',       title: 'Partial rip', sub: 'Only half the tape came off' },
    { key: 'false-positive',    title: 'False positive', sub: 'Looked like an impact, wasn\'t a jump' },
    { key: 'voice',             title: 'Voice / speech', sub: 'Coach or bystander talking' },
    { key: 'clap',              title: 'Clap', sub: 'Hand clap' },
    { key: 'bag-drop',          title: 'Bag / ball drop', sub: 'Equipment drop, ball bounce' },
    { key: 'shoe-squeak',       title: 'Shoe squeak', sub: 'Pivot squeak on hardwood' },
    { key: 'doorslam-noise',    title: 'Background noise', sub: 'Doors, weights, machine clank' },
    { key: 'silence',           title: 'Silence', sub: 'Quiet reference clip' },
    { key: 'other',             title: 'Other', sub: 'Add a note explaining what' },
  ];

  const RECORD_SECONDS = 4;
  const COUNTDOWN_FROM = RECORD_SECONDS;  // visual countdown starts at this many seconds

  // ---- DOM refs ----
  const labelGrid    = document.getElementById('labelGrid');
  const coachField   = document.getElementById('coachField');
  const noteField    = document.getElementById('noteField');
  const recordBtn    = document.getElementById('recordBtn');
  const countdownEl  = document.getElementById('countdown');
  const statusLine   = document.getElementById('statusLine');
  const waveCanvas   = document.getElementById('waveCanvas');
  const reviewRow    = document.getElementById('reviewRow');
  const playBtn      = document.getElementById('playBtn');
  const discardBtn   = document.getElementById('discardBtn');
  const uploadBtn    = document.getElementById('uploadBtn');
  const uploadStatus = document.getElementById('uploadStatus');
  const toast        = document.getElementById('toast');

  // ---- State ----
  const state = {
    detector: null,         // VertexAudioDetect instance (lazy-init on first tap)
    selectedLabel: null,    // string key from LABELS
    samples: null,          // Float32Array of recorded audio
    sampleRate: 0,
    recording: false,
    countdownTimer: null,
    stopTimer: null,
    audioPreview: null,     // Audio element for playback
    wavBlobUrl: null,       // object URL for preview playback
  };

  // ---- Label picker setup ----
  function renderLabels() {
    labelGrid.innerHTML = LABELS.map(l =>
      `<button class="label-pill" type="button" role="radio" aria-checked="false" data-key="${l.key}">
        <span class="lp-key">${l.title}</span>
        <span class="lp-sub">${l.sub}</span>
      </button>`
    ).join('');
    labelGrid.querySelectorAll('.label-pill').forEach(btn => {
      btn.addEventListener('pointerdown', () => selectLabel(btn.dataset.key));
    });
  }
  function selectLabel(key) {
    state.selectedLabel = key;
    labelGrid.querySelectorAll('.label-pill').forEach(b => {
      const on = b.dataset.key === key;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  // ---- Coach name persistence (localStorage) ----
  function loadCoach() {
    try { coachField.value = localStorage.getItem('vertex.coach') || ''; } catch (_) {}
  }
  function saveCoach() {
    try { localStorage.setItem('vertex.coach', coachField.value.trim()); } catch (_) {}
  }
  coachField && coachField.addEventListener('change', saveCoach);
  coachField && coachField.addEventListener('blur', saveCoach);

  // ---- Toast ----
  let toastTimer = null;
  function showToast(msg, isError = false) {
    toast.textContent = msg;
    toast.classList.toggle('err', isError);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // ---- Status ----
  function setStatus(msg) { statusLine.textContent = msg; }

  // ---- Detector init (lazy — needs user gesture for iOS) ----
  async function ensureDetector() {
    if (state.detector) return state.detector;
    if (!window.VertexAudioDetect) throw new Error('VertexAudioDetect not loaded');

    // bufferSeconds: must hold full RECORD_SECONDS plus a little headroom for jitter
    state.detector = await window.VertexAudioDetect.create({
      bufferSeconds: RECORD_SECONDS + 1,
      // we don't care about onset detection here — set onOnset to noop, but threshold
      // doesn't matter because we never call .start()'s detector loop output for this page
      onOnset: () => {},
      onLevel: () => {},
    });
    await state.detector.requestMic();
    state.detector.start();
    state.sampleRate = state.detector.getSampleRate();
    return state.detector;
  }

  // ---- Recording flow ----
  async function startRecording() {
    if (state.recording) return;
    if (!state.selectedLabel) {
      showToast('Pick a label first', true);
      return;
    }

    try {
      setStatus('Requesting microphone…');
      await ensureDetector();
    } catch (err) {
      setStatus('Mic blocked: ' + err.message);
      showToast('Microphone access denied', true);
      return;
    }

    // Reset previous capture
    revokePreview();
    state.samples = null;
    waveCanvas.hidden = true;
    reviewRow.hidden = true;
    uploadStatus.hidden = true;

    state.recording = true;
    recordBtn.classList.add('recording');
    recordBtn.textContent = 'RECORDING…';
    setStatus(`Recording — ${RECORD_SECONDS}s window`);

    // Visual countdown
    let remaining = COUNTDOWN_FROM;
    countdownEl.textContent = remaining.toFixed(1);
    state.countdownTimer = setInterval(() => {
      remaining -= 0.1;
      if (remaining <= 0) {
        countdownEl.textContent = '0.0';
        clearInterval(state.countdownTimer);
        state.countdownTimer = null;
      } else {
        countdownEl.textContent = remaining.toFixed(1);
      }
    }, 100);

    // Hard stop after RECORD_SECONDS
    state.stopTimer = setTimeout(() => finalizeRecording(), RECORD_SECONDS * 1000);
  }

  function finalizeRecording() {
    if (!state.recording) return;
    state.recording = false;
    clearInterval(state.countdownTimer);
    clearTimeout(state.stopTimer);
    state.countdownTimer = state.stopTimer = null;

    recordBtn.classList.remove('recording');
    recordBtn.textContent = 'RECORD (4s)';

    // Grab the last N seconds of raw samples from the detector
    state.samples = state.detector.getRawSamples(RECORD_SECONDS);
    if (!state.samples || state.samples.length === 0) {
      setStatus('No samples captured — try again');
      showToast('Recording failed', true);
      return;
    }

    setStatus(`Captured ${state.samples.length} samples @ ${state.sampleRate} Hz (${(state.samples.length / state.sampleRate).toFixed(2)}s)`);
    drawWaveform(state.samples);
    waveCanvas.hidden = false;
    reviewRow.hidden = false;
    countdownEl.textContent = '✓';

    // Build a WAV blob for immediate playback
    const wavBlob = encodeWav(state.samples, state.sampleRate);
    state.wavBlobUrl = URL.createObjectURL(wavBlob);
    state.audioPreview = new Audio(state.wavBlobUrl);
  }

  function revokePreview() {
    if (state.wavBlobUrl) {
      try { URL.revokeObjectURL(state.wavBlobUrl); } catch (_) {}
      state.wavBlobUrl = null;
    }
    state.audioPreview = null;
  }

  // ---- Waveform render ----
  function drawWaveform(samples) {
    const ctx = waveCanvas.getContext('2d');
    const W = waveCanvas.width = waveCanvas.clientWidth * (window.devicePixelRatio || 1);
    const H = waveCanvas.height = 90 * (window.devicePixelRatio || 1);
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#59b7ff';
    ctx.lineWidth = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const step = Math.max(1, Math.floor(samples.length / W));
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const startI = x * step;
      let min = 1, max = -1;
      for (let i = 0; i < step && startI + i < samples.length; i++) {
        const v = samples[startI + i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const y1 = ((1 - max) * 0.5) * H;
      const y2 = ((1 - min) * 0.5) * H;
      ctx.moveTo(x + 0.5, y1);
      ctx.lineTo(x + 0.5, y2);
    }
    ctx.stroke();
    // Mid line
    ctx.strokeStyle = 'rgba(120,160,210,.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.5); ctx.lineTo(W, H * 0.5); ctx.stroke();
  }

  // ---- WAV encoder (mono, 16-bit PCM) ----
  function encodeWav(samples, sampleRate) {
    const numSamples = samples.length;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');
    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);          // chunk size
    view.setUint16(20, 1, true);           // PCM
    view.setUint16(22, 1, true);           // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate (sr * blockAlign)
    view.setUint16(32, 2, true);           // block align
    view.setUint16(34, 16, true);          // bits per sample
    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // PCM samples (clip + convert)
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }
  function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  // ---- Upload (client-direct to Vercel Blob) ----
  // Vercel's @vercel/blob/client `upload()` would normally be imported, but we want to keep
  // this page dependency-free for the browser. We replicate the protocol manually:
  //   1. POST { type: 'blob.generate-client-token', payload: { pathname, callbackUrl, clientPayload, ... } } to /api/upload-clip
  //   2. Server returns { type: 'blob.generate-client-token', clientToken: '...' }
  //   3. Browser PUTs the WAV directly to `https://blob.vercel-storage.com/<pathname>?<token>`
  //   4. POST { type: 'blob.upload-completed', payload: { blob, tokenPayload } } to /api/upload-clip
  //
  // The exact protocol is documented at https://vercel.com/docs/storage/vercel-blob/client-upload
  // but the easiest reliable implementation is `import { upload } from '@vercel/blob/client'`.
  // We'll use the official ESM build from a CDN so we don't need a bundler.
  async function uploadClip() {
    if (!state.samples) {
      showToast('Record something first', true);
      return;
    }
    if (!state.selectedLabel) {
      showToast('Pick a label first', true);
      return;
    }
    saveCoach();

    uploadBtn.disabled = true;
    discardBtn.disabled = true;
    uploadStatus.hidden = false;
    uploadStatus.textContent = 'Encoding…';

    try {
      // Re-encode (cheap — already done for playback, but state-safe)
      const wavBlob = encodeWav(state.samples, state.sampleRate);

      const coach = (coachField.value || 'anonymous').trim().replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40) || 'anonymous';
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const pathname = `clips/coach-${coach}/${ts}__${state.selectedLabel}.wav`;
      const note = (noteField.value || '').slice(0, 500);

      const clientPayload = JSON.stringify({
        label: state.selectedLabel,
        coach,
        device: navigator.userAgent.slice(0, 200),
        sampleRate: state.sampleRate,
        duration: state.samples.length / state.sampleRate,
        note,
      });

      uploadStatus.textContent = 'Uploading…';

      // Use the official ESM client from esm.sh (CDN that turns npm packages into browser ESM).
      // This avoids a bundler step. If the CDN is slow on first request, we fall back to manual
      // protocol below.
      const { upload } = await import('https://esm.sh/@vercel/blob@0.27.0/client');

      const result = await upload(pathname, wavBlob, {
        // Private: clips never go on the public internet directly. Playback in the audit
        // page goes through /api/stream-clip which signs short-lived URLs server-side.
        access: 'private',
        contentType: 'audio/wav',
        handleUploadUrl: '/api/upload-clip',
        clientPayload,
      });

      uploadStatus.innerHTML = 'Uploaded &check; <span class="meta-pill">' + (result.pathname || pathname) + '</span>';
      showToast('Clip uploaded');

      // Auto-reset for next clip but KEEP label + coach so they can capture a series fast
      setTimeout(() => {
        state.samples = null;
        revokePreview();
        waveCanvas.hidden = true;
        reviewRow.hidden = true;
        countdownEl.textContent = '· · ·';
        setStatus('Ready for next clip. Label: ' + state.selectedLabel);
      }, 1200);
    } catch (err) {
      console.error('Upload error', err);
      uploadStatus.textContent = 'Upload failed: ' + (err.message || err);
      showToast('Upload failed — see status', true);
    } finally {
      uploadBtn.disabled = false;
      discardBtn.disabled = false;
    }
  }

  // ---- Event wiring ----
  recordBtn.addEventListener('pointerdown', startRecording);
  discardBtn.addEventListener('pointerdown', () => {
    state.samples = null;
    revokePreview();
    waveCanvas.hidden = true;
    reviewRow.hidden = true;
    countdownEl.textContent = '· · ·';
    setStatus('Discarded. Tap RECORD to capture another clip.');
  });
  playBtn.addEventListener('pointerdown', () => {
    if (state.audioPreview) {
      try { state.audioPreview.currentTime = 0; state.audioPreview.play(); } catch (_) {}
    }
  });
  uploadBtn.addEventListener('pointerdown', uploadClip);

  // ---- Init ----
  renderLabels();
  loadCoach();

})();
