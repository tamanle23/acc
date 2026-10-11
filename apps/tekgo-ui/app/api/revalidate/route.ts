import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import crypto from 'crypto'

/**
 * Edge Cache Invalidation Endpoint for tekgo-ui.
 * Receives HMAC-SHA256 signed webhook notifications from backend when an article or record changes.
 *
 * Security Requirements:
 * 1. Timestamp replay protection: rejects payloads older than 300 seconds.
 * 2. Cryptographic HMAC validation: signature matches HMAC-SHA256(secret, timestamp + "." + body).
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-unipost-signature')
  const timestamp = req.headers.get('x-unipost-timestamp')
  const secret = process.env.UNIPOST_WEBHOOK_SECRET || 'unipost-webhook-secret-token'

  // 1. Prevent Replay Attacks (Reject requests older than 300 seconds)
  const currentTime = Math.floor(Date.now() / 1000)
  if (!timestamp || Math.abs(currentTime - parseInt(timestamp, 10)) > 300) {
    return NextResponse.json({ error: 'Replay window expired' }, { status: 401 })
  }

  // 2. Cryptographic Signature Validation
  const rawBody = await req.text()
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  if (signature !== expectedSig) {
    return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 })
  }

  try {
    const payload = JSON.parse(rawBody)
    const { slug, tag } = payload

    if (slug) {
      revalidatePath(`/blog/${slug}`)
    }
    if (tag) {
      revalidateTag(tag)
    }
    // Revalidate blog index and root
    revalidatePath('/blog')
    revalidatePath('/')

    return NextResponse.json({
      revalidated: true,
      timestamp: Date.now(),
      target: { slug, tag },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 })
  }
}
