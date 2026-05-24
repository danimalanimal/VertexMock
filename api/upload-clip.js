// Vercel serverless function — handles client-direct upload to Vercel Blob.
// Pattern: client POSTs a "request signed URL" payload, we return a one-time signed
// upload URL that the browser uses to PUT the audio file directly to Blob storage.
//
// Why client-direct: serverless functions have a 4.5MB request body cap on the Hobby
// plan. Audio clips can hit 200-800KB, which is within limits, but client-direct is
// also faster (no double-hop) and the same code path handles big files for free.
//
// On Vercel Hobby plan with default Blob settings, uploads are public-read by default
// (we set access:'public'). That's fine — these are anonymized audio clips, no PII.

import { handleUpload } from '@vercel/blob/client';

const VALID_LABELS = new Set([
  'clean-rip-land',     // CMJ: tape rip then landing thud
  'clean-drop-triple',  // Drop Jump: drop thud → scuff → landing thud
  'clean-drop-double',  // Drop Jump: only 2 audible impacts (scuff missed)
  'false-positive',     // Something that looked like an impact but wasn't a jump
  'voice',              // Coach or bystander speech
  'clap',               // Hand clap
  'bag-drop',           // Equipment drop, ball bounce, etc.
  'soft-landing',       // Real jump but landing was too quiet to detect cleanly
  'partial-rip',        // Only half the tape came off
  'shoe-squeak',        // Pivot/squeak noise on hardwood
  'doorslam-noise',     // Background interference (doors, weights clanking)
  'silence',            // Silent reference clip
  'other',              // Anything else — coach must add a note
]);

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }
  // Vercel exposes request.body parsed by default for JSON.
  const body = request.body;
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // pathname e.g. 'clips/coach-jane/2026-05-24T12-03-04Z__clean-rip-land__h12-s48.wav'
        // clientPayload — JSON string we sent from the browser
        let meta = {};
        try { meta = clientPayload ? JSON.parse(clientPayload) : {}; } catch (_) {}

        // Light validation
        const label = (meta.label || '').toString();
        if (!VALID_LABELS.has(label)) {
          throw new Error(`Invalid label: ${label}`);
        }
        if (!pathname.startsWith('clips/')) {
          throw new Error('Path must start with clips/');
        }
        if (!/\.wav$/i.test(pathname)) {
          throw new Error('Only .wav files accepted');
        }

        return {
          allowedContentTypes: ['audio/wav', 'audio/wave', 'audio/x-wav'],
          // 30 MB max — single clip should be ~200KB, but allow headroom
          maximumSizeInBytes: 30 * 1024 * 1024,
          // Metadata persisted with the blob, returned by list/get
          tokenPayload: JSON.stringify({
            label,
            coach: (meta.coach || 'anonymous').toString().slice(0, 64),
            device: (meta.device || '').toString().slice(0, 200),
            sampleRate: meta.sampleRate || null,
            duration: meta.duration || null,
            note: (meta.note || '').toString().slice(0, 500),
            uploadedAt: new Date().toISOString(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Called by Vercel after the client's PUT completes successfully.
        // We could log to a DB here, but for now the blob list IS our database.
        // eslint-disable-next-line no-console
        console.log('Clip uploaded:', blob.pathname, blob.size, 'bytes');
      },
    });
    return response.status(200).json(jsonResponse);
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }
}
