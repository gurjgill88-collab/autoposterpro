// api/communications/sms-callback.js
// Twilio SMS status callback and incoming message handler

import { kv } from '../../lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { smsId } = req.query;
    const { MessageStatus, MessageSid, From, To, Body } = req.body;
    
    // Update outbound SMS status
    if (smsId) {
      const sms = await kv.get(smsId);
      if (sms) {
        sms.status = MessageStatus || sms.status;
        sms.twilioSid = MessageSid || sms.twilioSid;
        sms.updatedAt = new Date().toISOString();
        await kv.set(smsId, sms);
      }
      return res.status(200).send('OK');
    }
    
    // Handle incoming SMS
    if (Body && From) {
      const incomingSmsId = `sms:in:${Date.now()}`;
      
      // Try to find contact by phone number
      const contactKeys = await kv.keys('deal:*');
      let matchedContact = null;
      
      for (const key of contactKeys) {
        const deal = await kv.get(key);
        if (deal && deal.phone) {
          const cleanPhone = deal.phone.replace(/\D/g, '');
          const cleanFrom = From.replace(/\D/g, '');
          if (cleanPhone === cleanFrom || cleanFrom.endsWith(cleanPhone)) {
            matchedContact = {
              id: deal.id,
              name: deal.dealerName || deal.name,
              phone: deal.phone
            };
            break;
          }
        }
      }
      
      const incomingSms = {
        id: incomingSmsId,
        type: 'inbound',
        from: From,
        to: To,
        message: Body,
        contactId: matchedContact?.id || null,
        contactName: matchedContact?.name || 'Unknown',
        status: 'received',
        timestamp: new Date().toISOString(),
        twilioSid: MessageSid,
        read: false
      };
      
      await kv.set(incomingSmsId, incomingSms);
      await kv.lpush('sms:all', incomingSmsId);
      await kv.lpush('sms:inbound', incomingSmsId);
      
      if (matchedContact?.id) {
        await kv.lpush(`sms:contact:${matchedContact.id}`, incomingSmsId);
      }
      
      // Auto-reply (optional - can be configured)
      // Return empty TwiML to acknowledge without auto-reply
      res.setHeader('Content-Type', 'application/xml');
      return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    }
    
    return res.status(200).send('OK');
  }
  
  return res.status(405).send('Method not allowed');
}
