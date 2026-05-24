// Vercel serverless function — list all uploaded audio clips.
// Used by clip-library.html (your audit page) to render the full library.
//
// Clips are private, so the raw `url` returned by list() isn't browser-fetchable.
// We expose a `streamUrl` that points at /api/stream-clip?path=... — the audit
// page uses that for playback and downloads.

import { list } from '@vercel/blob';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }
  try {
    // List everything under clips/
    const { blobs, hasMore, cursor } = await list({
      prefix: 'clips/',
      limit: 1000,
    });

    // Newest first
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    // Light shape — strip large fields, keep what the UI needs.
    // streamUrl is our same-origin proxy that serves private blob bytes.
    const items = blobs.map(b => ({
      pathname: b.pathname,
      streamUrl: `/api/stream-clip?path=${encodeURIComponent(b.pathname)}`,
      downloadUrl: `/api/stream-clip?path=${encodeURIComponent(b.pathname)}&dl=1`,
      size: b.size,
      uploadedAt: b.uploadedAt,
      contentType: b.contentType,
    }));

    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({ items, count: items.length, hasMore, cursor });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
