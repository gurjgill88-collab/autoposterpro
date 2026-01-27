// api/email/send.js
import { kv } from '../../lib/redis.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, subject, body } = req.body;

  if (!to || !subject) {
    return res.status(400).json({ error: 'To and subject required' });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'AutoPosterPro <noreply@autoposterpro.com>',
      to: [to],
      subject: subject,
      html: body || '<p>No content</p>'
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, emailId: data.id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
