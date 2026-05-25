# ADR-0001 — Metric kinds are closed; units, sports, and formulas extend asymmetrically

**Status:** Accepted · **Date:** 2026-05-25 · **Deciders:** Daniel Gordon

## Context

The coach observation form supports numeric metric inputs (CMJ height, contact time, grip strength, etc.). Each metric has a `kind` (length, weight, time, …) that determines its canonical storage unit and the set of units coaches may enter values in. We must decide what is extensible and what is locked at contract level.

Three orthogonal axes need a policy:

1. **Kinds** — the dimensions we measure (length, weight, force, power, …)
2. **Units** — the surface forms within a kind (m, cm, in, ft, yd, …)
3. **Formulas** — computed metrics derived from other metrics (RSI = cmj_height / cmj_contact_time)
4. **Sports** — the closed list of sports forms can belong to

The sports-science research surfaced **12+ candidate kinds** beyond the original 8, and **hundreds of unit variants**. Coaches will keep finding new ones (kgf, yards, knots, spm, rpm…). We will not predict every metric two seasons from now.

## Decision

**Kinds are closed; units are open; formulas reference by key; sports are closed.**

| Axis | Policy | Why |
|---|---|---|
| **`kind`** | Closed enum at contract level. Adding a new kind requires a minor contract bump (v1.1 → v1.2). | Each kind requires conversion-factor maths and per-kind validation code. A "free string" kind would let any registry write silently break the runtime. Pre-loading 15 kinds covers ~95% of sports science. |
| **`displayUnits[]`** | Open within a kind. Append-only. No contract bump to add a new unit. | Units are just labels + a conversion constant. Old entries store `valueCanonical`; adding a new display unit can never break them. Removing a unit, however, would orphan historical `unitDisplay` values — so removal is forbidden. |
| **`formula`** | Optional string field on metric records, referencing other metrics by their `key`. Closed expression grammar: `+ - * / ( )`, `min/max/abs`, numeric literals. | Treating formulas as data (not code) lets coaches define new derived metrics without a deploy. The closed grammar is small enough to evaluate safely client-side. Key-references (vs label-references) make rename refactoring safe. |
| **`SPORTS`** | Closed enum at contract level. | Same logic as kinds — sport names are referenced by forms, metrics (`sports[]` filter), and rosters. Free-text sport names would produce "Rugby League" vs "rugby_league" vs "rugbyleague" duplicates. Adding a new sport is cheap (minor bump, no migration). |

### Hard rules that fall out of this

- A metric's `kind` and `canonicalUnit` are **permanent** the moment the first entry is logged against it. To "change kind" you archive the metric and create a new one with a new key.
- Same rule for computed metrics' `formula` — once any entry derives from it, the formula is locked. Edits create a new key.
- New units may be added to `displayUnits[]` of an existing metric at any time without ceremony.

## Alternatives considered

### A. Open-string kinds ("anything-goes")

Reject. Sports-science conversion tables are not freeform — kg/N/lb are physically distinct quantities. Treating "force" and "weight" as the same kind would silently corrupt aggregation across athletes when one used a kgf dynamometer and another a kg bathroom scale.

### B. Pre-bake all known units up front, freeze the unit list too

Reject. Both more brittle than the chosen rule and offers no benefit. Adding a unit later is a literal one-line change (constant + table entry) and cannot break old data. Freezing it forces a contract bump for trivial additions.

### C. Formula language with conditionals / aggregations / unit math

Reject for v1. The expression grammar bloats fast (`if/then`, `sum(...)`, `each_entry(...)`, unit dimensional analysis). 95% of sports-science calcs are `a / b`, `(a - b) / max(a,b)`, `(a / b) * 100` — covered by the minimal grammar. If a coach needs something fancier, they enter the value manually for now and we revisit if a real case appears.

### D. Per-sport metric registries (separate `metrics_basketball.json`, `metrics_boxing.json`)

Reject. Cross-sport overlap is massive (CMJ, sprint, 1RM, beep test all apply to 10+ sports). Splitting would force coaches to either duplicate-by-copy or invent cross-sport indirection. Sport applies to the picker UX only (via `metric.sports[]`), not to storage location.

### E. Calculated metrics as a separate registry / different shape

Reject. Adds a parallel discovery path coaches must learn. Embedding `formula` as an optional field on the existing metric record means computed metrics are searchable, filterable, archivable, and form-bindable identically to direct metrics.

## Consequences

**Positive:**
- Adding "yards" to length is a 2-line change. Adding "power" as a kind is a contract minor bump with zero data migration. The cost asymmetry matches the semantic asymmetry.
- Computed metrics (RSI, asymmetry %, %1RM, work:rest) get the same first-class treatment as direct ones. Two coaches who both want RSI get the same `rsi` key, so cross-form aggregation works.
- Foot-guns are pushed into the designer UX (warnings on weight-vs-force naming, fuzzy-match on duplicates), not into the data model.

**Negative:**
- Computed metrics that need conditional logic (e.g. "%1RM only if athlete has a recent 1RM test on file") cannot be expressed. Coaches type manually.
- The author of a computed metric is responsible for unit-correctness. No dimensional-analysis checks. Mitigated by the small set of canonical units and the §2.2.6 warning system.
- Sports-science purists will object to "weight" meaning mass. Mitigated by the §2.2.6 explicit guidance + the `force` kind being available alongside.

## Tells if this decision is wrong

- We hit a new kind we forgot every 1-2 months (signal: contract was too small, expand)
- Coaches keep entering text into the formula box trying to express conditionals (signal: revisit grammar)
- The same physical measurement gets stored as two different metric keys across forms because of sport-side filtering (signal: sports filter is too aggressive)
