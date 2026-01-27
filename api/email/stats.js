// api/email/stats.js
import { kv } from '../../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    let emailIds = [];
    try {
      emailIds = await kv.lrange('emails:sent', 0, 100) || [];
    } catch (e) {
      emailIds = [];
    }
    
    const emails = [];
    
    for (const emailId of emailIds) {
      try {
        const email = await kv.get(`email:${emailId}`);
        if (email) {
          emails.push({
            id: email.id || emailId,
            to: email.to || '',
            subject: email.subject || '',
            sentAt: email.sentAt || '',
            status: email.status || 'sent',
            opens: email.opens || 0,
            clicks: email.clicks || 0
          });
        }
      } catch (e) {}
    }

    return res.status(200).json({
      stats: {
        sent: emails.length,
        opened: emails.filter(e => e.opens > 0).length,
        clicked: emails.filter(e => e.clicks > 0).length
      },
      emails: emails
    });

  } catch (error) {
    return res.status(200).json({ 
      stats: { sent: 0, opened: 0, clicked: 0 }, 
      emails: []
    });
  }
}
