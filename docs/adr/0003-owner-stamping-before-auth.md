# ADR-0003 — Owner stamping before real authentication

**Status:** Accepted · **Date:** 2026-05-26 · **Deciders:** Daniel Gordon

## Context

Phase 1 of the form designer ships with **one user** (Daniel Gordon, the author/founder) and **no authentication**. The deploy URL is private knowledge; the API endpoints under `/api/*` are open. This is appropriate for a single-author dev environment and matches the "internal-tool simplification" already documented in FORM_DESIGNER_CONTRACT.md §5.

However, **the data shape we choose now will be in production when the second coach arrives.** The seed registries (sports, attributes, phrases, metrics) and any test form definitions and test entries written during Phase 1 will outlive the no-auth assumption. Two paths are possible:

1. **Omit owner fields entirely now**, add them later — requires a back-fill migration that has to invent `createdBy` values for records written before the field existed. For test data we'd guess; for real entries (if any leak in before auth lands) we'd guess wrong.
2. **Stamp every writable record with `createdBy` / `updatedBy` / `updatedAt` from day one**, using a hard-coded constant `OWNER = "dan@superepic.com.au"`. When real auth lands, that constant becomes `session.user.email`. No data migration.

The trigger for deciding now (rather than later) is that we are about to write the `/api/registry` and `/api/append-entry` endpoints. The shape of every record they write will be set in this turn-cycle.

## Decision

**Every writable record in the system carries three server-stamped fields from day one:**

```jsonc
{
  "createdBy": "dan@superepic.com.au",  // lowercase email. PERMANENT after first write.
  "updatedBy": "dan@superepic.com.au",  // lowercase email. Refreshed on every write.
  "updatedAt": 1748263320000             // epoch ms. Refreshed on every write.
}
```

**Scope:** form definitions, registry items (attributes, phrases, metrics, rosters, coaches, forms), and entries in the JSONL log.

**Server-stamped, not client-supplied.** Every write endpoint resolves a `principal` and overwrites whatever the client put in those fields. Today the principal resolver is:

```js
const OWNER = 'dan@superepic.com.au'   // TODO: replace with session.user.email when auth lands
function resolvePrincipal(req) { return OWNER }
```

When real auth lands (Phase 3+), only `resolvePrincipal` changes. No record shape changes. No data migration.

**Email is the identity primitive.** A future `coaches` registry can map `email → coach_id` if we want a decoupled internal id, but the wire-level identifier is always the email.

**`createdBy` is permanent** once a record exists. `updatedBy` and `updatedAt` are refreshed on every write to that record. Entries (which are immutable by separate invariant) will see `updatedBy === createdBy` and `updatedAt === createdAt` forever; we mandate the fields anyway for schema symmetry with mutable records.

## Alternatives considered

- **Omit owner fields, add later with back-fill.** Rejected: back-fill requires inventing owner values for pre-existing records, which is either wrong (best-guess) or impossible (multi-coach environment that lost the audit trail). The cost saved is ~3 lines of code; the cost incurred is unbounded.
- **Optional `createdBy` field (nullable).** Rejected: makes every consumer write defensive `??` fallbacks, and the moment any query depends on owner (analytics, multi-coach filtering, per-coach dashboards) the null branch becomes a bug source. Required-from-day-one is cheaper.
- **Client-supplied `createdBy`.** Rejected: the client can lie, even unintentionally (browser tabs left open after a coach swap, multi-user devices). Server-stamping is the only way the field is trustworthy.
- **Fake-auth via query param or localStorage coach picker.** Rejected: bakes throwaway UI into the codebase, easy to mistake for real auth in a demo, doesn't change the server-side shape.
- **Real auth (Vercel password protection, magic links) now.** Rejected for Phase 1: weeks of work for a one-user environment. The point of ADR-0003 is to make this migration cheap when we *do* invest in it.
- **Separate `coachId` field decoupled from email.** Rejected as primary identifier — adds an indirection layer that solves no current problem. Email is the eventual auth output anyway. A `coaches` registry can hold an internal `coach_id` later as a Phase 2 nicety, but it does not replace the email stamp.

## Consequences

**Positive:**

- Auth migration becomes a one-line change to `resolvePrincipal`. Zero data migration.
- Analytics ("show me everything Coach Dan tagged this month") work from the moment the field exists, even before there's a second coach to compare against.
- Multi-coach environments inherit a clean audit trail from the start.
- Schema symmetry: every writable record has the same provenance fields, regardless of whether it's a registry item, a form definition, or an entry.

**Negative:**

- ~5 extra bytes per record (negligible).
- Every Phase 1 record will be stamped with the same email. Looks redundant. Worth it for the migration cost saved.
- Test data and seed data also carry the stamp. Migration scripts must respect the contract (the seed script will use `OWNER` as the principal).

**Neutral:**

- Phase 1 has no UI surface for "show creator" — the stamp is invisible to coaches until the second coach exists. That's correct: no UI complexity now, full data correctness now.

## Related

- FORM_DESIGNER_CONTRACT.md v1.3 §3.1, §3.2, §5 — record shape and write-endpoint behaviour.
- CONTEXT.md — new term **Owner stamping**.
- Future ADR (when auth lands): "Session principal resolution and multi-tenant scoping" — will reference this ADR as its starting point.
