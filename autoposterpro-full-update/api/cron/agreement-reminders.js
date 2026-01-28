// api/cron/agreement-reminders.js
// Send reminders for unsigned agreements

import { kv } from '../../lib/redis.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://www.autoposterpro.com';

export default async function handler(req, res) {
  // Verify cron secret or allow GET for Vercel cron
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && req.method !== 'GET') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const now = new Date();
    const agreementIds = await kv.lrange('agreements', 0, -1) || [];
    
    let reminders45min = 0;
    let remindersNextDay = 0;
    let expired = 0;
    
    for (const id of agreementIds) {
      const agreement = await kv.get(id);
      if (!agreement) continue;
      
      // Skip if already signed or expired
      if (['customer_signed', 'fully_signed', 'expired', 'voided'].includes(agreement.status)) {
        continue;
      }
      
      const sentAt = new Date(agreement.sentAt);
      const minutesSinceSent = (now - sentAt) / (1000 * 60);
      const hoursSinceSent = minutesSinceSent / 60;
      
      // Check if expired
      if (new Date(agreement.expiresAt) < now) {
        agreement.status = 'expired';
        await kv.set(id, agreement);
        expired++;
        continue;
      }
      
      // 45 minute reminder (if not viewed)
      if (!agreement.reminder45minSent && 
          minutesSinceSent >= 45 && 
          minutesSinceSent < 60 &&
          agreement.viewCount === 0) {
        
        await sendReminder(agreement, '45min');
        agreement.reminder45minSent = true;
        await kv.set(id, agreement);
        reminders45min++;
      }
      
      // Next business day reminder (roughly 24 hours)
      if (!agreement.reminderNextDaySent && 
          hoursSinceSent >= 20 && 
          hoursSinceSent < 28 &&
          (agreement.status === 'pending' || agreement.status === 'viewed')) {
        
        await sendReminder(agreement, 'nextday');
        agreement.reminderNextDaySent = true;
        await kv.set(id, agreement);
        remindersNextDay++;
      }
    }
    
    return res.status(200).json({
      success: true,
      processed: agreementIds.length,
      reminders45min,
      remindersNextDay,
      expired
    });
    
  } catch (error) {
    console.error('Agreement reminders error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

async function sendReminder(agreement, type) {
  const subject = type === '45min' 
    ? `Quick Reminder: Your Agreement is Ready - ${agreement.dealerName}`
    : `Don't Forget: Agreement Awaiting Your Signature - ${agreement.dealerName}`;
  
  const intro = type === '45min'
    ? `Just a quick nudge - your AutoPosterPro agreement is ready and waiting for your signature!`
    : `We noticed you haven't had a chance to sign your AutoPosterPro agreement yet. No worries - it's still waiting for you!`;
  
  try {
    await resend.emails.send({
      from: 'AutoPosterPro <support@autoposterpro.com>',
      to: agreement.contactEmail,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7c3aed; margin: 0;">AutoPosterPro</h1>
          </div>
          
          <p>Hi ${agreement.contactFirstName || agreement.contactName},</p>
          <p>${intro}</p>
          
          <div style="background: #f8f4ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Dealership:</strong> ${agreement.dealerName}</p>
            <p style="margin: 10px 0 0;"><strong>Plan:</strong> ${agreement.planName} - $${agreement.finalMonthly}/mo</p>
          </div>
          
          <p style="margin: 30px 0; text-align: center;">
            <a href="${agreement.signatureUrl}" 
               style="background: #7c3aed; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Sign Agreement Now
            </a>
          </p>
          
          <p style="color: #666; font-size: 14px;">This agreement will expire on ${new Date(agreement.expiresAt).toLocaleDateString()}.</p>
          
          <p style="color: #888; font-size: 12px;">Questions? Just reply to this email.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">AutoPosterPro | <a href="${BASE_URL}" style="color: #7c3aed;">autoposterpro.com</a></p>
        </div>
      `
    });
    console.log(`Sent ${type} reminder to ${agreement.contactEmail}`);
  } catch (e) {
    console.error(`Failed to send ${type} reminder:`, e);
  }
}
