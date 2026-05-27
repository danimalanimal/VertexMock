# ADR-0004 — Form lifecycle is one-way; drafts autosave

**Status:** Accepted · **Date:** 2026-05-27 · **Deciders:** Daniel Gordon

## Context

Phase 1 of the form designer ships the authoring surface for the Coach Observation Form contract. Two related decisions need locking before code is written, because both shape the data model (the `status` field, the `publishedAt` / `archivedAt` timestamps, the existence vs. non-existence of an "unpublish" endpoint) and the editor UX (save buttons vs. status indicators, navigate-away confirms vs. silent transitions).

The two questions:

1. **What state transitions does a form support?** Free transitions (Live ⇄ Draft, Archived ⇄ Draft) or one-way only?
2. **When does a draft edit persist?** Explicit save, autosave, or autosave-plus-explicit-publish?

This ADR locks both because they're coupled: if Live forms can be unpublished back to Draft, autosave becomes dangerous (you could autosave-mutate a form that has entries logged against it); if Live forms can't be unpublished, autosave is safe (the only thing being autosaved is a draft, and drafts have no consumers).

## Decision

### Lifecycle: **one-way transitions** Draft → Live → Archived

```
   (new form)
       ↓
   [ DRAFT ]  ──publish──→  [ LIVE ]  ──archive──→  [ ARCHIVED ]
```

- No unpublish (Live → Draft is forbidden).
- No restore (Archived → Draft is forbidden).
- The escape hatch is **Clone as draft**: from any Live or Archived form, the designer can create a new form with a new slug, preserving the original. The original is never mutated.
- Drafts MAY be deleted (with confirmation); they have zero entries by definition and zero downstream consumers.
- Live and Archived forms MAY NOT be deleted.
- `publishedAt` is stamped server-side on Draft → Live and is **permanent**.
- `archivedAt` is stamped server-side on Live → Archived and is **permanent**.

### Save model: **drafts autosave, transitions are explicit**

- Field-change → mark form dirty in local state → debounce 800ms → full-collection `PUT /api/registry` for `name=forms`.
- Status indicator: `Saved ✓ HH:MM` / `Saving…` / `Unsaved changes` / `Save failed · Retry`.
- State transitions (publish, archive, clone-as-draft, delete-draft) are explicit user actions, never triggered by edits.
- Live and Archived forms are read-only in the editor; the only edit affordance on them is **Clone as draft**.

### URL grammar

The designer uses hash-based routing:

```
form-designer.html              → no selection
form-designer.html#new          → creating a new draft
form-designer.html#draft/<slug> → editing a draft
form-designer.html#live/<slug>  → viewing a live form (read-only, clone-to-edit)
form-designer.html#archived/<slug> → viewing an archived form (read-only, clone-to-edit)
```

The status segment is a hint, not the source of truth. On resolve, the designer reads the form's `status` field and rewrites the URL if it mismatches.

### No undo stack in Phase 1

Phase 1 ships without Cmd+Z. If a coach makes an edit they regret, the practical recourse is to redo the edit. We can add an undo stack in a later phase if the absence bites.

## Alternatives considered

### Lifecycle

- **Free transitions** (Live → Draft via unpublish, Archived → Draft via restore). **Rejected:** unpublishing a Live form orphans the entries that reference it; restoring an archived form loses the context that justified archiving. One-way + clone-to-edit is more honest and matches versioning intuition.
- **Two states (Active / Archived)** with no Draft. **Rejected:** no way to work-in-progress a form. The Draft state is the safe sandbox where mistakes don't cost.
- **Allow deleting Live or Archived forms.** **Rejected:** entries reference forms by slug; deleting a referenced form breaks analytics. Soft-archive is the right semantic.

### Save model

- **Explicit save button** with confirm-on-navigate for unsaved changes. **Rejected:** the cognitive tax (remembering to click Save) and the failure mode (forgetting and losing 20 minutes of work) are both worse than autosave's invisible-ness.
- **Plain autosave** with no separate publish action. **Rejected:** conflates "saved" with "published." A draft on disk is not the same as a live form; coaches need a deliberate action to make a form go live.
- **Autosave only after first publish** (drafts require explicit save). **Rejected:** worst of both worlds — the safe state (draft) is unsafe, the unsafe state (live) is silently mutating.
- **Per-field saves** (each field PUTs on blur). **Rejected:** N times the network volume, no perceptible UX gain over 800ms debounce.

### URL grammar

- **History API routing** (`form-designer.html/draft/<slug>`). **Rejected:** requires `vercel.json` rewrites for sub-paths. Hash routing achieves the same outcome with zero config and matches the repo's flat-HTML convention.
- **No URL state** (selection lives only in JS memory). **Rejected:** loses shareable URLs, browser back/forward, and reload-restores-state — three real UX wins for ~20 lines of `hashchange` handler.

### Undo stack

- **Per-session undo stack** with Cmd+Z. **Deferred:** real complexity (every field's prior values, every list reorder, every metric-input add/remove all needing to round-trip the stack). Phase 1 has bigger fish to fry.

## Consequences

**Positive:**

- The Live form's data is sacred: nothing the designer does can mutate it. Coaches build confidence in the system.
- The Clone-as-draft pattern naturally surfaces Phase 4 versioning — when versioning lands, "clone" becomes "new version" with the same UX.
- Autosave eliminates the lost-work failure mode entirely for the most common case (draft authoring).
- Status indicator gives constant feedback; coaches always know whether their work is durable.

**Negative:**

- A coach who publishes a form too early has to clone-and-rewrite rather than edit-and-republish. This is the right friction — premature publish should hurt a little, so coaches learn to use the Draft state.
- Autosave + full-collection PUT means every debounce fire rewrites the entire `forms.json` blob. At 5-20 forms total this is a few KB per write, trivial. Revisit if it ever crosses ~500KB.
- No undo means edit mistakes have to be manually reverted. Mitigated by autosave granularity (each debounce is small) and the discipline of working in drafts.

**Neutral:**

- The URL grammar baked in here is one of those decisions that's hard to change later (bookmarks, shared links). Locking it now in an ADR is the right move.

## Related

- FORM_DESIGNER_CONTRACT.md v1.4 §2.4 (form record shape, lifecycle rules) and §5 (save model, URL grammar).
- ADR-0003 — Owner stamping (the `createdBy`/`updatedBy`/`updatedAt` that autosave depends on).
- Future ADR (Phase 4): "Form versioning and immutable version snapshots" — will build on the one-way transition discipline locked here.
