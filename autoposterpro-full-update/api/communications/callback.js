// api/communications/callback.js
// Twilio call status callback handler

import { kv } from '../../lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { callId } = req.query;
    const { CallStatus, CallDuration, CallSid, From, To } = req.body;
    
    if (callId) {
      const call = await kv.get(callId);
      if (call) {
        call.status = CallStatus || call.status;
        call.duration = parseInt(CallDuration) || call.duration;
        call.twilioSid = CallSid || call.twilioSid;
        call.updatedAt = new Date().toISOString();
        
        // Map Twilio statuses
        if (CallStatus === 'completed') {
          call.answered = true;
        } else if (['busy', 'no-answer', 'canceled', 'failed'].includes(CallStatus)) {
          call.answered = false;
        }
        
        await kv.set(callId, call);
      }
    }
    
    return res.status(200).send('OK');
  }
  
  return res.status(405).send('Method not allowed');
}
