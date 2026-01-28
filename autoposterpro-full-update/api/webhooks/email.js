// api/webhooks/email.js
// Resend webhook handler for email tracking (opens, clicks, bounces)
import { kv } from '../../lib/redis.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify webhook (optional - add your webhook secret)
  // const signature = req.headers['resend-signature'];
  // if (!verifySignature(signature, req.body)) {
  //   return res.status(401).json({ error: 'Invalid signature' });
  // }

  try {
    const event = req.body;
    
    console.log('Email webhook received:', event.type);

    const emailId = event.data?.email_id;
    const timestamp = new Date().toISOString();

    switch (event.type) {
      case 'email.sent':
        await trackEmailEvent(emailId, 'sent', timestamp, event.data);
        break;
        
      case 'email.delivered':
        await trackEmailEvent(emailId, 'delivered', timestamp, event.data);
        break;
        
      case 'email.opened':
        await trackEmailEvent(emailId, 'opened', timestamp, event.data);
        // Update open count
        await incrementEmailStat(emailId, 'opens');
        break;
        
      case 'email.clicked':
        await trackEmailEvent(emailId, 'clicked', timestamp, {
          ...event.data,
          link: event.data.click?.link
        });
        // Update click count
        await incrementEmailStat(emailId, 'clicks');
        break;
        
      case 'email.bounced':
        await trackEmailEvent(emailId, 'bounced', timestamp, event.data);
        // Mark contact as bounced
        await markEmailBounced(event.data.to);
        break;
        
      case 'email.complained':
        await trackEmailEvent(emailId, 'complained', timestamp, event.data);
        // Mark contact as complained (spam)
        await markEmailComplained(event.data.to);
        break;

      default:
        console.log('Unknown email event:', event.type);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Email webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function trackEmailEvent(emailId, eventType, timestamp, data) {
  if (!emailId) return;

  // Get existing email record
  const email = await kv.get(`email:${emailId}`) || {};

  // Update status
  email.status = eventType;
  email.lastEvent = timestamp;
  
  // Add to events array
  if (!email.events) email.events = [];
  email.events.push({
    type: eventType,
    timestamp,
    data
  });

  // Save
  await kv.set(`email:${emailId}`, email);

  // Update daily stats
  const today = timestamp.slice(0, 10);
  const statsKey = `email_stats:${today}`;
  const stats = await kv.get(statsKey) || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
  
  if (stats[eventType] !== undefined) {
    stats[eventType]++;
    await kv.set(statsKey, stats);
  }
}

async function incrementEmailStat(emailId, stat) {
  if (!emailId) return;

  const email = await kv.get(`email:${emailId}`);
  if (email) {
    email[stat] = (email[stat] || 0) + 1;
    await kv.set(`email:${emailId}`, email);
  }
}

async function markEmailBounced(toEmail) {
  if (!toEmail) return;

  // Find contact by email and mark as bounced
  const contactIndex = await kv.get('contacts:index') || [];
  
  for (const contactId of contactIndex) {
    const contact = await kv.get(`contact:${contactId}`);
    if (contact && contact.email === toEmail) {
      contact.emailStatus = 'bounced';
      contact.bouncedAt = new Date().toISOString();
      await kv.set(`contact:${contactId}`, contact);
      break;
    }
  }
}

async function markEmailComplained(toEmail) {
  if (!toEmail) return;

  // Find contact by email and mark as unsubscribed
  const contactIndex = await kv.get('contacts:index') || [];
  
  for (const contactId of contactIndex) {
    const contact = await kv.get(`contact:${contactId}`);
    if (contact && contact.email === toEmail) {
      contact.emailStatus = 'unsubscribed';
      contact.unsubscribedAt = new Date().toISOString();
      contact.unsubscribeReason = 'spam_complaint';
      await kv.set(`contact:${contactId}`, contact);
      break;
    }
  }
}
