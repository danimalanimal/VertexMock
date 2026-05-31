#!/usr/bin/env node
// scripts/seed-phrases.js
//
// One-time migration: convert phrases embedded in coach-data.js (basketball) and
// boxing-data.js into the phrases.json registry. Mint ids server-side via PUT.
//
// Usage:
//   BASE_URL=https://vertexss.vercel.app node scripts/seed-phrases.js
//   BASE_URL=http://localhost:3000        node scripts/seed-phrases.js   (local dev)
//
// Safe to re-run only if phrases.json is empty. If items already exist this script
// will refuse to proceed (we don't want to duplicate-mint over an authored library).
//
// Per the Phase 2 grill decisions:
//   - No dedup logic (zero overlap confirmed in source data).
//   - One sport tag per phrase, derived from source file.
//   - Server mints ids on PUT (ADR-0005).
//   - Owner-stamped server-side (ADR-0003).

const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://vertexss.vercel.app';
const ENDPOINT = `${BASE_URL}/api/registry`;

// Browser globals shim — coach-data.js and boxing-data.js attach to `window`.
global.window = {};
require(path.resolve(__dirname, '..', 'coach-data.js'));
require(path.resolve(__dirname, '..', 'boxing-data.js'));

const coachData = global.window.VertexCoachData;
const boxingData = global.window.VertexBoxingData;

if (!coachData || !boxingData) {
  console.error('FATAL: source data not loaded. coach-data.js / boxing-data.js missing exports?');
  process.exit(1);
}

// ─── Build phrase records ──────────────────────────────────────────────────────
function buildPhrases(sourceData, sport) {
  const out = [];
  const phrases = sourceData.phrases || {};
  for (const attribute of Object.keys(phrases)) {
    const sentiments = phrases[attribute];
    for (const sentiment of Object.keys(sentiments)) {
      const texts = sentiments[sentiment];
      if (!Array.isArray(texts)) continue;
      for (const text of texts) {
        if (typeof text !== 'string' || !text.trim()) continue;
        out.push({
          // id intentionally omitted — server mints (ADR-0005)
          text: text.trim(),
          attribute,
          sentiment,
          sports: [sport],
          status: 'active',
          // createdBy / createdAt / updatedBy / updatedAt stamped server-side (ADR-0003)
        });
      }
    }
  }
  return out;
}

const basketballPhrases = buildPhrases(coachData, 'basketball');
const boxingPhrases = buildPhrases(boxingData, 'boxing');
const allPhrases = [...basketballPhrases, ...boxingPhrases];

console.log(`Built ${basketballPhrases.length} basketball + ${boxingPhrases.length} boxing = ${allPhrases.length} phrases.`);

// ─── Pre-flight: refuse if registry already has items ─────────────────────────
async function main() {
  // Use fetch (node 18+).
  if (typeof fetch !== 'function') {
    console.error('FATAL: this script requires Node 18+ (global fetch).');
    process.exit(1);
  }

  console.log(`\nChecking ${ENDPOINT}?name=phrases ...`);
  const getResp = await fetch(`${ENDPOINT}?name=phrases`);

  if (getResp.ok) {
    const body = await getResp.json();
    const itemCount = body?.data?.items?.length ?? 0;
    if (itemCount > 0) {
      console.error(`\nREFUSING TO SEED: phrases.json already contains ${itemCount} items.`);
      console.error('This script is one-shot. If you genuinely want to re-seed, manually clear');
      console.error('the blob first via /api/registry PUT with { name: "phrases", data: { items: [] } }.');
      process.exit(1);
    }
    console.log('Registry exists but is empty — proceeding.');
  } else if (getResp.status === 404) {
    console.log('Registry does not exist yet — proceeding (will be created on PUT).');
  } else {
    const errText = await getResp.text();
    console.error(`FATAL: unexpected GET response ${getResp.status}: ${errText}`);
    process.exit(1);
  }

  // ─── PUT the full collection ─────────────────────────────────────────────────
  const payload = {
    name: 'phrases',
    data: {
      version: 1,
      items: allPhrases,
    },
  };

  console.log(`\nPUTting ${allPhrases.length} phrases to ${ENDPOINT} ...`);
  const putResp = await fetch(ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!putResp.ok) {
    const errText = await putResp.text();
    console.error(`FATAL: PUT failed ${putResp.status}: ${errText}`);
    process.exit(1);
  }

  const result = await putResp.json();
  const minted = result?.data?.items ?? [];
  console.log(`\n✓ Seed complete. ${minted.length} phrases written.`);
  if (minted.length) {
    console.log(`  First minted id: ${minted[0].id}`);
    console.log(`  Last minted id:  ${minted[minted.length - 1].id}`);
    console.log(`  Owner stamped:   ${minted[0].createdBy}`);
    console.log(`  Blob url:        ${result?.meta?.url}`);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
