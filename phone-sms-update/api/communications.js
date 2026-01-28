// api/communications.js
// Phone Dialer & SMS Texting Integration
// Uses Twilio for reliable calling and SMS

import { kv } from '../lib/redis.js';

// Twilio credentials (set in Vercel environment)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // Verify auth
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  let userId = 'admin';
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    userId = payload.email || payload.id || 'admin';
  } catch (e) {
    if (token !== process.env.ADMIN_SECRET_KEY) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
  
  try {
    const { action } = req.query;
    
    // GET - Retrieve call/SMS logs
    if (req.method === 'GET') {
      // Get call logs
      if (action === 'calls') {
        const { contactId, limit = 50 } = req.query;
        
        let callIds;
        if (contactId) {
          callIds = await kv.lrange(`calls:contact:${contactId}`, 0, limit - 1) || [];
        } else {
          callIds = await kv.lrange('calls:all', 0, limit - 1) || [];
        }
        
        const calls = [];
        for (const callId of callIds) {
          const call = await kv.get(callId);
          if (call) calls.push(call);
        }
        
        return res.status(200).json({ calls });
      }
      
      // Get SMS logs
      if (action === 'messages') {
        const { contactId, limit = 50 } = req.query;
        
        let msgIds;
        if (contactId) {
          msgIds = await kv.lrange(`sms:contact:${contactId}`, 0, limit - 1) || [];
        } else {
          msgIds = await kv.lrange('sms:all', 0, limit - 1) || [];
        }
        
        const messages = [];
        for (const msgId of msgIds) {
          const msg = await kv.get(msgId);
          if (msg) messages.push(msg);
        }
        
        return res.status(200).json({ messages });
      }
      
      // Get conversation with a contact
      if (action === 'conversation') {
        const { contactId } = req.query;
        if (!contactId) {
          return res.status(400).json({ error: 'Contact ID required' });
        }
        
        const msgIds = await kv.lrange(`sms:contact:${contactId}`, 0, 100) || [];
        const messages = [];
        for (const msgId of msgIds) {
          const msg = await kv.get(msgId);
          if (msg) messages.push(msg);
        }
        
        // Sort by timestamp
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        return res.status(200).json({ messages });
      }
      
      // Get communication settings
      if (action === 'settings') {
        const settings = await kv.get(`comm:settings:${userId}`) || {
          forwardingNumber: '',
          voicemailEnabled: false,
          callRecordingEnabled: false,
          smsSignature: '',
          twilioConfigured: !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER)
        };
        return res.status(200).json({ settings });
      }
      
      // Get stats
      if (action === 'stats') {
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7);
        
        const stats = {
          callsToday: parseInt(await kv.get(`stats:calls:${today}`) || 0),
          callsThisMonth: parseInt(await kv.get(`stats:calls:${thisMonth}`) || 0),
          smsToday: parseInt(await kv.get(`stats:sms:${today}`) || 0),
          smsThisMonth: parseInt(await kv.get(`stats:sms:${thisMonth}`) || 0),
          totalCalls: parseInt(await kv.get('stats:calls:total') || 0),
          totalSms: parseInt(await kv.get('stats:sms:total') || 0)
        };
        
        return res.status(200).json({ stats });
      }
      
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    // POST - Make call or send SMS
    if (req.method === 'POST') {
      // Initiate phone call
      if (action === 'call') {
        const { to, contactId, contactName, dealId, notes } = req.body;
        
        if (!to) {
          return res.status(400).json({ error: 'Phone number required' });
        }
        
        // Format phone number
        const formattedTo = formatPhoneNumber(to);
        
        // Log the call attempt
        const callId = `call:${Date.now()}`;
        const callLog = {
          id: callId,
          type: 'outbound',
          to: formattedTo,
          from: TWILIO_PHONE_NUMBER || 'browser',
          contactId: contactId || null,
          contactName: contactName || null,
          dealId: dealId || null,
          userId,
          status: 'initiated',
          duration: 0,
          notes: notes || '',
          timestamp: new Date().toISOString(),
          method: 'click-to-call' // or 'twilio' if we use Twilio
        };
        
        // If Twilio is configured, initiate real call
        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
          try {
            // Get user's forwarding number
            const settings = await kv.get(`comm:settings:${userId}`) || {};
            const forwardingNumber = settings.forwardingNumber;
            
            if (!forwardingNumber) {
              return res.status(400).json({ 
                error: 'Please configure your forwarding phone number in Settings first',
                needsSetup: true
              });
            }
            
            // Make Twilio call
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
            const twimlUrl = `${process.env.NEXT_PUBLIC_URL || 'https://www.autoposterpro.com'}/api/communications/twiml?to=${encodeURIComponent(formattedTo)}`;
            
            const twilioResponse = await fetch(twilioUrl, {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                To: formatPhoneNumber(forwardingNumber),
                From: TWILIO_PHONE_NUMBER,
                Url: twimlUrl,
                StatusCallback: `${process.env.NEXT_PUBLIC_URL || 'https://www.autoposterpro.com'}/api/communications/callback?callId=${callId}`,
                StatusCallbackEvent: 'initiated ringing answered completed'
              })
            });
            
            const twilioData = await twilioResponse.json();
            
            if (twilioData.sid) {
              callLog.twilioSid = twilioData.sid;
              callLog.status = 'connecting';
              callLog.method = 'twilio';
            } else {
              callLog.status = 'failed';
              callLog.error = twilioData.message || 'Twilio call failed';
            }
          } catch (twilioError) {
            console.error('Twilio call error:', twilioError);
            callLog.status = 'failed';
            callLog.error = twilioError.message;
          }
        } else {
          // Fall back to click-to-call (opens phone app)
          callLog.method = 'click-to-call';
          callLog.status = 'opened';
        }
        
        // Save call log
        await kv.set(callId, callLog);
        await kv.lpush('calls:all', callId);
        if (contactId) {
          await kv.lpush(`calls:contact:${contactId}`, callId);
        }
        
        // Update stats
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7);
        await kv.incr(`stats:calls:${today}`);
        await kv.incr(`stats:calls:${thisMonth}`);
        await kv.incr('stats:calls:total');
        
        return res.status(200).json({ 
          success: true, 
          call: callLog,
          dialUrl: `tel:${formattedTo}`,
          method: callLog.method
        });
      }
      
      // Send SMS
      if (action === 'sms') {
        const { to, message, contactId, contactName, dealId, templateId } = req.body;
        
        if (!to || !message) {
          return res.status(400).json({ error: 'Phone number and message required' });
        }
        
        const formattedTo = formatPhoneNumber(to);
        
        // Get user's SMS signature
        const settings = await kv.get(`comm:settings:${userId}`) || {};
        const fullMessage = settings.smsSignature 
          ? `${message}\n\n${settings.smsSignature}`
          : message;
        
        const smsId = `sms:${Date.now()}`;
        const smsLog = {
          id: smsId,
          type: 'outbound',
          to: formattedTo,
          from: TWILIO_PHONE_NUMBER || 'system',
          contactId: contactId || null,
          contactName: contactName || null,
          dealId: dealId || null,
          userId,
          message: fullMessage,
          status: 'pending',
          timestamp: new Date().toISOString(),
          templateId: templateId || null
        };
        
        // If Twilio is configured, send real SMS
        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
          try {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
            
            const twilioResponse = await fetch(twilioUrl, {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                To: formattedTo,
                From: TWILIO_PHONE_NUMBER,
                Body: fullMessage,
                StatusCallback: `${process.env.NEXT_PUBLIC_URL || 'https://www.autoposterpro.com'}/api/communications/sms-callback?smsId=${smsId}`
              })
            });
            
            const twilioData = await twilioResponse.json();
            
            if (twilioData.sid) {
              smsLog.twilioSid = twilioData.sid;
              smsLog.status = 'sent';
            } else {
              smsLog.status = 'failed';
              smsLog.error = twilioData.message || 'SMS send failed';
            }
          } catch (twilioError) {
            console.error('Twilio SMS error:', twilioError);
            smsLog.status = 'failed';
            smsLog.error = twilioError.message;
          }
        } else {
          // No Twilio - log but mark as not sent
          smsLog.status = 'not_configured';
          smsLog.error = 'Twilio not configured. SMS logged but not sent.';
        }
        
        // Save SMS log
        await kv.set(smsId, smsLog);
        await kv.lpush('sms:all', smsId);
        if (contactId) {
          await kv.lpush(`sms:contact:${contactId}`, smsId);
        }
        
        // Update stats
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7);
        await kv.incr(`stats:sms:${today}`);
        await kv.incr(`stats:sms:${thisMonth}`);
        await kv.incr('stats:sms:total');
        
        return res.status(200).json({ 
          success: true, 
          sms: smsLog,
          twilioConfigured: !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER)
        });
      }
      
      // Log manual call (for click-to-call follow-up)
      if (action === 'log-call') {
        const { callId, duration, outcome, notes, answered } = req.body;
        
        if (callId) {
          const call = await kv.get(callId);
          if (call) {
            call.duration = duration || 0;
            call.outcome = outcome || '';
            call.notes = notes || call.notes;
            call.answered = answered !== false;
            call.status = answered !== false ? 'completed' : 'no-answer';
            call.completedAt = new Date().toISOString();
            await kv.set(callId, call);
            return res.status(200).json({ success: true, call });
          }
        }
        
        // Create new manual log
        const newCallId = `call:${Date.now()}`;
        const callLog = {
          id: newCallId,
          ...req.body,
          userId,
          method: 'manual',
          status: 'completed',
          timestamp: new Date().toISOString()
        };
        
        await kv.set(newCallId, callLog);
        await kv.lpush('calls:all', newCallId);
        if (req.body.contactId) {
          await kv.lpush(`calls:contact:${req.body.contactId}`, newCallId);
        }
        
        return res.status(200).json({ success: true, call: callLog });
      }
      
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    // PUT - Update settings
    if (req.method === 'PUT') {
      if (action === 'settings') {
        const settings = req.body;
        await kv.set(`comm:settings:${userId}`, settings);
        return res.status(200).json({ success: true, settings });
      }
      
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Communications API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

// Format phone number to E.164 format
function formatPhoneNumber(phone) {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 1 and is 11 digits, it's already formatted
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return '+' + cleaned;
  }
  
  // If 10 digits, assume North American and add +1
  if (cleaned.length === 10) {
    return '+1' + cleaned;
  }
  
  // Otherwise return with + prefix
  return '+' + cleaned;
}
