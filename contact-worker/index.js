import { EmailMessage } from 'cloudflare:email'
import { createMimeMessage } from 'mimetext'

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || 'https://sgyt-portfolio.pages.dev'
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders)

    let body
    try { body = await request.json() } catch { return json({ error: 'Invalid JSON' }, 400, corsHeaders) }

    const { name, email, subject, message, budget } = body

    if (!name?.trim() || !email?.trim() || !message?.trim())
      return json({ error: 'name, email, and message are required' }, 400, corsHeaders)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ error: 'Invalid email address' }, 400, corsHeaders)
    if (message.trim().length < 10)
      return json({ error: 'Message must be at least 10 characters' }, 400, corsHeaders)

    const budgetLine = budget ? `Budget: ${budget}\n` : ''
    const textBody = `New contact form submission\n\nName: ${name.trim()}\nEmail: ${email.trim()}\nSubject: ${subject?.trim() || '(none)'}\n${budgetLine}\n--- Message ---\n${message.trim()}`

    try {
      const msg = createMimeMessage()
      msg.setSender({ name: 'SGYT Portfolio', addr: 'noreply@slayergamer.eu.org' })
      msg.setRecipient({ addr: env.TO_EMAIL })
      msg.setSubject(`[Portfolio] ${subject?.trim() || 'New Contact Message'}`)
      msg.addMessage({ contentType: 'text/plain', data: textBody })

      const emailMsg = new EmailMessage('noreply@slayergamer.eu.org', env.TO_EMAIL, msg.asRaw())
      await env.SEND_EMAIL.send(emailMsg)
    } catch (err) {
      console.error('Email send error:', err)
      return json({ error: 'Failed to send email. Please try again later.' }, 502, corsHeaders)
    }

    if (env.DISCORD_WEBHOOK) {
      fetch(env.DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{ title: `📬 New Contact: ${name.trim()}`, description: `**${subject?.trim() || 'No subject'}**\n${message.trim().slice(0, 500)}`, color: 0x00e676, fields: [{ name: 'Email', value: email.trim(), inline: true }, { name: 'Budget', value: budget || 'Not specified', inline: true }], timestamp: new Date().toISOString() }],
        }),
      }).catch(() => {})
    }

    return json({ success: true, message: 'Message sent!' }, 201, corsHeaders)
  },
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...extraHeaders } })
}
