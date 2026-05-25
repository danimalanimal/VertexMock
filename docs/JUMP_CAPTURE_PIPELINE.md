# Jump Capture Pipeline — Architecture

**Status:** Draft architecture · **Owner:** Daniel Gordon · **Date:** 2026-05-25 · **Depends on:** FORM_DESIGNER_CONTRACT.md v1.2

This document specifies how Vertex captures vertical-jump measurements (CMJ, SJ, Drop Jump, single-leg variants) on iPhone 17 class hardware, producing entries that conform to the data contract.

---

## 0. Goals & non-goals

**Goals:**
- One coherent capture experience that works on any iPhone 17 (base, Air, Pro, Pro Max), gracefully degrading by hardware.
- Lab-comparable accuracy when available; clearly-labelled accuracy band otherwise.
- Every captured entry carries `source` (per ADR-0002) so dashboards can filter / split / warn on cross-modality comparisons.
- Optional cross-confirmation (audio + vision) for higher confidence on the existing tape-rip detector flow.
- Runs entirely on-device (privacy, latency, offline use). No server-side video processing in v1.

**Non-goals (v1):**
- Force plates, jump mats, or any external hardware. (Tracked as `source: 'force_plate'` for *manual entry* of an external reading — no integration.)
- Real-time live preview of metrics during the jump. Capture-then-analyse is fine for v1.
- Multi-athlete one-shot capture. Single athlete per capture session.
- Cross-platform (Android, web). iOS native first; web/PWA flow later if needed.

---

## 1. Sensor-to-strategy matrix

The actual sensors available on each iPhone 17 SKU, and which capture strategies each unlocks:

| Sensor | iPhone 17 | iPhone 17 Air | iPhone 17 Pro / Pro Max | Max rate | Strategy unlocked |
|---|:---:|:---:|:---:|---|---|
| IMU (accel + gyro) | ✓ | ✓ | ✓ | 100 Hz | `imu_pocket`, `imu_handheld` |
| Microphone | ✓ | ✓ | ✓ | 48 kHz | `audio_impact` |
| Main camera 1080p @ 240fps | ✓ | ✓ | ✓ | 240 fps | `video_240fps` |
| Main camera 4K @ 120fps | ✗ | ✗ | ✓ | 120 fps | `video_120fps` |
| TrueDepth (front, structured-light) | ✓ | ✓ | ✓ | 30 Hz | `truedepth_arkit` |
| LiDAR (rear scanner) | ✗ | ✗ | ✓ | 30–60 Hz | `lidar_arkit` |
| Barometer | ✓ | ✓ | ✓ | 25 Hz | — *(noise floor > signal; not used)* |

**Hard constraint to internalise:** the iPhone IMU is capped at **100 Hz**. The 800 Hz batched-sensor mode (`CMBatchedSensorManager`) is **Apple Watch only**, not iPhone. Any strategy that needs sub-10ms temporal resolution must come from microphone (sub-ms) or video (4.17ms at 240fps) — not from the IMU alone.

---

## 2. Strategy ranking per metric

For each jump-related metric in the registry, the preferred capture path:

| Metric | Best | Fallback | Last resort |
|---|---|---|---|
| `cmj_height` | `lidar_arkit` (Pro) | `video_240fps` (all) | `audio_impact` + `imu_pocket` (existing tape-rip detector) |
| `cmj_contact_time` | `lidar_arkit` | `video_240fps` | `audio_impact` (less reliable for landing) |
| `cmj_peak_force` | external `force_plate` (manual entry) | derived from `lidar_arkit` velocity + body mass | — |
| `cmj_peak_power` | external `force_plate` (manual entry) | derived from `lidar_arkit` | — |
| `squat_jump_height` | `lidar_arkit` | `video_240fps` | `audio_impact` |
| `drop_jump_height` + `drop_jump_contact_time` | `lidar_arkit` | `video_240fps` | `audio_impact` (existing detector) |
| `single_leg_cmj_left/right` | `lidar_arkit` (only path with which-leg detection) | `video_240fps` (manual leg tagging) | `manual` |
| `vertical_jump_run` (max reach jump) | `video_240fps` (visible reach mark) | `manual` (tape measure) | — |
| `approach_jump_height`, `block_jump_height`, `spike_jump_height` | `video_240fps` | `lidar_arkit` (if range allows) | `manual` |
| `broad_jump_distance` | `video_240fps` (calibrated tape in frame) | `manual` (tape measure) | — |
| `rsi`, `rsi_modified` | `computed` (always, from inputs) | — | — |
| `jump_asymmetry_pct` | `computed` (always, from L/R single-leg inputs) | — | — |

---

## 3. The four capture pipelines

### 3.1 `video_240fps` — universal default

**Math:** Free-fall flight time → height.

```
height_m = (1/8) × g × t_flight² = 1.2262 × t_flight²
```

where `g = 9.80665 m/s²` and `t_flight` is the time between take-off frame and landing frame in seconds. At 240 fps, frame period is **4.17 ms** → height error band at 40 cm jump ≈ **±0.5 cm**. Comparable to most consumer jump mats.

**Steps:**

1. **Setup screen** — coach places phone in a stable mount (gorilla pod or tripod), ~3 m back, hip-height. Side-on framing. App shows live preview with a target zone overlay.
2. **Calibration** — optional. Either (a) athlete stands in frame and taps a "height check" to anchor a known body height, or (b) skip — flight-time math doesn't need length calibration.
3. **Start trigger** — coach taps Record. Capture starts at 1080p @ 240 fps. A 5 s countdown plus an audible beep.
4. **Capture window** — record 5 s of video. Stream every frame through `VNDetectHumanBodyPoseRequest` (Vision framework) extracting hip + ankle joints. Time-stamp each frame from the buffer's `presentationTimeStamp`.
5. **Event detection (on-device, post-capture):**
   - **Take-off frame:** first frame where ankle Y-coordinate accelerates upward sharply AND hip Y-coordinate is rising — verified by 3-frame look-ahead to reject false starts.
   - **Landing frame:** last frame before ankle Y-coordinate stops descending (typically within 1 frame of ground contact).
   - **Contact-time start/end** (drop jump only): two consecutive ground-contact windows — measure the dwell between them.
6. **Quality check:**
   - Confidence threshold on body-pose joints (≥0.8). If lower, prompt "Body not clearly visible — re-record."
   - Frame-rate check: count actual frames captured. If < 220 fps effective (Apple sometimes drops to 180 fps in low light), warn the coach and downgrade `source` to `video_180fps_degraded` if it ever ships as an enum value (currently we'd reject the capture).
   - Take-off and landing frames must be ≥ 30 frames apart (= 125 ms minimum jump) and ≤ 200 frames apart (= 833 ms maximum jump) — reject otherwise.
7. **Compute & write:**
   - `t_flight = (landing_pts - takeoff_pts).seconds`
   - `cmj_height = 1.2262 × t_flight²`
   - Submit entry with `source: 'video_240fps'`, `sourceMeta: { device, appVersion, detectorVersion, frameCount, effectiveFps }`.
8. **Display the recording** with takeoff/landing frames marked; coach can scrub and manually nudge either marker if the detector got it wrong. **If coach moves a marker, source flips to `manual` with `sourceMeta.derivedFrom: 'video_240fps'`** — preserving the fact that the underlying capture was video, but the final measurement was human-adjudicated.

**Edge cases:**
- Low light → fps drops. Detect at end of capture, fail gracefully.
- Athlete leaves frame on landing → reject, ask to re-record with athlete fully visible at landing.
- Multiple people in frame → use the largest detected body bounding box; warn the coach if more than one body was detected.

### 3.2 `lidar_arkit` — Pro-model differentiator

**Math:** Direct displacement of the pelvis joint in world-space.

```
height_m = max(pelvis_world_y) − pelvis_world_y_at_takeoff
contact_time_s = duration where |pelvis_world_y - ground| < 0.05 m  (drop jump)
```

**Steps:**

1. **Setup screen** — coach places phone in mount, ~2.5 m back (LiDAR range is ~5 m but body-tracking accuracy degrades past 3 m). Same hip-height side-on framing as video mode. **iPhone 17 Pro / Pro Max only — the UI hides this option on non-Pro models.**
2. **AR session start** — `ARSession` with `ARBodyTrackingConfiguration`, `frameSemantics = [.bodyDetection]`, sceneDepth enabled. ARKit calibrates ground plane via the LiDAR sweep (takes ~1 s).
3. **Athlete acquisition** — wait for `ARBodyAnchor` with high confidence on hip/spine joints. Show a "ready" indicator when locked.
4. **Capture window** — 5 s recording. On each `ARFrame`, sample:
   - `bodyAnchor.skeleton.modelTransform(for: .hips_joint).columns.3.y` (pelvis world-space Y)
   - Frame timestamp
   - LiDAR depth at pelvis projection (for redundancy check)
5. **Event detection:**
   - **Take-off:** sustained upward velocity in pelvis Y + pelvis-to-ground depth > 0.10 m for ≥ 2 consecutive frames.
   - **Peak:** first frame where pelvis Y stops increasing.
   - **Landing:** pelvis returns to baseline Y (within 0.05 m of standing pose).
6. **Single-leg detection (single-leg CMJ only):**
   - Check which foot's `ARSkeletonJointName` was in contact with the ground plane at take-off (foot world-space Y closest to ground).
   - That's the propelling leg; populate `single_leg_cmj_left` OR `single_leg_cmj_right` accordingly.
7. **Compute & write:**
   - `cmj_height = peak_pelvis_y - takeoff_pelvis_y`
   - `cmj_contact_time` (drop jump) = time between landing-1 and takeoff-2
   - Submit entry with `source: 'lidar_arkit'`, `sourceMeta: { device, appVersion, arkitVersion, bodyConfidence, depthRangeMin, depthRangeMax }`.
8. **Pair entries:** when single-leg CMJ runs, the runtime knows the athlete will perform both legs in sequence. After the L capture, prompt for R. After both are in, the form's `jump_asymmetry_pct` computed metric auto-fills.

**Edge cases:**
- Sunlight → LiDAR SPAD saturates. Detect via `ARSession`'s depth-data confidence; warn and recommend video mode.
- Athlete out of LiDAR range (>5 m) → tracking lost, abort capture, prompt to step closer.
- Skeleton tracking drops out mid-jump → fall back to depth-only at pelvis projection (less accurate but salvageable). If both drop out, reject capture.

### 3.3 `audio_impact` — your existing tape-rip / packing-tape detector

Already shipped. v1.2 work: ensure it submits with `source: 'audio_impact'` and `sourceMeta.detectorVersion` (currently `vertex-audio-detect.js` version) so detector revisions are traceable.

### 3.4 `imu_pocket` — accelerometer fallback

**Math:** Identify the free-fall window (when phone-in-pocket reads |a| ≈ 0) → flight time → height (same formula as video).

**Why it's the last resort:** 100 Hz IMU = 10 ms event resolution = ~±1 cm at 40 cm jump. Worse than video. But works with no tripod, no LiDAR, no microphone in noisy gym.

**Steps:**

1. **Setup screen** — coach asks athlete to put phone in shorts pocket (front-pocket, screen-facing-leg). App locks portrait, screen black with a single "Start" tap.
2. **Recording** — `CMMotionManager.startDeviceMotionUpdates` at 100 Hz. Athlete performs jump after a 3-second beep countdown.
3. **Event detection:** find the longest contiguous window where `|deviceMotion.userAcceleration|.magnitude < 0.3 g`. The boundaries are take-off and landing.
4. **Reject** if window < 0.15 s (false trigger from settling) or > 0.8 s (impossible jump).
5. **Compute & write** — same formula as video. `source: 'imu_pocket'`, `sourceMeta: { device, accelMaxBefore, accelMaxAfter, freefallWindowSamples }`.

**Edge cases:** phone shifts in pocket = unreliable. Display "accuracy: ±1 cm" prominently so coach knows.

---

## 4. The capture-mode chooser

The runtime decides which capture path is available based on **device class** and **selected metric**:

```
def available_modes(device, metric):
  modes = ['manual']  # always available

  if metric in {jump-related metrics}:
    if device.has_240fps_video:
      modes.append('video_240fps')
    if device.has_lidar:
      modes.append('lidar_arkit')
    modes.append('audio_impact')  # works on every phone with a mic
    modes.append('imu_pocket')    # works on every phone

  if metric in {sprint times}:
    if device.has_240fps_video:
      modes.append('video_240fps')  # frame-counting start/finish
    # timing_gates always available as manual entry

  ...
```

UI behaviour: when a coach taps a metric input on a form, the runtime shows the **best available mode by default** with a "use a different method" dropdown listing all other available modes. Falling back is always one tap away.

---

## 5. Storage flow (post-capture)

Every capture path ends the same way:

```
capture pipeline
   │
   ▼
metric reading {value, unit, source, sourceMeta}
   │
   ▼
POST /api/append-entry  (server enforces ADR-0002 invariants)
   │
   ▼
forms/results/YYYY-MM-DD.jsonl  (Vercel Blob, private)
   │
   ▼
dashboard read via /api/entries — filters by source available
```

**Crucially:** the raw video / depth recording is **not stored** in v1. Only the derived measurement and its source enum + meta dict. This keeps storage cost low, sidesteps biometric-PII storage rules, and preserves athlete privacy. Coaches can re-capture if they want a different frame marked.

If we later want to store raw recordings (for QA, model training, or coach review), that's a v2 amendment — would need its own contract section on retention, encryption-at-rest beyond Blob's default, and a deletion request workflow.

---

## 6. Phasing (relative to the form-designer phases)

This pipeline is **independent of** the form designer — it can be built before, after, or in parallel. Suggested ordering:

- **Phase 1** (form designer): no capture changes needed. Existing audio detector continues to write entries; bring it into v1.2 compliance by setting `source: 'audio_impact'`.
- **Phase 2** (runtime engine `/run-form.html`): metric inputs default to `source: 'manual'`. When a coach taps a metric tile, a "use a sensor instead" option opens the capture mode chooser. Initially the chooser only offers `video_240fps` + `manual` + the existing audio detector.
- **Phase 3** (jump-capture v1): ship the `video_240fps` pipeline end-to-end. Single new screen: "Record jump → review → save". Works on every iPhone 17. Replaces the tape-rip detector flow as the default for CMJ/DJ/SJ.
- **Phase 4** (jump-capture pro): ship `lidar_arkit` pipeline as an opt-in "Pro mode" for iPhone 17 Pro / Pro Max owners. Unlocks single-leg detection, contact time, RSI auto-fill.
- **Phase 5+**: extend video pipeline to sprint splits (frame-counted start/finish at known distance markers), to broad jump (calibrated tape in frame), and to throws (calibrated landing-zone markers).

---

## 7. Open questions to resolve before coding

1. **iOS app vs PWA?** The strategies above all need native iOS APIs (`AVCaptureSession` at 240fps, `Vision`, `ARKit`, `CoreMotion`). A pure web app on iOS Safari **cannot** access these — `getUserMedia` maxes out at 60fps and has no body-pose or depth access. Decision needed: do we ship a native iOS app, a hybrid (Capacitor/Cordova wrapping the existing web UI plus native plugins), or split — keep the designer on web and ship a companion iOS capture app that submits to the same Blob endpoints?
   - **My recommendation:** companion native iOS app for capture; designer stays on web. The capture app's single job is "open form, perform test, submit entry". Lower scope, lower risk, fastest path to validating the architecture. Form authoring and dashboards stay where they are (Vercel).

2. **App distribution.** Native iOS = App Store or TestFlight or ad-hoc enterprise distribution. For internal-tool use during the workshop, TestFlight + Apple Developer Program ($99/yr) is enough. App Store review only matters if external coaches will use it.

3. **Calibration for spatial metrics (broad jump, reach jump).** Video flight-time needs no length calibration. But broad jump distance does. Three options: (a) place a known-length reference in frame (a calibration card); (b) AR-based depth measurement using LiDAR; (c) manual tape measurement as backup. v1: ship `manual` + LiDAR-Pro; v2: add ArUco/calibration-card support.

4. **Background-noise handling for audio detector.** Crowded gym + multiple coaches = false positives on tape-rip detection. Worth raising the confidence threshold in v1.2 or pairing audio with IMU free-fall window confirmation? Probably yes — easy win.

5. **What if frame-rate degrades mid-capture?** Apple's 240fps drops to 180 fps in low light. Current spec: reject the capture if effective fps < 220. Alternative: accept it with a degraded-accuracy label and a different `source` enum value. Simpler to reject for v1; revisit if it becomes a pain.

---

## 8. Summary — what gets built

| Component | Phase | Effort | Hardware tier |
|---|---|---|---|
| `source` field plumbed through `/api/append-entry` + validation | Phase 1 | Small | All |
| Capture-mode chooser UI | Phase 2 | Medium | All |
| `video_240fps` pipeline (AVFoundation + Vision) | Phase 3 | Large | All iPhone 17 |
| `lidar_arkit` pipeline (ARKit + sceneDepth + body anchor) | Phase 4 | Large | iPhone 17 Pro / Pro Max |
| Existing `audio_impact` detector — source-tag in compliance | Phase 1 | Small | All |
| `imu_pocket` fallback pipeline | Phase 5 (low priority) | Small | All |
| Companion native iOS app shell (if Q1 = native) | Phase 3 prerequisite | Medium | All |

If the answer to Q1 (Open Question, §7) is "native iOS app", that becomes the gating decision before any capture work starts.
