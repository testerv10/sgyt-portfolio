/**
 * SGYT Contact Worker
 * Sends email via MailChannels (free, no credit card required)
 * and fires an optional Discord webhook notification.
 *
 * Setup:
 *   1. cd contact-worker
 *   2. wrangler secret put TO_EMAIL        → your inbox (e.g. admin@slayergamer.eu.org)
 *   3. wrangler secret put FROM_EMAIL      → verified sender (e.g. noreply@slayergamer.eu.org)
 *   4. wrangler secret put DISCORD_WEBHOOK → (optional) Discord webhook URL
 *   5. wrangler secret put ALLOWED_ORIGIN  → https://slayergamer.eu.org
 *   6. wrangler deploy
 *
 * MailChannels requires a DNS TXT record on your domain to authorise sending:
 *   Name:  _mailchannels.slayergamer.eu.org
 *   Type:  TXT
 *   Value: v=mc1 cfid=YOUR_ACCOUNT_TAG.cloudflareaccess.com
 * (Get YOUR_ACCOUNT_TAG from Cloudflare Dashboard → Workers → Account details)
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const allowedOrigin = env.ALLOWED_ORIGIN || 'https://slayergamer.eu.org'

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse body
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400, corsHeaders)
    }

    const { name, email, subject, message, budget } = body

    // Validate
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return json({ error: 'name, email, and message are required' }, 400, corsHeaders)
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Invalid email address' }, 400, corsHeaders)
    }
    if (message.trim().length < 10) {
      return json({ error: 'Message must be at least 10 characters' }, 400, corsHeaders)
    }

    const toEmail = env.TO_EMAIL
    const fromEmail = env.FROM_EMAIL || `noreply@slayergamer.eu.org`

    if (!toEmail) {
      return json({ error: 'Server misconfiguration: TO_EMAIL not set' }, 500, corsHeaders)
    }

    // Build email body
    const budgetLine = budget ? `\nBudget: ${budget}` : ''
    const emailBody = [
      `New contact form submission from SGYT Portfolio`,
      ``,
      `Name:    ${name.trim()}`,
      `Email:   ${email.trim()}`,
      `Subject: ${subject?.trim() || '(none)'}`,
      budgetLine,
      ``,
      `--- Message ---`,
      message.trim(),
    ].filter(line => line !== null).join('\n')

    // Send via MailChannels
    const mailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: fromEmail, name: 'SGYT Portfolio' },
        reply_to: { email: email.trim(), name: name.trim() },
        subject: `[Portfolio] ${subject?.trim() || 'New Contact Message'}`,
        content: [{ type: 'text/plain', value: emailBody }],
      }),
    })

    if (!mailResponse.ok && mailResponse.status !== 202) {
      const errText = await mailResponse.text().catch(() => '')
      console.error('MailChannels error:', mailResponse.status, errText)
      return json({ error: 'Failed to send email. Please try again later.' }, 502, corsHeaders)
    }

    // Discord notification (optional, fire-and-forget)
    if (env.DISCORD_WEBHOOK) {
      fetch(env.DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `📬 New Contact: ${name.trim()}`,
            description: `**${subject?.trim() || 'No subject'}**\n${message.trim().slice(0, 500)}`,
            color: 0x00e676,
            fields: [
              { name: 'Email', value: email.trim(), inline: true },
              { name: 'Budget', value: budget || 'Not specified', inline: true },
            ],
            timestamp: new Date().toISOString(),
          }],
        }),
      }).catch(() => {}) // non-blocking
    }

    return json({ success: true, message: 'Message sent!' }, 201, corsHeaders)
  },
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}
