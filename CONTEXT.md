# VertexMock — Domain Context

The shared language for this project. When a term here conflicts with how it gets used in conversation or code, **this file wins** — call the conflict out and resolve before writing more code.

## Glossary

### Observation forms

| Term | Definition | Don't confuse with |
|---|---|---|
| **Form** | A coach-facing input page rendered at `/run-form.html?slug=…`. Replaces the old `coach.html` and `boxing.html`. | *Form Definition* (the record), *Form Version* (the snapshot). |
| **Form Definition** | The data record describing a Form — its attributes, phrases, optional metric inputs. | The rendered HTML page (that's the *Form*). |
| **Form Version** | An immutable snapshot of a Form Definition. Forms have an N-of-versions history; the active one is `currentVersion`. | A draft (drafts live on `forms.json` outside `versions[]` until Publish). |
| **Designer** | The internal-only GUI for creating, editing, drafting, and archiving Forms. Three-pane layout: list / editor / preview. | *Runtime* — the page coaches actually use to log observations. |
| **Runtime** | The page that renders a published Form Version and accepts coach entries. URL: `/run-form.html?slug=…`. | *Designer*. |

### Observation content

| Term | Definition | Don't confuse with |
|---|---|---|
| **Attribute** | A category in the form's tile grid (Technical, Tactical, Physical, …). Belongs to the shared `attributes.json` registry. | *Metric*. Attributes are qualitative; metrics are numeric. |
| **Sentiment** | One of `+`, `=`, `-`. The closed set; a Form may opt out of some but not extend. | Coach rating (that's a `rating` *Metric kind*). |
| **Phrase** | A reusable text snippet keyed by (attribute, sentiment). Tagged on entries. Belongs to `phrases.json`. | *Note* — phrases are pre-baked library items; notes are freeform per-entry. |
| **Metric** | A typed numeric measurement (`cmj_height`, `back_squat_1rm`). Belongs to `metrics.json`. | *Attribute*. |
| **Direct metric** | A Metric where the coach enters the value at runtime. `formula: null`. | *Computed metric*. |
| **Computed metric** | A Metric whose value is derived at runtime from other metrics on the same form via `formula`. Read-only — coaches can't override. | *Direct metric*. |
| **Kind** | The dimension of a Metric: `length`, `weight`, `time`, `force`, `power`, etc. Closed enum, see contract §6. | *Unit*. |
| **Canonical unit** | The single storage unit for a Metric's kind (m for length, kg for weight, s for time, N for force). | *Display unit* (what coach enters in). |
| **Display unit** | A unit a coach may enter values in for a Metric. The runtime converts to canonical on save. | *Canonical unit*. Display units are append-only per metric. |

### Logged data

| Term | Definition | Don't confuse with |
|---|---|---|
| **Entry** | A single observation logged at runtime — one row in the day's results file. Either a Phrase tag or a Metric reading. | *Session* (a group of entries), *Form Version* (the schema the entry was logged against). |
| **Session** | An optional grouping that auto-tags entries made while it's active (coach, kind=Training/Game/Review, gym). | *Form*, *Day*. A session is a runtime context bag. |
| **Day file** | The append-only JSONL file at `results/YYYY-MM-DD.jsonl`. One Entry per line. Routed by `observedAt`, not by arrival time. | A backup. |
| **Snapshot field** | A denormalised field on an Entry that preserves what a referenced record looked like at entry time (`textSnapshot`, `labelSnapshot`). | The live record (which may have since changed). |

### Athletes & coaches

| Term | Definition | Don't confuse with |
|---|---|---|
| **Athlete** | The person being observed. Permanent `id`, referenced from Entries. | *Roster member* — athletes ARE roster members; "roster member" isn't a separate concept. |
| **Roster** | A named group of Athletes (`south-metro-u16`). Forms bind to a Roster (or `null` = union of all rosters). | *Squad* (informal synonym in UI copy; in data it's always "roster"). |
| **Coach** | The person doing the observing. Permanent `id`, optional `coachId` on each Entry. | *Author* — coach is the entry author at runtime; the contract uses "coach" specifically. |

### Identifiers

| Term | Format | Mintage |
|---|---|---|
| Phrase id | `p_<YYYY>_<6-digit counter>` | Designer fetches current year's max counter on load, increments. |
| Entry id | `e_<YYYY>_<MM>_<DD>_<6 hex>` | Server mints on append. |
| Metric key | `snake_case` slug, no leading digit | Author chooses; designer enforces uniqueness. |
| Attribute key | `snake_case` slug | As above. |
| Form slug | `kebab-case`, URL-safe | As above. |

## Permanence rules (the immutability discipline)

Things that are **permanent once issued** and require a new key/id to "change":

- Phrase `id`, `text`, `attribute`, `sentiment` (Option 1 immutability)
- Metric `key`, `kind`, `canonicalUnit`, `formula`
- Form `slug`
- Athlete `id`
- Roster `id`
- Coach `id`
- Entry `id` and any of its content fields

Things that are **append-only** (can grow, can't shrink):

- Metric `displayUnits[]`
- A Form's `versions[]`

Things that are **freely editable**:

- Labels, glyphs, descriptions, `min`/`max`/`decimals`, `category`, `sports[]` filter, `status` (active/archived)

If you find yourself wanting to mutate something in the first list, the answer is always **archive the old, create a new key, re-point the references**.

## Cross-cutting decisions

- **Storage:** Vercel Blob, private. Registries are JSON (overwrite). Results are JSONL (append daily).
- **Auth:** None in v1. Internal tool, single writer.
- **Voiding entries:** Not supported in v1. Will be added as a `type: void` Entry pointing to an original `id` if needed.
- **Sports:** Closed enum. See contract §6 `SPORTS` and ADR-0001.
- **Computed metrics:** Read-only at runtime, formula references metrics by key, hard error at form-publish if any referenced metric is missing.

## Anti-patterns (call these out when you see them)

- ❌ "Edit the phrase text" — phrases are immutable once referenced. Archive + new id.
- ❌ "Change this metric's unit from cm to mm" — `canonicalUnit` is permanent. Archive + new metric.
- ❌ "Let me type the athlete name" — runtime athlete picker is closed-list, no free text.
- ❌ "Add `force_kg` as a force metric in kg" — kgf is the force unit; expose it as a display unit on a force metric, don't fake it as kg.
- ❌ "Just override the RSI value the runtime computed" — computed metrics are read-only. Edit the inputs if the inputs are wrong.
- ❌ "Sport is just a string" — sports are a closed enum (ADR-0001). Adding "Rugby League 7s" requires a contract bump.
