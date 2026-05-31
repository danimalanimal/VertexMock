// Vercel serverless function — registry read/write.
//
// Contract: FORM_DESIGNER_CONTRACT.md v1.4 §5
// Related ADRs: ADR-0003 (owner stamping), ADR-0005 (server-side id minting)
//
// GET  /api/registry?name=forms|attributes|phrases|metrics|rosters|coaches|sports
//      Returns the registry's full JSON. 404 if not yet created; the client
//      treats 404 as "empty registry, will be created on first PUT."
//
// PUT  /api/registry  body: { name, data }
//      Full-overwrite write. Server stamps:
//        - id            for items with id == null/missing (ADR-0005)
//        - createdBy/At  only if missing (ADR-0003)
//        - updatedBy/At  always overwritten
//      Response includes the canonical data.items[] so the client can adopt
//      newly minted ids.
//
// Auth: none in v1 (internal tool, single writer). Owner is hard-coded.
// When real auth lands, replace resolvePrincipal() — no data migration needed.

import { put, head, get } from '@vercel/blob';

// ─── Owner stamping (ADR-0003) ───────────────────────────────────────────────
// TODO: replace with session.user.email when real auth lands.
const OWNER = 'dan@superepic.com.au';
function resolvePrincipal(_req) {
  return OWNER;
}

// ─── Allowed registry names ──────────────────────────────────────────────────
const REGISTRIES = new Set([
  'forms',
  'attributes',
  'phrases',
  'metrics',
  'rosters',
  'coaches',
  'sports',
]);

function blobPath(name) {
  return `registries/${name}.json`;
}

// ─── Id-mint prefixes (ADR-0005) ─────────────────────────────────────────────
// Registries whose items get server-minted ids in the format <prefix>_<YYYY>_<6 digits>.
// Registries absent from this map have author-chosen ids (forms = slug, attributes = key,
// metrics = key, rosters = id, coaches = id, sports = enum value).
const ID_PREFIXES = {
  phrases: 'p',
  // Future: athletes: 'a', entries: 'e' (entries mint server-side at runtime, different path).
};

// ─── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'PUT') return await handlePut(req, res);
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[/api/registry]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

// ─── GET: read whole registry ────────────────────────────────────────────────
async function handleGet(req, res) {
  const name = String(req.query.name || '').trim();
  if (!REGISTRIES.has(name)) {
    return res.status(400).json({
      error: `Unknown registry: ${name || '(missing)'}. Allowed: ${[...REGISTRIES].join(', ')}`,
    });
  }

  const path = blobPath(name);

  // Private blob: use get() (returns the body bytes) rather than fetching the URL.
  // Private blob URLs require a signed token per read; get() handles that internally.
  let body;
  let meta;
  try {
    meta = await head(path);
    const result = await get(path, { access: 'private' });
    if (!result || result.statusCode === 404) {
      return res.status(404).json({ error: 'Registry not found', name });
    }
    // result.stream is a web ReadableStream; convert to text via a Response wrapper.
    const text = await new Response(result.stream).text();
    body = JSON.parse(text);
  } catch (e) {
    // Vercel Blob signals a missing object via 'does not exist' / 'not found' / BlobNotFoundError
    const msg = e?.message || '';
    const cls = e?.constructor?.name || e?.name || '';
    if (
      /BlobNotFoundError/.test(cls) ||
      /does not exist/i.test(msg) ||
      /not.?found/i.test(msg) ||
      e?.status === 404
    ) {
      return res.status(404).json({ error: 'Registry not found', name });
    }
    throw e;
  }

  return res.status(200).json({
    name,
    data: body,
    meta: { updatedAt: meta?.uploadedAt, size: meta?.size },
  });
}

// ─── PUT: full overwrite with owner stamping ─────────────────────────────────
async function handlePut(req, res) {
  // Parse body (Vercel functions parse JSON automatically if Content-Type is set;
  // fall back to manual read for safety.)
  let body = req.body;
  if (!body || typeof body !== 'object') {
    body = await readJson(req);
  }
  const { name, data } = body || {};

  if (!REGISTRIES.has(name)) {
    return res.status(400).json({
      error: `Unknown registry: ${name || '(missing)'}. Allowed: ${[...REGISTRIES].join(', ')}`,
    });
  }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Body must include { name, data }' });
  }

  const principal = resolvePrincipal(req);
  const nowIso = new Date().toISOString();
  const currentYear = new Date().getUTCFullYear();
  const idPrefix = ID_PREFIXES[name] || null;

  // Stamp every item in data.items[] (server-side; client values are overwritten).
  // Mints ids for items with id == null/missing when the registry has an id prefix.
  const stamped = stampItems(data, principal, nowIso, idPrefix, currentYear);

  // Write to blob. Store is configured private-access, so put() must declare it.
  // GET handler reads via the URL returned by head() (signed when private).
  const path = blobPath(name);
  const result = await put(path, JSON.stringify(stamped, null, 2), {
    access: 'private',
    contentType: 'application/json; charset=utf-8',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });

  // Response includes the canonical data so the client can adopt minted ids (ADR-0005 §3).
  return res.status(200).json({
    name,
    ok: true,
    meta: {
      updatedAt: nowIso,
      principal,
      url: result.url,
      size: result.size,
    },
    data: stamped,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Stamp createdBy/updatedBy/updatedAt on each item in data.items[].
// - createdBy is set only if missing (PERMANENT).
// - updatedBy is always set (overwrites client value).
// - updatedAt is always set (overwrites client value).
// - createdAt is set only if missing (PERMANENT).
// - id is minted only if missing AND the registry has an idPrefix (ADR-0005).
//   Items with an existing id keep it (id is permanent).
// Non-item containers (registries that aren't arrays) just get top-level stamps.
function stampItems(data, principal, nowIso, idPrefix, currentYear) {
  const out = { ...data };

  // Top-level stamps for the registry as a whole
  out.updatedAt = nowIso;
  out.updatedBy = principal;

  if (Array.isArray(out.items)) {
    // First pass: compute the current max suffix for this year, so multiple new
    // items in the same PUT mint sequentially without collision.
    let counter = idPrefix ? maxSuffixForYear(out.items, idPrefix, currentYear) : 0;

    out.items = out.items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const next = { ...item };

      // Mint id if missing (only for registries with an id prefix).
      if (idPrefix && (next.id == null || next.id === '')) {
        counter += 1;
        next.id = formatId(idPrefix, currentYear, counter);
      }

      if (!next.createdAt) next.createdAt = nowIso;
      if (!next.createdBy) next.createdBy = principal;
      next.updatedAt = nowIso;
      next.updatedBy = principal;
      return next;
    });
  }

  return out;
}

// ─── Id minting (ADR-0005) ───────────────────────────────────────────────────
// Scans items[] for ids matching `<prefix>_<year>_NNNNNN`, returns the max
// numeric suffix found (0 if none).
function maxSuffixForYear(items, prefix, year) {
  const re = new RegExp('^' + prefix + '_' + year + '_(\\d{6})$');
  let max = 0;
  for (const item of items) {
    if (!item || typeof item.id !== 'string') continue;
    const m = item.id.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

function formatId(prefix, year, counter) {
  return `${prefix}_${year}_${String(counter).padStart(6, '0')}`;
}

// Manual JSON body reader (fallback when Vercel didn't auto-parse).
async function readJson(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (chunk) => (buf += chunk));
    req.on('end', () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}
