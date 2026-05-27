// Vercel serverless function — registry read/write.
//
// Contract: FORM_DESIGNER_CONTRACT.md v1.4 §5
//
// GET  /api/registry?name=forms|attributes|phrases|metrics|rosters|coaches|sports
//      Returns the registry's full JSON. 404 if not yet created; the client
//      treats 404 as "empty registry, will be created on first PUT."
//
// PUT  /api/registry  body: { name, data }
//      Full-overwrite write. Server stamps createdBy/updatedBy/updatedAt on
//      every item in data.items (ADR-0003 owner stamping).
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
    const fetched = await get(path);
    body = JSON.parse(await fetched.text());
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
  const nowMs = Date.now();

  // Stamp every item in data.items[] (server-side; client values are overwritten).
  const stamped = stampItems(data, principal, nowIso, nowMs);

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

  return res.status(200).json({
    name,
    ok: true,
    meta: {
      updatedAt: nowIso,
      principal,
      url: result.url,
      size: result.size,
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Stamp createdBy/updatedBy/updatedAt on each item in data.items[].
// - createdBy is set only if missing (PERMANENT).
// - updatedBy is always set (overwrites client value).
// - updatedAt is always set (overwrites client value).
// - createdAt is set only if missing (PERMANENT).
// Non-item containers (registries that aren't arrays) just get top-level stamps.
function stampItems(data, principal, nowIso, _nowMs) {
  const out = { ...data };

  // Top-level stamps for the registry as a whole
  out.updatedAt = nowIso;
  out.updatedBy = principal;

  if (Array.isArray(out.items)) {
    out.items = out.items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const next = { ...item };
      if (!next.createdAt) next.createdAt = nowIso;
      if (!next.createdBy) next.createdBy = principal;
      next.updatedAt = nowIso;
      next.updatedBy = principal;
      return next;
    });
  }

  return out;
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
