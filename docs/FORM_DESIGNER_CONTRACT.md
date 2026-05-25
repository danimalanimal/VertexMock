# Coach Observation Form — Data Contract v1.0

**Status:** Draft pending sign-off · **Owner:** Daniel Gordon · **Date locked:** 2026-05-25

This document is the **frozen** schema that every part of the form designer, runtime, storage layer, and dashboard must obey. Code changes that break this contract require a new contract version (v1.1, v2.0, etc.) and a written migration plan in this folder.

---

## 0. Vocabulary (precise, no overloading)

| Term | Meaning |
|---|---|
| **Form** | A coach-facing input page (the thing rendered at `/run-form.html?slug=…`). What coach.html and boxing.html will become. |
| **Form Definition** | The data record describing a form — its attributes, phrases, optional metric inputs. |
| **Form Version** | An immutable snapshot of a Form Definition. Forms have an N-of-versions history. |
| **Attribute** | A category in the form's tile grid (Technical, Tactical, …). Belongs to a shared registry. |
| **Sentiment** | One of `+`, `=`, `-`. Fixed set, not configurable per form (forms may only restrict which subset is enabled). |
| **Phrase** | A reusable text snippet keyed by (attribute, sentiment). Belongs to a shared library. |
| **Metric** | A typed numeric measurement (jump_height, lift_weight, contact_time). Belongs to a shared registry. |
| **Entry** | A single observation logged at runtime — either a phrase tag OR a metric reading. One row in the day's results file. |
| **Session** | Optional context wrapper that auto-tags every entry made while it's active (coach, kind, gym, etc.). |
| **Athlete** | Person being observed. References an existing roster record. |
| **Roster** | Named group of athletes. Forms bind to a roster (or `null` = pick any athlete on the fly). |

**Key principle:** every entry knows the slug, version, and id of every reference it makes — even when that reference later changes — so historical reads never lie.

---

## 1. Storage Layout (Vercel Blob, private)

```
forms/
  registry/
    attributes.json         ← all attributes (small, ~30 entries)
    metrics.json            ← all metrics (small)
    phrases.json            ← all phrases (medium, ~1000s over time)
    forms.json              ← all form definitions, all versions
    rosters.json            ← all rosters
    coaches.json            ← all coaches (mirrors squad/staff)
  results/
    2026-05-25.jsonl        ← append-only daily entries (one JSON object per line)
    2026-05-24.jsonl
    ...
```

- **Why JSON for registries, JSONL for results:** registries are read whole on form load (small, hot, cached). Results are appended to one row at a time and read by date range; JSONL avoids ever rewriting a multi-MB file.
- **Why no SQL:** internal tool, <10k entries/day expected, Blob is already wired. SQL migration path exists when needed.
- **Why daily files:** natural rollover, easy to back up, bounded read cost, easy to delete a bad day.

### Path conventions

- All registry writes go to the same path each time (overwrite). Last-writer-wins is OK because edits are single-user (internal tool).
- All results writes append a single line via `POST /api/append-entry` → server reads current day's blob, appends, writes back. (Acceptable for internal scale; later: real append-only store.)

---

## 2. Registries (the shared, reusable layer)

### 2.1 `attributes.json`

```jsonc
{
  "version": 1,                            // bump on schema change to this file
  "items": [
    {
      "key": "technical",                  // SLUG. snake_case. permanent. unique.
      "label": "Technical",                // display name. editable.
      "short": "TECH",                     // abbreviated label for tight UI. editable.
      "glyph": "◆",                        // single char/emoji for the tile. editable.
      "topic": "Technical skill",          // descriptive subtitle. editable.
      "sports": ["basketball","boxing"],   // applicability tags. editable.
      "status": "active",                  // "active" | "archived". archived = hidden from new forms.
      "createdAt": "2026-05-25T09:00:00Z",
      "updatedAt": "2026-05-25T09:00:00Z"
    }
  ]
}
```

**Rules:**
- `key` is permanent once written. Renames create a new attribute; old data keeps pointing at the old key.
- `status: "archived"` removes from designer dropdowns but old form versions still resolve it.
- Designer warns (does not block) if a typed-in new label fuzzy-matches an existing active attribute.

### 2.2 `metrics.json`

```jsonc
{
  "version": 1,
  "items": [
    {
      "key": "jump_height",                // SLUG. snake_case. permanent. unique.
      "label": "Vertical Jump Height",     // display name. editable.
      "kind": "length",                    // ONE OF: length | weight | time | count | speed | rating | boolean | text. PERMANENT.
      "canonicalUnit": "cm",               // PERMANENT once any result is captured.
      "displayUnits": ["cm","in"],         // units coaches may enter in. editable (additive only).
      "min": 0,                            // sanity floor (canonical). editable.
      "max": 120,                          // sanity ceiling (canonical). editable.
      "decimals": 1,                       // display precision. editable.
      "status": "active",                  // "active" | "archived"
      "createdAt": "2026-05-25T09:00:00Z",
      "updatedAt": "2026-05-25T09:00:00Z"
    }
  ]
}
```

**Rules:**
- `key` is permanent. `kind` and `canonicalUnit` are permanent once any entry references this metric.
- `displayUnits` can only be added to, never removed (would break historical entry display).
- `min`/`max` changes don't rewrite history — they only validate future entries.
- Allowed `kind` values are fixed (closed enum, contract-level constant). Adding a new kind = new contract version.

#### Permitted unit sets per kind

| kind | canonical | allowed display units |
|---|---|---|
| length | cm | mm, cm, m, in, ft |
| weight | kg | g, kg, lb |
| time | ms | ms, s, min, h:m:s.ms (composite) |
| count | unit | unit (no conversion) |
| speed | m/s | m/s, km/h, mph |
| rating | n/a | n/a (just integer 1–N where N is a registry-level scale) |
| boolean | n/a | true/false |
| text | n/a | freeform |

### 2.3 `phrases.json`

```jsonc
{
  "version": 1,
  "items": [
    {
      "id": "p_2026_0001",                 // PERMANENT. minted on creation. opaque.
      "text": "Clean catch-and-shoot footwork on the move",
      "attribute": "technical",            // FK to attributes[].key
      "sentiment": "+",                    // one of "+" | "=" | "-"
      "sports": ["basketball"],            // tags for filtering in designer
      "status": "active",                  // "active" | "archived"
      "source": "seed",                    // "seed" | "custom" | "imported"
      "createdAt": "2026-05-25T09:00:00Z",
      "createdBy": "dan",
      "updatedAt": "2026-05-25T09:00:00Z"
    }
  ]
}
```

**Rules (OPTION 1 IMMUTABILITY — LOCKED):**
- `text`, `attribute`, `sentiment` are **PERMANENT** once any entry references this phrase.
- To "edit" a phrase: archive the old one (status → "archived"), create a new phrase with a new id, copy across to any form that referenced the old one.
- Designer surfaces this clearly: editing a used phrase replaces it; editing an unused phrase rewrites it in place.
- `status: "archived"` hides from new-form pickers; old entries keep their `textSnapshot`.
- Adding a phrase via a form's inline custom composer writes a new record with `source: "custom"`.

### 2.4 `forms.json`

```jsonc
{
  "version": 1,
  "items": [
    {
      "slug": "basketball-coach",          // PERMANENT. URL-safe. unique.
      "name": "Basketball Coach Input",    // display name. editable.
      "sport": "basketball",               // free string; used for filtering. editable.
      "rosterId": "south-metro-u16",       // FK to rosters[].id, or null = union of all rosters (see §3.5)
      "status": "live",                    // "draft" | "live" | "archived"
      "currentVersion": 3,                 // points into versions[]
      "createdAt": "2026-05-25T09:00:00Z",
      "createdBy": "dan",
      "versions": [
        {
          "version": 3,
          "publishedAt": "2026-05-25T09:00:00Z",
          "publishedBy": "dan",
          "attributes": ["technical","tactical","physical","mental","consistency","leadership"],
          "sentiments": ["+","=","-"],
          "phraseSets": {                  // attribute → sentiment → ordered phrase id list
            "technical": {
              "+": ["p_2026_0001","p_2026_0004","p_2026_0007"],
              "=": ["p_2026_0042","p_2026_0043"],
              "-": ["p_2026_0099"]
            },
            "tactical": { "+":[...], "=":[...], "-":[...] }
          },
          "metricInputs": [                // optional. empty array = pure qualitative form.
            { "metric": "punches_landed", "label": "Punches landed", "required": false, "perEntryDefault": null }
          ],
          "sessionFields": {               // optional session-bar configuration
            "showSessionToggle": true,
            "sessionKinds": ["Training","Game","Review"],
            "showBulkMode": true
          }
        },
        { "version": 2, ... },             // older versions preserved verbatim
        { "version": 1, ... }
      ]
    }
  ]
}
```

**Rules:**
- `slug` is permanent. `currentVersion` advances on Publish.
- Each entry in `versions[]` is immutable once published.
- Draft edits live on a `draft` field outside `versions[]` until Publish promotes them.
- Archiving sets `status: "archived"` — form disappears from index but old entries still resolve correctly.

### 2.5 `rosters.json`

```jsonc
{
  "version": 1,
  "items": [
    {
      "id": "south-metro-u16",
      "name": "South Metro Performance · U16",
      "sport": "basketball",
      "status": "active",
      "athletes": [
        { "id":"ava", "name":"Ava Thompson", "pos":"G/W", "num":5,
          "initials":"AT", "accent":"#9bd2ff" }
      ],
      "createdAt": "...", "updatedAt": "..."
    }
  ]
}
```

Athlete `id` permanent. Squad order is preserved for the player rail.

### 2.6 `coaches.json`

```jsonc
{
  "version": 1,
  "items": [
    { "id":"lin", "name":"Coach Lin", "initials":"CL", "color":"#59b7ff",
      "status":"active", "createdAt":"...", "updatedAt":"..." }
  ]
}
```

---

## 3. Entries (the results layer)

### 3.1 Per-day JSONL file (`results/YYYY-MM-DD.jsonl`)

One JSON object per line. Each line is a single observation entry. Schema:

```jsonc
{
  "id": "e_2026_05_25_a3f9c2",             // PERMANENT. UUID-like, sortable by time.
  "type": "phrase",                        // "phrase" | "metric"
  "formSlug": "basketball-coach",          // FK to forms[].slug
  "formVersion": 3,                        // version number captured at entry time
  "athleteId": "ava",                      // FK to roster athlete
  "rosterId": "south-metro-u16",           // FK denormalised for fast filter
  "coachId": "lin",                        // FK to coaches[].id, or null
  "sessionId": "s_2026_05_25_evening",     // optional session grouping
  "sessionKind": "Training",               // optional, mirrors session if set
  "observedAt": "2026-05-25T18:42:00+10:00", // ISO with timezone

  // ── If type === "phrase" ──
  "phrase": {
    "id": "p_2026_0001",                   // FK to phrases[].id
    "textSnapshot": "Clean catch-and-shoot footwork on the move",
    "attribute": "technical",              // denormalised for query without join
    "sentiment": "+"                       // denormalised
  },

  // ── If type === "metric" ──
  "metric": {
    "key": "jump_height",                  // FK to metrics[].key
    "valueCanonical": 42.1,                // stored in canonical unit always
    "valueDisplay": 42.1,                  // what coach actually entered
    "unitDisplay": "cm",                   // the unit coach entered in
    "labelSnapshot": "Vertical Jump Height" // captured at entry time
  },

  "notes": null                            // optional free-form, max 500 chars
}
```

### 3.2 Hard invariants on entries

- **Exactly one of `phrase` or `metric` is non-null.** Type field disambiguates.
- **`textSnapshot` and `labelSnapshot` are denormalised on purpose** — they preserve what was tagged even after the source registry changes.
- **`valueCanonical` is always present for metrics**, even when the coach entered in a non-canonical unit (we convert on save).
- **Entries are immutable.** Corrections happen via a "void" entry (a new entry with `type: "void"` referencing the original id). v1 ships without void; ship as v1.1 amendment if needed.
- **`observedAt` may not equal write time** — coaches can backfill, so daily-file routing uses `observedAt` not arrival time.

### 3.3 Entry id format

`e_<YYYY>_<MM>_<DD>_<6 hex chars>` — sortable lexically, debuggable on sight.

### 3.4 Phrase id format

**PENDING DECISION** — either:
- `p_<YYYY>_<4-digit counter>` (10k/year ceiling), or
- `p_<YYYY>_<5-digit counter>` (100k/year ceiling, recommended for Option 1 churn + future bulk imports)

Counter resets per year. Designer fetches the current year's max counter on load.

### 3.5 `rosterId: null` semantics (runtime behaviour)

When a form's `rosterId` is null, the runtime athlete picker shows the **union of all athletes across all rosters** — deduplicated by athlete `id`. The coach picks from this combined list; no free-text athlete entry is permitted (prevents duplicate-athlete-by-typo). New athletes must first be added to a roster via the roster editor.

---

## 4. The Migration Path for Existing Pages

`coach.html` and `boxing.html` will be migrated to load via `/run-form.html?slug=basketball-coach` and `/run-form.html?slug=boxing-workshop`. The seed data for the registries is **lifted directly from `coach-data.js` and `boxing-data.js`** — no schema changes, just relocation. Specifically:

| Existing artefact | Target registry |
|---|---|
| `coach-data.js` `squad[]` | `rosters.json` → one roster `south-metro-u16` |
| `coach-data.js` `attributes[]` | `attributes.json` items, sports = `["basketball"]` |
| `coach-data.js` `phrases.technical['+'][n]` | one `phrases.json` item per entry, attribute = `technical`, sentiment = `+`, sports = `["basketball"]`, id = `p_2026_NNNN` |
| `coach-data.js` `coaches[]` | `coaches.json` |
| `boxing-data.js` equivalents | merged into the same registries with `sports: ["boxing"]` (or both if reusable) |

A one-shot migration script (`scripts/seed-registries.js`) reads the existing JS files, emits the four registry JSON files, uploads them to Blob. Idempotent — running it twice is a no-op given the same input.

**Existing tally storage (localStorage on coach.html) is not migrated.** Old tallies stay where they are; new tallies through the runtime engine write to `results/YYYY-MM-DD.jsonl`.

---

## 5. API Contract (the verbs)

The Blob storage is fronted by these endpoints. All under `/api/`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/registry?name=attributes\|metrics\|phrases\|forms\|rosters\|coaches` | GET | Read a registry file. Returns its full JSON. Cached 60s. |
| `/api/registry` | PUT | Write a registry file. Body: `{name, data}`. Full overwrite (Blob is single-writer here). |
| `/api/append-entry` | POST | Append one entry to today's (or `observedAt`'s) JSONL. Returns the entry with its minted id. |
| `/api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD&athleteId=&formSlug=` | GET | Read entries across a date range, optional filters. Loads each daily file in range. |

**Internal-tool simplification:** no auth on these endpoints in v1 — the deploy URL is private knowledge. If we open to real coaches we add a shared bearer token first.

---

## 6. The Frozen Closed Enums

These values are **part of the contract** — adding a new value requires a contract version bump.

```js
SENTIMENTS = ['+', '=', '-']
METRIC_KINDS = ['length','weight','time','count','speed','rating','boolean','text']
ENTRY_TYPES = ['phrase','metric']
FORM_STATUSES = ['draft','live','archived']
REGISTRY_STATUSES = ['active','archived']
PHRASE_SOURCES = ['seed','custom','imported']
LENGTH_UNITS = ['mm','cm','m','in','ft']
WEIGHT_UNITS = ['g','kg','lb']
TIME_UNITS = ['ms','s','min']                 // composite "h:m:s.ms" is a UI render mode, not a unit
SPEED_UNITS = ['m/s','km/h','mph']
```

---

## 7. What This Contract Deliberately Does NOT Specify

To keep v1 small, these are explicitly out of scope and will be added as named amendments:

- **Auth / multi-user permissions.** v1 is internal, single-writer.
- **Entry voiding / corrections.** Decide when first bad entry is logged.
- **Phrase translation / i18n.** Single-locale English for now.
- **Cross-form derived metrics ("training load index").** Aggregation is a read-time concern, separate doc.
- **Backups beyond Blob's built-in.** Manual export until volume justifies more.
- **Schema migration of past entries when a metric's canonical unit changes.** Lock prevents this from happening; if we ever need to, write a one-off migration with a contract bump.

---

## 8. Sign-off

This contract is locked when Daniel ticks the line below. After lock, no schema field may change without a contract version bump and a written migration plan.

- [ ] **Locked by Daniel Gordon on …**
