// Vercel serverless function — stream a private audio clip to the browser.
//
// Why this exists: clips are stored with access:'private', which means the URL
// returned by list() lives on private.blob.vercel-storage.com and can only be
// fetched with the BLOB_READ_WRITE_TOKEN (server-side). The browser can't read
// the token, so we proxy: client requests /api/stream-clip?path=clips/foo.wav,
// we fetch via the SDK using the token, then pipe bytes back as audio/wav.
//
// This is fine for an audit page where you're listening to one clip at a time.
// If we ever hit scale (1000s of clips streamed concurrently), we'd switch to
// short-lived signed URLs, but private Blob doesn't expose that primitive yet
// as of the SDK version we're on — server proxy is the documented pattern.

import { head } from '@vercel/blob';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vercel populates request.query for ?path=... query strings.
    const pathname = (request.query.path || '').toString();

    // Allowlist: never let callers fetch anything outside clips/
    if (!pathname || !pathname.startsWith('clips/') || pathname.includes('..')) {
      return response.status(400).json({ error: 'Invalid path' });
    }

    // head() returns metadata including the internal URL. For private blobs the
    // URL on .private.blob.vercel-storage.com is only fetchable with the token,
    // so we re-fetch it server-side and pipe the body back.
    const meta = await head(pathname);
    if (!meta || !meta.url) {
      return response.status(404).json({ error: 'Not found' });
    }

    const upstream = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!upstream.ok) {
      return response.status(upstream.status).json({ error: 'Upstream fetch failed' });
    }

    // Pipe headers we care about, then the body
    response.setHeader('Content-Type', meta.contentType || 'audio/wav');
    response.setHeader('Content-Length', meta.size || '');
    response.setHeader('Cache-Control', 'private, max-age=300'); // 5 min browser cache OK
    response.setHeader('Accept-Ranges', 'bytes');

    // ?dl=1 forces download with a clean filename derived from the pathname
    if (request.query.dl) {
      const filename = pathname.split('/').pop() || 'clip.wav';
      response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    // Vercel's node runtime supports response.send(Buffer)
    const arrayBuffer = await upstream.arrayBuffer();
    return response.status(200).send(Buffer.from(arrayBuffer));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('stream-clip error', err);
    return response.status(500).json({ error: err.message || 'stream failed' });
  }
}
