# ADR-0002 — Every metric entry carries its measurement source

**Status:** Accepted · **Date:** 2026-05-25 · **Deciders:** Daniel Gordon

## Context

The same metric (`cmj_height = 0.42 m`) can be produced by very different measurement paths: a coach typing a tape-measure reading, a 240fps video flight-time analysis, an ARKit/LiDAR hip-displacement track, an audio tape-rip detector, a phone-in-pocket accelerometer free-fall window, an external force plate, a Vald jump mat, a timing-gate system, or a GPS watch.

These paths have **different accuracy bands, different noise characteristics, and different systematic biases.** A coach comparing two athletes — one measured by force plate, one by phone-in-pocket — has no idea they're comparing apples to oranges unless the data records how it was captured.

The trigger for this decision is the iPhone 17 sensor analysis (see session context): on iPhone 17 we will support **at least four different on-device capture paths** for CMJ alone (video 240fps, LiDAR + ARKit body tracking, audio impact detector, pocket IMU free-fall). Without provenance we cannot:

- Filter analytics to a single measurement modality for fair cross-athlete comparison
- Surface UI warnings when comparing values measured by very different methods
- Retire a buggy detector version while preserving entries measured by other paths
- Trust longitudinal trends (a switch from manual-tape to video-240fps would look like a step change in jump height)

## Decision

Every metric Entry carries a **required** `source` field, drawn from a **closed enum** `MEASUREMENT_SOURCES`. Entries also carry an optional `sourceMeta` dictionary for free-form device/version metadata.

```js
MEASUREMENT_SOURCES = [
  // Direct human input
  'manual',

  // Phone-native capture
  'video_240fps', 'video_120fps',
  'lidar_arkit', 'truedepth_arkit',
  'audio_impact',
  'imu_pocket', 'imu_handheld',

  // External hardware
  'force_plate', 'timing_gates',
  'gps_watch', 'hr_strap', 'dynamometer',

  // Derived
  'computed',
]
```

Entry rules:

| Rule | Enforcement |
|---|---|
| `source` is required on every metric entry | Server reject at `/api/append-entry` if missing |
| `source` must be a `MEASUREMENT_SOURCES` value | Server validate against enum |
| `source` is permanent (entry immutability) | Same as the rest of the entry |
| `source = "computed"` ⇔ `computed: true` | Server-side cross-check |
| `sourceMeta` is freeform | No schema enforcement; UI may surface device/version/detector strings |
| Adding a new source = minor contract bump (v1.2 → v1.3) | No data migration (old entries unaffected) |

## Alternatives considered

### A. Don't track source — coaches just know

Reject. Coaches will not "just know" three months from now which athletes were measured before vs after the LiDAR mode shipped. Cross-modality comparison silently corrupts every dashboard chart and every cohort comparison. Provenance is a foundational data-integrity field, not a nice-to-have.

### B. Optional `source` field

Reject. Optional fields rot. Within a month we'd have a mix of tagged and untagged entries, and every aggregation query would have to handle a `null` case. Requiring `source` (with `"manual"` as the safe default when the runtime can't auto-determine) forces the question to be answered at write time.

### C. Free-string `source`

Reject. Same anti-pattern as free-string sport names — "video", "Video", "video_240", "vid240" — would diverge fast. Closed enum + new-value process keeps the set governed.

### D. Source as a property on the Metric registry, not on the Entry

Reject. The source is a property of *how this particular reading was captured*, not of the metric itself. The same `cmj_height` metric is measured by different sources on different days. Putting source on the registry would let us tag a metric as "video-only" but couldn't tell us that a specific entry was actually measured manually because the camera glitched.

### E. Track a finer-grained "device" string instead of a coarse enum

Reject as the primary mechanism — but accept as the **secondary** mechanism via `sourceMeta`. The enum gives us a small set of analytically-meaningful classes (anything ARKit+LiDAR-derived has the same accuracy band); the free-form dict gives us forensic detail (which detector version, which phone). Best of both.

## Consequences

**Positive:**
- Dashboards and longitudinal charts can filter or split by source. A "video-only" or "force-plate-only" view becomes trivial.
- Detector regressions are isolatable — if v3 of the audio detector ships a bug, we can identify exactly which entries used it via `sourceMeta.detectorVersion` and re-process.
- Cross-modality comparison warnings become possible in the UI (e.g. "this athlete's CMJ was measured by phone-in-pocket; the cohort average is force-plate — values may not be directly comparable").
- New capture modes can be added without contract drama (minor version bump, no migration).

**Negative:**
- Required field = one more thing every runtime path has to set correctly. Phase-1 designer entries default to `"manual"`. Future capture pipelines must set the correct source or fall back to `"manual"`.
- Adding source after the fact (backfill of old entries) is possible but not free. Mitigated by the fact that we have no production entries yet.
- The enum will grow as we add modalities. Each addition is a minor bump. Acceptable cost.

## Tells if this decision is wrong

- Coaches consistently leaving `source = "manual"` even when a capture pipeline was used (signal: capture pipelines aren't auto-setting source — fix the runtime)
- The enum hits 30+ values within a year (signal: too granular — collapse classes)
- We need to track *multiple* sources per entry (signal: revisit — maybe `source` should be an array, but that's a v2 problem)
