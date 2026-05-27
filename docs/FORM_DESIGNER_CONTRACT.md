# Coach Observation Form — Data Contract v1.4

**Status:** Locked · **Owner:** Daniel Gordon · **Date locked:** 2026-05-27

This document is the **frozen** schema that every part of the form designer, runtime, storage layer, and dashboard must obey. Code changes that break this contract require a new contract version (v1.5, v2.0, etc.) and a written migration plan in this folder.

### v1.4 changelog (2026-05-27)

Additive only — no entries written yet:

- §2.4 — **Form record refinements** for Phase 1 designer: new optional `description` field (markdown, ≤500 chars); new permanent timestamps `publishedAt` and `archivedAt` (server-stamped on state transition).
- §2.4 — **Lifecycle states LOCKED as one-way** Draft → Live → Archived. Unpublish and restore are forbidden; the escape hatch is **Clone as draft** (creates a new form with a new slug, preserving the original). Drafts (with zero entries by definition) MAY be deleted with confirmation. Live and Archived forms MAY NOT be deleted. (ADR-0004.)
- §2.4 — **Phrase library scoping for the picker**: when the form designer or runtime renders the phrase picker, phrases are filtered to those where `phrase.sports` includes the form's `sport` OR `phrase.sports` is empty (universal). This is a UX filter, not enforced server-side — a phrase whose `sports` list excludes the form's sport can still be tagged on an entry if added through another path.
- §2.4 — **Sentiment subsetting**: a form MAY restrict its `sentiments` array to a subset of the closed `{+, =, -}`; default is all three. Forms MAY NOT extend the enum.
- §5 — **Save model LOCKED for Phase 1**: drafts autosave on field-change with an 800ms debounce (full-collection PUT to `/api/registry`). State transitions (publish, archive, clone-as-draft, delete-draft) are explicit user actions, not autosaved. (ADR-0004.)
- §5 — **Designer URL grammar**: `form-designer.html#draft/<slug>`, `#live/<slug>`, `#archived/<slug>`, `#new`. The status segment is a hint; the form's own `status` field is the source of truth. Mismatched URLs auto-rewrite on resolve.

### v1.3 changelog (2026-05-26)

Additive only — no entries written under v1.2 yet:

- §3.1 / §3.2 — **New required fields** `createdBy` and `updatedBy` (email, lowercase) on every writable record: form definitions, registry items, entries. Stamped server-side from the session principal (currently the hard-coded owner — see ADR-0003).
- §3.1 — **New required field** `updatedAt` (epoch ms) on every writable record. Server-stamped.
- §3.2 — New invariant: `createdBy` is PERMANENT after first write; `updatedBy` and `updatedAt` are refreshed on every write.
- §5 — All write endpoints (`PUT /api/registry`, `POST /api/append-entry`) stamp `createdBy`/`updatedBy`/`updatedAt` server-side; client-supplied values for these fields are ignored.
- §6 — New term: **Owner stamping** = the practice of recording who wrote a record, even before real authentication exists.

### v1.2 changelog (2026-05-25)

Additive only — no data migration required (no entries written yet under v1.1):

- §3.1 / §6 — **New required field** `metric.source` on every metric entry, drawn from new `MEASUREMENT_SOURCES` closed enum (ADR-0002).
- §3.1 — **New optional field** `metric.sourceMeta` (freeform dict) for device/version forensics.
- §3.2 — New invariant: `source = "computed"` iff `computed: true`.

### v1.1 changelog (2026-05-25)

Additive only — no migration required:

- §2.2 — Expanded `METRIC_KINDS` from 8 to 15 kinds (added `force`, `power`, `angle`, `frequency`, `ratio`, `percentage`, `acceleration`).
- §2.2 — Expanded permitted unit sets per kind (incl. open extensibility rule).
- §2.2 — **New:** optional `formula` field on metric registry entries (computed metrics).
- §2.2 — **New:** optional `sports[]` filter on metric registry entries (picker UX only — not enforced).
- §2.2 — **New:** weight-vs-force coach guidance.
- §3.4 — **Locked:** Phrase id width = 6 digits (`p_<YYYY>_<6 digits>` → 1M/year ceiling).
- §6 — Added `SPORTS` closed enum.
- §6 — Added unit tables for the 7 new kinds.
- §6 — Documented the kinds-closed / units-open extensibility asymmetry.

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
| **Metric** | A typed numeric measurement (jump_height, lift_weight, contact_time). Belongs to a shared registry. May be **direct** (coach enters) or **computed** (formula on other metrics). |
| **Kind** | The dimension of a metric (length, weight, time, …). Closed enum, see §6. |
| **Canonical Unit** | The single storage unit for a metric's kind (e.g. `m` for length). Display units convert in/out of this. |
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
    metrics.json            ← all metrics (medium, ~200 entries seeded)
    phrases.json            ← all phrases (medium, ~1000s over time)
    forms.json              ← all form definitions, all versions
    rosters.json            ← all rosters
    coaches.json            ← all coaches (mirrors squad/staff)
    sports.json             ← closed enum, mirrored from §6 SPORTS for runtime
  results/
    2026-05-25.jsonl        ← append-only daily entries (one JSON object per line)
    2026-05-24.jsonl
    ...
```

- **Why JSON for registries, JSONL for results:** registries are read whole on form load (small, hot, cached). Results are appended one row at a time and read by date range; JSONL avoids ever rewriting a multi-MB file.
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
  "version": 1,
  "items": [
    {
      "key": "technical",                  // SLUG. snake_case. permanent. unique.
      "label": "Technical",                // display name. editable.
      "short": "TECH",                     // abbreviated label for tight UI. editable.
      "glyph": "◆",                        // single char/emoji for the tile. editable.
      "topic": "Technical skill",          // descriptive subtitle. editable.
      "sports": ["basketball","boxing"],   // applicability tags. editable.
      "status": "active",                  // "active" | "archived"
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

    // ── Direct metric (coach enters a value) ──
    {
      "key": "cmj_height",                 // SLUG. snake_case. PERMANENT. unique.
      "label": "CMJ height",               // display name. editable.
      "kind": "length",                    // one of METRIC_KINDS (§6). PERMANENT once referenced.
      "canonicalUnit": "m",                // PERMANENT once any entry references this metric.
      "displayUnits": ["cm","in"],         // units coach may enter in. APPEND-ONLY.
      "min": 0,                            // sanity floor (canonical). editable.
      "max": 1.5,                          // sanity ceiling (canonical). editable.
      "decimals": 2,                       // display precision. editable.
      "category": "jumps",                 // picker grouping (see §2.2.5). editable.
      "sports": ["*"],                     // picker filter only. "*" = all sports. editable.
      "formula": null,                     // null = direct metric (coach enters value)
      "status": "active",
      "source": "seed",
      "createdAt": "2026-05-25T09:00:00Z",
      "updatedAt": "2026-05-25T09:00:00Z"
    },

    // ── Computed metric (derived from other metrics) ──
    {
      "key": "rsi",
      "label": "RSI (reactive strength index)",
      "kind": "ratio",
      "canonicalUnit": "",                 // ratio kind = unitless ("" or "x")
      "displayUnits": [""],
      "min": 0,
      "max": 5,
      "decimals": 2,
      "category": "jumps",
      "sports": ["*"],
      "formula": "cmj_height / cmj_contact_time", // see §2.2.3 formula language
      "status": "active",
      "source": "seed",
      "createdAt": "...", "updatedAt": "..."
    }
  ]
}
```

#### 2.2.1 Hard rules on metric records

- `key` is **PERMANENT**.
- `kind` and `canonicalUnit` are **PERMANENT** once any entry references this metric (locked the moment the first entry is logged).
- `displayUnits` is **APPEND-ONLY** — units may be added but never removed (would break historical entry display).
- `formula` is **APPEND-ONLY in concept**: once a computed metric has any entries, the formula may not change (would silently break aggregation). Add a new computed metric (e.g. `rsi_v2`) with a new key.
- `min`/`max` changes don't rewrite history — they only validate future entries.
- Allowed `kind` values are fixed by §6. Adding a new kind = contract version bump (no data migration needed; existing entries don't reference new kinds).
- Allowed display units per kind are listed in §6 but are **append-only** (new units may be added in any contract version without bumping major version).

#### 2.2.2 Direct vs computed metrics

| Field | Direct | Computed |
|---|---|---|
| `formula` | `null` | non-empty string |
| Runtime behaviour | Coach types value | Runtime auto-evaluates from referenced metrics |
| Override | Coach value is the truth | **Read-only** — value re-derives from inputs; coaches cannot override (would corrupt downstream aggregations) |
| Form-save validation | — | **Hard error** if form does not also include all metrics referenced in the formula |
| Entry shape | Same `valueCanonical` / `valueDisplay` fields | Same — runtime stores the computed result like any other entry |

#### 2.2.3 Formula language (minimal)

Formulas operate on `valueCanonical` of referenced metrics. The runtime evaluator supports:

- Numeric literals: `100`, `9.81`, `0.5`
- Metric key references: any other metric's `key` resolves to its current entry's `valueCanonical` on the same form submission
- Operators: `+ - * / ( )`
- Functions: `min(a,b)`, `max(a,b)`, `abs(x)`

No conditionals, no string ops, no aggregation across other entries. If a coach needs more, they enter the value manually.

**Foreign-key semantics:** a `formula` references other metrics by `key`. Archiving (or renaming-by-archival) any referenced metric makes the computed metric uncomputable. The designer must warn loudly before archiving any metric that is referenced by an active computed metric.

**Unit semantics:** the formula consumes canonical units of its inputs and produces a value declared to be in `canonicalUnit` of the computed metric. The author of a computed metric is responsible for unit-correctness (the language does no unit math). Example: `rsi = cmj_height (m) / cmj_contact_time (s)` has implicit units m/s but is declared `kind: "ratio"`, `canonicalUnit: ""` — sports-science convention treats RSI as unitless.

#### 2.2.4 Sports filter

`sports[]` is **picker UX only** — it controls what metrics surface when a coach builds a form for a given sport. It is **not enforced**: a coach can still pick any metric for any form. This avoids over-constraining genuine cross-sport use.

- `["*"]` means "show for all sports"
- `["basketball","netball"]` means "show in basketball or netball forms, hide elsewhere"
- Empty array `[]` means "hidden from picker by sport filter, only findable via search"

#### 2.2.5 Categories (picker UX grouping)

Picker groups metrics by **physical/skill domain** (not by sport). The category set is open — coaches can add new ones via the designer. Seeded values:

```
anthropometry · jumps · sprints · agility · lifts · endurance ·
power · grip-strength · flexibility · skill · combat · perceptual ·
body-comp · wellness · derived
```

#### 2.2.6 Weight vs Force — coach-friendly naming convention

Sports-science strictly: **weight = force = mass × g (N)**. Coach-vernacular: "weight" means **mass (kg/lb)**. The contract sides with coaches:

| Kind | Canonical | Typical coach use | Examples |
|---|---|---|---|
| `weight` | kg | Body mass and lifted mass | Bodyweight, 1RM lifts |
| `force` | N | Force as measured by force plates / dynamometry | Force plate peak GRF, grip strength dynamometer reading |

**Foot-gun warning baked into the designer:** when a coach creates a new metric with a label containing "force", "grip", "pull", "press" (force-y words) and picks `kind: "weight"`, the designer surfaces a non-blocking warning: *"This sounds like a force measurement. Consider `kind: force` (Newtons) instead. Hand-grip dynamometers labelled in kg are reporting kgf (kilogram-force) — that's a force unit, not mass."*

Grip dynamometers using kgf scale: store using `kind: force`, `displayUnits: ["kgf","N"]`.

### 2.3 `phrases.json`

```jsonc
{
  "version": 1,
  "items": [
    {
      "id": "p_2026_000001",                // PERMANENT. 6-digit counter per year. opaque.
      "text": "Clean catch-and-shoot footwork on the move",
      "attribute": "technical",             // FK to attributes[].key
      "sentiment": "+",                     // one of "+" | "=" | "-"
      "sports": ["basketball"],             // tags for filtering in designer
      "status": "active",
      "source": "seed",                     // "seed" | "custom" | "imported"
      "createdAt": "2026-05-25T09:00:00Z",
      "createdBy": "dan",
      "updatedAt": "2026-05-25T09:00:00Z"
    }
  ]
}
```

**Rules (OPTION 1 IMMUTABILITY — LOCKED):**
- `text`, `attribute`, `sentiment` are **PERMANENT** once any entry references this phrase.
- To "edit" a phrase: archive the old one (status → "archived"), create a new phrase with a new id, re-point any draft form that referenced the old one.
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
      "description": "Use after every training session. ~3 min.",  // OPTIONAL. v1.4. markdown, ≤500 chars. editable.
      "sport": "basketball",               // one of SPORTS (§6). editable.
      "rosterId": "south-metro-u16",       // FK to rosters[].id, or null = union of all rosters (§3.5)
      "status": "live",                    // "draft" | "live" | "archived" — one-way Draft→Live→Archived (v1.4, ADR-0004)
      "currentVersion": 3,
      "publishedAt": "2026-05-25T09:00:00Z",  // v1.4. PERMANENT once set (Draft→Live). null while draft.
      "archivedAt": null,                  // v1.4. PERMANENT once set (Live→Archived). null otherwise.
      "createdAt": "2026-05-25T09:00:00Z",
      "createdBy": "dan@superepic.com.au",  // v1.3 owner stamping. PERMANENT. lowercase email.
      "updatedAt": "2026-05-27T04:15:00Z",  // v1.3. server-stamped on every write.
      "updatedBy": "dan@superepic.com.au",  // v1.3. server-stamped on every write.
      "versions": [
        {
          "version": 3,
          "publishedAt": "2026-05-25T09:00:00Z",
          "publishedBy": "dan",
          "attributes": ["technical","tactical","physical","mental","consistency","leadership"],
          "sentiments": ["+","=","-"],
          "phraseSets": {
            "technical": {
              "+": ["p_2026_000001","p_2026_000004","p_2026_000007"],
              "=": ["p_2026_000042","p_2026_000043"],
              "-": ["p_2026_000099"]
            }
          },
          "metricInputs": [
            { "metric": "cmj_height", "label": "CMJ height", "required": false, "perEntryDefault": null },
            { "metric": "cmj_contact_time", "label": "Contact time", "required": false, "perEntryDefault": null },
            { "metric": "rsi", "label": "RSI", "required": false, "perEntryDefault": null, "computed": true }
          ],
          "sessionFields": {
            "showSessionToggle": true,
            "sessionKinds": ["Training","Game","Review"],
            "showBulkMode": true
          }
        }
      ]
    }
  ]
}
```

**Rules:**
- `slug` is permanent. `currentVersion` advances on Publish.
- Each entry in `versions[]` is immutable once published.
- Draft edits live on a `draft` field outside `versions[]` until Publish promotes them.
- **Lifecycle is one-way** (v1.4, ADR-0004): Draft → Live → Archived. No unpublish, no restore. To edit a Live form, **Clone as draft** — creates a new form with a new slug, original is untouched. Live and Archived forms cannot be deleted; drafts can.
- `publishedAt` is set server-side on the Draft→Live transition and is **permanent**. `archivedAt` is set server-side on Live→Archived and is **permanent**.
- `currentVersion` is `null` while the form is in draft (no versions published yet); becomes `1` on first publish, advances on each subsequent publish (Phase 4+).
- **Phrase picker scoping** (v1.4): the designer and runtime filter the phrase library by `phrase.sports ∋ form.sport` OR `phrase.sports == []`. UX filter only, not server-enforced.
- **Sentiments subset** (v1.4): a form's `sentiments` array MAY restrict to a subset of `{+, =, -}`; MAY NOT extend the enum.
- **Computed-metric input dependency check (HARD ERROR at publish):** for every metric in `metricInputs[]` with `formula != null`, every referenced metric must also be in `metricInputs[]` of the same version. Publish refuses otherwise with: *"Form includes computed metric `rsi` which references `cmj_contact_time`. Add `cmj_contact_time` to this form's metric inputs, or remove `rsi`."*

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

### 2.7 `sports.json`

Mirror of §6 `SPORTS`. Runtime reads this file rather than hard-coding the enum — makes it possible to add a new sport via a registry update + contract bump without a code deploy. Permitted values come from the contract; the file does not invent new sports.

---

## 3. Entries (the results layer)

### 3.1 Per-day JSONL file (`results/YYYY-MM-DD.jsonl`)

One JSON object per line. Each line is a single observation entry. Schema:

```jsonc
{
  "id": "e_2026_05_25_a3f9c2",             // PERMANENT. UUID-like, sortable by time.
  "type": "phrase",                        // "phrase" | "metric"
  "formSlug": "basketball-coach",
  "formVersion": 3,
  "athleteId": "ava",
  "rosterId": "south-metro-u16",
  "coachId": "lin",
  "sessionId": "s_2026_05_25_evening",
  "sessionKind": "Training",
  "observedAt": "2026-05-25T18:42:00+10:00",
  "createdBy": "dan@superepic.com.au",     // REQUIRED. PERMANENT. Server-stamped from session principal. (ADR-0003.)
  "updatedBy": "dan@superepic.com.au",     // REQUIRED. Server-stamped. Equals createdBy on first write.
  "updatedAt": 1748263320000,              // REQUIRED. Epoch ms. Server-stamped.


  // ── If type === "phrase" ──
  "phrase": {
    "id": "p_2026_000001",
    "textSnapshot": "Clean catch-and-shoot footwork on the move",
    "attribute": "technical",
    "sentiment": "+"
  },

  // ── If type === "metric" ──
  "metric": {
    "key": "cmj_height",
    "valueCanonical": 0.421,               // canonical unit always (m for length)
    "valueDisplay": 42.1,                  // what coach entered (or what the detector produced)
    "unitDisplay": "cm",                   // unit displayed
    "labelSnapshot": "CMJ height",
    "computed": false,                     // true if this entry was derived via formula
    "source": "video_240fps",              // REQUIRED. one of MEASUREMENT_SOURCES (§6). PERMANENT.
    "sourceMeta": {                        // OPTIONAL. freeform device/version metadata. PERMANENT.
      "device": "iPhone 17 Pro",
      "appVersion": "0.4.2",
      "detectorVersion": "vision_v3"
    }
  },

  "notes": null
}
```

### 3.2 Hard invariants on entries

- **Exactly one of `phrase` or `metric` is non-null.**
- **`textSnapshot` and `labelSnapshot` are denormalised on purpose** — they preserve what was tagged even after the source registry changes.
- **`valueCanonical` is always present for metrics**, even when the coach entered in a non-canonical unit (we convert on save).
- **Computed metric entries** carry `computed: true`, `source: "computed"`, and have no separate "coach-entered" provenance — `valueDisplay` is always the runtime-computed result rendered in the metric's canonical unit (no unit picker shown to coach).
- **`metric.source` is REQUIRED and IMMUTABLE.** Must be one of `MEASUREMENT_SOURCES` (§6). Server rejects entries with missing/invalid source. (ADR-0002.)
- **Source-computed cross-check:** `source = "computed"` iff `computed = true`. Server enforces.
- **`sourceMeta` is OPTIONAL and IMMUTABLE.** Freeform dict; UI may render values for forensics but does not validate.
- **`createdBy` is REQUIRED and PERMANENT.** Lowercase email. Server-stamped from session principal; client-supplied values are ignored. (ADR-0003.)
- **`updatedBy` and `updatedAt` are REQUIRED.** Server-stamped on every write. On first write, `updatedBy === createdBy` and `updatedAt === createdAt`.
- **Entries are immutable.** v1 ships without void; ship as v1.x amendment if needed. (Despite immutability, the `updatedBy`/`updatedAt` fields are mandated for schema symmetry with mutable records like form definitions and registry items.)
- **`observedAt` may not equal write time** — coaches can backfill, so daily-file routing uses `observedAt` not arrival time.

### 3.3 Entry id format

`e_<YYYY>_<MM>_<DD>_<6 hex chars>` — sortable lexically, debuggable on sight.

### 3.4 Phrase id format — **LOCKED**

`p_<YYYY>_<6-digit zero-padded counter>` — 1,000,000 phrases per year ceiling. Counter resets per year. Designer fetches the current year's max counter on load.

Example: `p_2026_000001`, `p_2026_000042`, `p_2026_999999`.

### 3.5 `rosterId: null` semantics (runtime behaviour)

When a form's `rosterId` is null, the runtime athlete picker shows the **union of all athletes across all rosters** — deduplicated by athlete `id`. The coach picks from this combined list; no free-text athlete entry is permitted (prevents duplicate-athlete-by-typo). New athletes must first be added to a roster via the roster editor.

---

## 4. The Migration Path for Existing Pages

`coach.html` and `boxing.html` will be migrated to load via `/run-form.html?slug=basketball-coach` and `/run-form.html?slug=boxing-workshop`. The seed data for the registries is **lifted directly from `coach-data.js` and `boxing-data.js`** — no schema changes, just relocation:

| Existing artefact | Target registry |
|---|---|
| `coach-data.js` `squad[]` | `rosters.json` → one roster `south-metro-u16` |
| `coach-data.js` `attributes[]` | `attributes.json` items, sports = `["basketball"]` |
| `coach-data.js` `phrases.technical['+'][n]` | one `phrases.json` item per entry, id = `p_2026_000NNN` |
| `coach-data.js` `coaches[]` | `coaches.json` |
| `boxing-data.js` equivalents | merged into the same registries with `sports: ["boxing"]` (or both if reusable) |

A one-shot migration script (`scripts/seed-registries.js`) reads the existing JS files, emits the registry JSON files, uploads them to Blob. Idempotent — running it twice is a no-op given the same input. The script also writes the seeded `metrics.json` (the ~150-metric catalogue from this contract bump).

**Existing tally storage (localStorage on coach.html) is not migrated.** Old tallies stay where they are; new tallies through the runtime engine write to `results/YYYY-MM-DD.jsonl`.

---

## 5. API Contract (the verbs)

The Blob storage is fronted by these endpoints. All under `/api/`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/registry?name=attributes\|metrics\|phrases\|forms\|rosters\|coaches\|sports` | GET | Read a registry file. Cached 60s. |
| `/api/registry` | PUT | Write a registry. Body: `{name, data}`. Full overwrite. Server stamps `createdBy`/`updatedBy`/`updatedAt` on every contained record. |
| `/api/append-entry` | POST | Append one entry to today's (or `observedAt`'s) JSONL. Returns the entry with its minted id and stamped owner fields. For computed metrics on the same form submission, runtime evaluates and submits a separate entry per computed metric. |
| `/api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD&athleteId=&formSlug=` | GET | Read entries across a date range, optional filters. |

**Owner stamping (ADR-0003):** every write endpoint resolves a `principal` (currently the hard-coded constant `OWNER`; later, the session email) and stamps `createdBy`/`updatedBy`/`updatedAt` server-side. Client-supplied values for these fields are silently overwritten. This shapes data for the eventual auth migration so no back-fill is required.

**Save model (ADR-0004):** the Phase 1 designer autosaves draft edits with an 800ms debounce. Every debounce fire issues a full-collection `PUT /api/registry` for `name=forms`. State transitions (publish, archive, clone-as-draft, delete-draft) are explicit user actions — separate endpoints in Phase 2+, or separate `action` payloads on `PUT /api/registry` in Phase 1. Designer URL grammar: `form-designer.html#draft/<slug>`, `#live/<slug>`, `#archived/<slug>`, `#new`.

**Internal-tool simplification:** no auth on these endpoints in v1 — the deploy URL is private knowledge. Open access = shared bearer token before any external coach is given the URL.

---

## 6. The Frozen Closed Enums

These values are **part of the contract** — adding a new value requires a contract version bump. Removing one is forbidden (would orphan data).

```js
// ── Domain enums ──
SENTIMENTS       = ['+', '=', '-']
ENTRY_TYPES      = ['phrase', 'metric']
FORM_STATUSES    = ['draft', 'live', 'archived']
REGISTRY_STATUSES = ['active', 'archived']
PHRASE_SOURCES   = ['seed', 'custom', 'imported']

// ── Sports (closed enum, ADR-0001) ──
SPORTS = [
  'basketball', 'soccer', 'netball', 'hockey',
  'rugby_league', 'rugby_union', 'afl',
  'tennis', 'volleyball', 'boxing',
  'athletics_sprints', 'athletics_distance',
  'athletics_throws', 'athletics_jumps'
]

// ── Metric kinds (closed enum, ADR-0001) ──
METRIC_KINDS = [
  'length', 'weight', 'time', 'count', 'speed',
  'rating', 'boolean', 'text',
  'force', 'power', 'angle', 'frequency',
  'ratio', 'percentage', 'acceleration'
]

// ── Measurement sources (closed enum, ADR-0002) ──
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

### 6.1 Unit tables per kind

Display units are **append-only** within a contract version (new units don't need a version bump — they don't break anything). Canonical units never change.

| kind | canonical | allowed display units | notes |
|---|---|---|---|
| `length` | m | `mm, cm, m, in, ft, yd, km, mi` | distance, height, reach, sprint splits |
| `weight` | kg | `g, kg, lb` | mass — bodyweight, 1RM. Coach vernacular. |
| `time` | s | `ms, s, min, h` | UI may render h:m:s.ms but stored as seconds |
| `count` | unit | `unit` | integer reps, makes, attempts |
| `speed` | m/s | `m/s, km/h, mph, ft/s, kn` | |
| `rating` | (int 1..N) | scale-specific | RPE, Borg, coach 1–10 |
| `boolean` | bool | `true/false` | |
| `text` | string | freeform | |
| `force` | N | `N, kgf, lbf` | force plates, dynamometers. kgf ≈ 9.81 N |
| `power` | W | `W, kW, hp` | Wingate, FTP, bar-velocity × load |
| `angle` | deg | `deg, rad` | joint ROM, launch angle |
| `frequency` | Hz | `Hz, rpm, spm, bpm` | HR (bpm), cadence (spm/rpm) |
| `ratio` | (unitless float) | `""` or `x` or `:1` | RSI, asymmetry, work:rest |
| `percentage` | % | `%` | %1RM, %HRmax, body fat |
| `acceleration` | m/s² | `m/s², g` | g = 9.80665 m/s² |

### 6.2 Conversion factors (canonical)

Stored in code, not registry. All conversions are linear (factor × value):

```js
const CONVERSIONS = {
  length:  { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048, yd: 0.9144, km: 1000, mi: 1609.344 },
  weight:  { g: 0.001, kg: 1, lb: 0.45359237 },
  time:    { ms: 0.001, s: 1, min: 60, h: 3600 },
  speed:   { 'm/s': 1, 'km/h': 1/3.6, mph: 0.44704, 'ft/s': 0.3048, kn: 0.514444 },
  force:   { N: 1, kgf: 9.80665, lbf: 4.4482216152605 },
  power:   { W: 1, kW: 1000, hp: 745.6998715822702 },
  angle:   { deg: 1, rad: 57.29577951308232 },
  frequency:{ Hz: 1, rpm: 1/60, spm: 1/60, bpm: 1/60 },
  acceleration:{ 'm/s²': 1, g: 9.80665 }
}
// canonical_value = display_value * CONVERSIONS[kind][display_unit]
```

### 6.3 Extensibility rule (ADR-0001 summary)

| Change | Cost | Action |
|---|---|---|
| Add a new UNIT to existing kind | Trivial. No contract bump. | Append to §6.1 table + add conversion constant. |
| Add a new KIND | Minor. Contract minor-version bump. No data migration. | Old entries don't reference new kinds. |
| Add a new SPORT | Minor. Contract minor-version bump. No data migration. | |
| Change a metric's `kind` or `canonicalUnit` after first entry | **FORBIDDEN** — archive old metric + create new key. | Old `valueCanonical` would silently re-interpret. |
| Remove a unit from `displayUnits` of a metric | **FORBIDDEN** — append-only. | Historical entries' `unitDisplay` would become orphaned. |
| Change a computed metric's `formula` after first entry | **FORBIDDEN** — archive + new key. | Old computed entries would no longer reproduce. |

---

## 7. What This Contract Deliberately Does NOT Specify

To keep v1 small, these are explicitly out of scope and will be added as named amendments:

- **Auth / multi-user permissions.** v1 is internal, single-writer.
- **Entry voiding / corrections.** Decide when first bad entry is logged.
- **Phrase translation / i18n.** Single-locale English for now.
- **Cross-form derived metrics ("training load index").** Aggregation is a read-time concern, separate doc.
- **Backups beyond Blob's built-in.** Manual export until volume justifies more.
- **Schema migration of past entries when a metric's canonical unit changes.** Lock prevents this from happening; if we ever need to, write a one-off migration with a contract bump.
- **Composite-unit metrics (e.g. `ml/kg/min` for VO2max).** Stored as `kind: ratio` with display-string convention; not first-class.

---

## 8. Sign-off

This contract is **locked** as v1.4 on 2026-05-27 by Daniel Gordon. After lock, no schema field may change without a contract version bump and a written migration plan.

- [x] **Locked by Daniel Gordon on 2026-05-25 (v1.0 → v1.1 → v1.2 same day, all additive)**
- [x] **v1.3 locked by Daniel Gordon on 2026-05-26 (owner stamping before auth, additive)**
- [x] **v1.4 locked by Daniel Gordon on 2026-05-27 (form lifecycle states, save model, designer URL grammar, additive)**
