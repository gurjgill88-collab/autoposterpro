// Email Sequence Processor (Cron Job)
// Run this daily via Vercel Cron to process email sequences
// Add to vercel.json: "crons": [{ "path": "/api/cron/process-sequences", "schedule": "0 9 * * *" }]

import { kv } from '../../lib/redis.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Email sequence schedule (days after signup)
const SEQUENCE_DAYS = [0, 1, 3, 7, 30, 60];

export default async function handler(req, res) {
  // Verify this is called by Vercel Cron or admin
  const authHeader = req.headers.authorization;
  const cronSecret = req.headers['x-vercel-cron'];
  
  if (!cronSecret && authHeader !== `Bearer ${process.env.ADMIN_SECRET_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log('Processing email sequences...');
  
  try {
    // Get all contacts
    const contactIds = await kv.lrange('contacts', 0, -1) || [];
    
    let processed = 0;
    let emailsSent = 0;
    
    for (const contactId of contactIds) {
      const contact = await kv.get(contactId);
      
      if (!contact) continue;
      if (contact.status === 'converted' || contact.status === 'unsubscribed') continue;
      
      processed++;
      
      // Calculate days since contact
      const contactDate = new Date(contact.submittedAt);
      const now = new Date();
      const daysSinceContact = Math.floor((now - contactDate) / (1000 * 60 * 60 * 24));
      
      // Get sent emails history
      const sentEmails = contact.sentEmails || [];
      
      // Check which email should be sent today
      for (const day of SEQUENCE_DAYS) {
        // Check if this day's email should be sent
        if (daysSinceContact >= day && !sentEmails.includes(day)) {
          // Send the email
          const sent = await sendSequenceEmail(contact, day);
          
          if (sent) {
            emailsSent++;
            sentEmails.push(day);
            
            // Update contact with sent email record
            contact.sentEmails = sentEmails;
            contact.lastEmailSent = new Date().toISOString();
            contact.lastEmailDay = day;
            await kv.set(contactId, contact);
          }
          
          // Only send one email per contact per run
          break;
        }
      }
      
      // Check for recurring 60-day emails (after initial sequence)
      if (daysSinceContact > 60) {
        const lastRecurring = Math.max(...sentEmails.filter(d => d >= 60));
        const daysSinceLastRecurring = daysSinceContact - lastRecurring;
        
        if (daysSinceLastRecurring >= 60) {
          const nextRecurringDay = lastRecurring + 60;
          
          if (!sentEmails.includes(nextRecurringDay)) {
            const sent = await sendSequenceEmail(contact, 60); // Reuse day 60 template
            
            if (sent) {
              emailsSent++;
              sentEmails.push(nextRecurringDay);
              contact.sentEmails = sentEmails;
              contact.lastEmailSent = new Date().toISOString();
              contact.lastEmailDay = nextRecurringDay;
              await kv.set(contactId, contact);
            }
          }
        }
      }
    }
    
    console.log(`Processed ${processed} contacts, sent ${emailsSent} emails`);
    
    return res.status(200).json({
      success: true,
      processed,
      emailsSent,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Sequence processing error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Send email based on sequence day
async function sendSequenceEmail(contact, sequenceDay) {
  const templates = {
    0: {
      subject: 'Thanks for reaching out to AutoPosterPro!',
      body: 'immediate-thanks'
    },
    1: {
      subject: `Quick question about ${contact.dealership}`,
      body: 'day1-question'
    },
    3: {
      subject: 'How dealers are using AutoPosterPro',
      body: 'day3-stories'
    },
    7: {
      subject: `Ready for a demo, ${contact.firstName}?`,
      body: 'day7-demo'
    },
    30: {
      subject: 'Still thinking about it?',
      body: 'day30-checkin'
    },
    60: {
      subject: 'Checking in from AutoPosterPro',
      body: 'day60-recurring'
    }
  };
  
  const template = templates[Math.min(sequenceDay, 60)];
  if (!template) return false;
  
  try {
    await resend.emails.send({
      from: 'AutoPosterPro <support@autoposterpro.com>',
      to: contact.email,
      subject: template.subject,
      html: getEmailHtml(template.body, contact)
    });
    
    console.log(`Sent day ${sequenceDay} email to ${contact.email}`);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${contact.email}:`, error);
    return false;
  }
}

// Generate email HTML based on template type
function getEmailHtml(templateType, contact) {
  const { firstName, dealership, email } = contact;
  
  const header = `
    <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-family: Arial, sans-serif;">Auto<span style="color: #f97316;">Poster</span>Pro</h1>
    </div>
  `;
  
  const footer = `
    <div style="background: #1f2937; padding: 20px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0; font-family: Arial, sans-serif;">
        © 2026 AutoPosterPro | <a href="https://autoposterpro.com" style="color: #7c3aed;">autoposterpro.com</a>
        <br><br>
        <a href="https://autoposterpro.com/unsubscribe?email=${encodeURIComponent(email)}" style="color: #6b7280;">Unsubscribe</a>
      </p>
    </div>
  `;
  
  const templates = {
    'immediate-thanks': `
      ${header}
      <div style="padding: 30px; font-family: Arial, sans-serif;">
        <h2 style="color: #1f2937;">Hi ${firstName}! 👋</h2>
        <p style="color: #4b5563;">Thanks for your interest in AutoPosterPro for <strong>${dealership}</strong>!</p>
        <p style="color: #4b5563;">We received your message and will get back to you within 24 hours.</p>
        <p style="color: #4b5563;">In the meantime, here's what we can do for your dealership:</p>
        <ul style="color: #4b5563;">
          <li>✅ Post to Facebook Marketplace in seconds</li>
          <li>✅ AI-powered descriptions that avoid shadowbans</li>
          <li>✅ Works with ANY dealer website</li>
        </ul>
        <p style="color: #4b5563;">Talk soon!<br><strong>The AutoPosterPro Team</strong></p>
      </div>
      ${footer}
    `,
    
    'day1-question': `
      <div style="padding: 30px; font-family: Arial, sans-serif;">
        <p style="color: #4b5563;">Hi ${firstName},</p>
        <p style="color: #4b5563;">Quick question: How many vehicles does <strong>${dealership}</strong> typically post to Facebook Marketplace each week?</p>
        <p style="color: #4b5563;">Most of our dealers save 2-3 hours per day. I'd love to show you how in a quick 15-minute demo.</p>
        <p style="color: #4b5563;">Just reply with a time that works!</p>
        <p style="color: #4b5563;">Best,<br><strong>AutoPosterPro Team</strong><br><a href="mailto:support@autoposterpro.com" style="color: #7c3aed;">support@autoposterpro.com</a></p>
      </div>
    `,
    
    'day3-stories': `
      <div style="padding: 30px; font-family: Arial, sans-serif;">
        <p style="color: #4b5563;">Hi ${firstName},</p>
        <p style="color: #4b5563;">Here's what other dealerships are saying:</p>
        <div style="background: #f3f4f6; border-left: 4px solid #7c3aed; padding: 15px; margin: 20px 0;">
          <p style="color: #4b5563; font-style: italic;">"We went from posting 5 cars a day to 20+. The AI descriptions are a game-changer!"</p>
          <p style="color: #6b7280; font-size: 12px;">— Used Car Dealer, Vancouver</p>
        </div>
        <p style="color: #4b5563;">Would you like to see it in action?</p>
        <p style="color: #4b5563;">Cheers,<br><strong>AutoPosterPro Team</strong></p>
      </div>
    `,
    
    'day7-demo': `
      <div style="padding: 30px; font-family: Arial, sans-serif;">
        <p style="color: #4b5563;">Hi ${firstName},</p>
        <p style="color: #4b5563;">I know you're busy running <strong>${dealership}</strong>, but I truly believe AutoPosterPro can save your team hours every day.</p>
        <p style="color: #4b5563;"><strong>My offer:</strong> Let me give you a free 15-minute demo. If you don't see the value, no hard feelings!</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="mailto:support@autoposterpro.com?subject=Demo Request - ${dealership}" style="background: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">Schedule a Demo</a>
        </div>
        <p style="color: #4b5563;">Best,<br><strong>AutoPosterPro Team</strong></p>
      </div>
    `,
    
    'day30-checkin': `
      <div style="padding: 30px; font-family: Arial, sans-serif;">
        <p style="color: #4b5563;">Hi ${firstName},</p>
        <p style="color: #4b5563;">It's been about a month since you reached out. Did you have any questions I could answer?</p>
        <p style="color: #4b5563;">Common concerns:</p>
        <ul style="color: #4b5563;">
          <li><strong>"Is it hard to set up?"</strong> — We do it for you via screen share!</li>
          <li><strong>"What if Facebook changes?"</strong> — We update automatically</li>
          <li><strong>"Is it worth the cost?"</strong> — If it saves 1 hour/day, that's 20+ hours/month</li>
        </ul>
        <p style="color: #4b5563;">Just reply if you have any questions!</p>
        <p style="color: #4b5563;">Best,<br><strong>AutoPosterPro Team</strong></p>
      </div>
    `,
    
    'day60-recurring': `
      <div style="padding: 30px; font-family: Arial, sans-serif;">
        <p style="color: #4b5563;">Hi ${firstName},</p>
        <p style="color: #4b5563;">Just a quick check-in from AutoPosterPro!</p>
        <p style="color: #4b5563;">Are you still posting vehicles to Facebook Marketplace manually? We'd love to help <strong>${dealership}</strong> save time.</p>
        <p style="color: #4b5563;">If the timing is better now, just reply and we can set up a quick demo!</p>
        <p style="color: #4b5563;">Best,<br><strong>AutoPosterPro Team</strong><br><a href="https://autoposterpro.com" style="color: #7c3aed;">autoposterpro.com</a></p>
      </div>
    `
  };
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${templates[templateType] || templates['day60-recurring']}
    </div>
  `;
}
