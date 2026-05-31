# ADR-0005 — Server-side id minting for registry items

**Status:** Accepted · **Date:** 2026-06-01 · **Deciders:** Daniel Gordon

## Context

Phase 2 introduces the phrase library — the first registry where authors create new items through the UI (Phase 1 forms also mint a slug, but the user types it; phrase ids are mechanical). The contract specifies `p_<YYYY>_<6-digit counter>` for phrase ids (§3.4) and parallel patterns will follow for any future server-minted identifiers.

Four questions need locking before any client code is written, because they shape both the API contract and how the client manages local state during autosave round-trips:

1. **Who mints new item ids — client, server, or a separate ledger blob?**
2. **How does the client signal "this item is new" in a full-collection PUT?**
3. **What does the PUT response look like so the client can adopt the minted ids?**
4. **What happens to ids of archived/deleted items?**

These are coupled: a client-side minter has to scan the registry on every insert and risks two clients colliding on the same counter; a separate counter blob doubles the writes and creates a two-blob transaction problem Vercel Blob can't satisfy; a separate POST endpoint creates an "id reserved but row never saved" orphan window.

This ADR establishes the **registry-wide** rule. It applies to phrases now and to any future registry that needs server-minted ids (e.g. minted athlete ids, minted entry ids when the runtime ships).

## Decision

### 1. Ids are minted server-side, inside the existing PUT handler

`/api/registry` PUT is already a full-collection read-modify-write. The id-mint runs in the same critical section as owner stamping (ADR-0003):

```
for (item of data.items):
  if (!item.id):
    item.id = mintNextId(data.items, currentYear, prefix)
    item.createdAt = now
    item.createdBy = principal
  item.updatedAt = now
  item.updatedBy = principal
```

`mintNextId` scans `data.items` for ids matching `<prefix>_<currentYear>_NNNNNN`, takes the maximum numeric suffix, returns `+1` formatted to 6 digits. Multiple new items in a single PUT mint sequentially in array-position order.

No separate mint endpoint. No separate counter blob. The registry blob itself is the source of truth for the counter — `max(suffix) + 1` is always derivable from the data.

### 2. The client signals "new item" with `id: null` (or omitted `id`)

Mirrors the existing owner-stamping pattern. Client-supplied id values for items lacking an id-shaped match are silently overwritten — same discipline as `createdBy` / `updatedBy` / `updatedAt`. The anti-patterns list in CONTEXT.md gains a parallel entry.

This keeps the PUT body shape identical to today (`{name, data}`); only the *content* of items differs.

### 3. The PUT response grows to return the canonical `data.items[]`

Today's response: `{name, ok, meta}`. New shape:

```jsonc
{
  "name": "phrases",
  "ok": true,
  "meta": { "updatedAt", "principal", "url", "size" },
  "data": { "version", "items": [...], "updatedAt", "updatedBy" }
}
```

The client replaces its local items array with `response.data.items`. This is the only safe way to adopt minted ids without round-trip drift — and it's idempotent on subsequent saves where no minting occurs.

This is **not** a contract bump. The API response shape isn't in the contract; only the on-disk JSON shape is. Backwards-compatible: clients ignoring the `data` field still work.

### 4. Ids are permanent. Archive does not reclaim the number.

Counter advances monotonically across the year. Archiving `p_2026_000050` leaves the number assigned to the archived record forever (Option 1 immutability — id is permanent regardless of status). Year rollover starts a fresh sequence at `p_2027_000001`.

### 5. The rule generalises to future registries

Any future registry needing server-minted ids reuses `mintNextId(items, year, prefix)`. The prefix and width are registry-specific (defined in the contract); the algorithm and ownership model are identical.

## Alternatives considered

- **Client-side minter (scan + max + 1).** Rejected: requires every client to read the full registry before inserting; two clients minting milliseconds apart can produce identical ids and the last-write-wins blob model would silently lose one of them. The race is invisible until you look at the data.

- **Separate POST mint endpoint** (`POST /api/registry/phrases/mint-id`). Rejected: creates an orphan window — id reserved server-side, row never saved client-side, counter advanced past actual data. Also doubles the round-trips for every insert.

- **Separate counter blob** (`phrase-counter.json`). Rejected: two blobs need coordinated writes. Vercel Blob has no transactions. Any partial failure leaves counter and data out of sync.

- **Client-side temp ids** (`tmp_xyz123` → server rewrites). Rejected: forces the client to maintain a `tmpId → realId` map during autosave round-trips. With 800ms debounce and potentially many new items per save cycle, the bookkeeping is bug-prone for zero user-visible benefit. The temp id is never seen by anyone.

## Consequences

**Positive:**

- Single source of truth for the counter: the registry data itself.
- Same code path as owner stamping. One function handles both concerns; the principal already resolves there.
- No new endpoint surface. Existing `/api/registry` GET + PUT covers everything.
- Concurrency story is the same as every other field: last-write-wins on the blob. No worse, no better.
- Pattern is reusable for any future minted id (athletes, entries, future registries).

**Negative / accepted tradeoffs:**

- The PUT response is larger (full items array instead of just metadata). Acceptable: registries are small JSON (thousands of phrases ≈ a few hundred KB), and this only matters on save, not on read.
- Last-write-wins means two simultaneous coach sessions creating phrases in parallel could lose one of the new items. This is the same risk as editing any other field today and isn't unique to id minting. Mitigation deferred to whenever multi-writer becomes a real scenario (post-auth).
- A subtle ordering coupling: the client must preserve array order in its local state when adopting `response.data.items`, because that's the order in which the server assigned ids. Documented as a client-side rule; trivially satisfied by `items = response.data.items`.

## Out of scope

- Multi-writer conflict resolution (deferred to post-auth).
- Server-side validation that client-supplied ids on *existing* items haven't been swapped (rely on the immutability discipline + Option 1 rules to catch this elsewhere).
- Counter persistence across registry-blob deletion (if the registry blob is deleted, the counter "resets" — operationally we don't expect this to happen; if it does, the seed script can be re-run with explicit starting ids).
