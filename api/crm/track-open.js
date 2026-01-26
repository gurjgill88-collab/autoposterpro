// Email Open Tracking Pixel
// Tracks when emails are opened

import { kv } from '@vercel/kv';

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export default async function handler(req, res) {
  const { id } = req.query;
  
  if (id) {
    try {
      // Get email record
      const emailRecord = await kv.get(id);
      
      if (emailRecord) {
        // Update open status
        emailRecord.opened = true;
        emailRecord.openedAt = emailRecord.openedAt || new Date().toISOString();
        emailRecord.openCount = (emailRecord.openCount || 0) + 1;
        emailRecord.lastOpenedAt = new Date().toISOString();
        
        await kv.set(id, emailRecord);
        
        // Update lead if associated
        if (emailRecord.leadId) {
          const lead = await kv.get(emailRecord.leadId);
          if (lead) {
            // Find and update the email in lead's history
            const emailIdx = (lead.emails || []).findIndex(e => e.id === id);
            if (emailIdx !== -1) {
              lead.emails[emailIdx].opened = true;
              lead.emails[emailIdx].openedAt = emailRecord.openedAt;
            }
            
            // Add activity (only on first open)
            if (emailRecord.openCount === 1) {
              lead.activities = lead.activities || [];
              lead.activities.unshift({
                type: 'email_opened',
                content: `Opened email: "${emailRecord.subject}"`,
                time: new Date().toISOString()
              });
              
              // Make lead hotter!
              if (lead.temp === 'cold') lead.temp = 'warm';
              else if (lead.temp === 'warm') lead.temp = 'hot';
            }
            
            lead.updatedAt = new Date().toISOString();
            await kv.set(emailRecord.leadId, lead);
          }
        }
        
        // Store in opens list for dashboard
        await kv.lpush('email-opens', JSON.stringify({
          emailId: id,
          leadId: emailRecord.leadId,
          to: emailRecord.to,
          subject: emailRecord.subject,
          openedAt: new Date().toISOString()
        }));
        
        // Keep only last 100 opens
        await kv.ltrim('email-opens', 0, 99);
        
        console.log('Email opened:', id, emailRecord.to);
      }
    } catch (error) {
      console.error('Track open error:', error);
    }
  }
  
  // Always return tracking pixel
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.status(200).send(TRACKING_PIXEL);
}
