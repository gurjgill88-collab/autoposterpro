// api/email/stats.js
// Email statistics - fixed to use correct storage key
import { kv } from '../../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    // The CRM send-email uses 'sent-emails' key (not 'emails:sent')
    let emailIds = [];
    try {
      emailIds = await kv.lrange('sent-emails', 0, 100) || [];
    } catch (e) {
      console.log('Error fetching sent-emails:', e);
    }
    
    // Fetch email details
    const emails = [];
    
    for (const emailId of emailIds) {
      try {
        // CRM stores directly by trackingId (not email:${id})
        const email = await kv.get(emailId);
        if (email) {
          emails.push({
            id: email.id || emailId,
            to: email.to || '',
            subject: email.subject || '',
            sentAt: email.sentAt || '',
            sender: email.sender || '',
            opened: email.opened || false,
            openedAt: email.openedAt || null,
            openCount: email.openCount || 0
          });
        }
      } catch (e) {
        console.log('Error fetching email:', emailId, e);
      }
    }

    // Sort by sentAt descending (newest first)
    emails.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    return res.status(200).json({
      stats: {
        sent: emails.length,
        opened: emails.filter(e => e.opened).length,
        clicked: 0
      },
      emails: emails
    });

  } catch (error) {
    console.error('Email stats error:', error);
    return res.status(200).json({ 
      stats: { sent: 0, opened: 0, clicked: 0 }, 
      emails: []
    });
  }
}
