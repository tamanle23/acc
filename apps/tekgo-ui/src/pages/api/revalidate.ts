import type { APIRoute } from 'astro';

export const prerender = false;

async function verifyHmac(secret: string, data: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const hexSig = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hexSig.toLowerCase() === signature.toLowerCase();
}

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get('x-acc-signature');
  const timestamp = request.headers.get('x-acc-timestamp');
  const secret = process.env.UNIPOST_WEBHOOK_SECRET || 'acc-webhook-secret-token';

  // 1. Prevent Replay Attacks (Reject requests older than 300 seconds)
  const currentTime = Math.floor(Date.now() / 1000);
  if (!timestamp || Math.abs(currentTime - parseInt(timestamp, 10)) > 300) {
    return new Response(JSON.stringify({ error: 'Replay window expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Cryptographic Signature Validation via WinterTC Web Crypto
  const rawBody = await request.text();
  const isValid = await verifyHmac(secret, `${timestamp}.${rawBody}`, signature || '');
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Invalid HMAC signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = JSON.parse(rawBody);
    const { slug, tag } = payload;
    const traceparent = request.headers.get('traceparent');

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (traceparent) {
      responseHeaders['traceparent'] = traceparent;
    }

    return new Response(
      JSON.stringify({
        revalidated: true,
        timestamp: Date.now(),
        target: { slug, tag },
        traceparent: traceparent || undefined,
      }),
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Malformed JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

