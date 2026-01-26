// Email Sequence Sender
// Handles automated follow-up emails for leads

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Email templates for follow-up sequence
export const EMAIL_TEMPLATES = {
  // Day 0 - Immediate
  day0: {
    subject: 'Thanks for reaching out to AutoPosterPro!',
    getHtml: (name, dealership) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Auto<span style="color: #f97316;">Poster</span>Pro</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <h2 style="color: #1f2937;">Hi ${name}! 👋</h2>
          
          <p style="color: #4b5563; font-size: 16px;">
            Thanks for your interest in AutoPosterPro for <strong>${dealership}</strong>!
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            We received your message and will get back to you within 24 hours.
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            In the meantime, here's what AutoPosterPro can do for your dealership:
          </p>
          
          <ul style="color: #4b5563; font-size: 14px;">
            <li>✅ Post to Facebook Marketplace in seconds (not minutes)</li>
            <li>✅ AI-powered descriptions that avoid shadowbans</li>
            <li>✅ Works with ANY dealer website</li>
            <li>✅ One-click vehicle data scraping</li>
          </ul>
          
          <p style="color: #4b5563; font-size: 16px;">
            Talk soon!<br>
            <strong>The AutoPosterPro Team</strong>
          </p>
        </div>
        
        <div style="background: #1f2937; padding: 20px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            © 2026 AutoPosterPro | <a href="https://autoposterpro.com" style="color: #7c3aed;">autoposterpro.com</a>
          </p>
        </div>
      </div>
    `
  },
  
  // Day 1 - Quick question
  day1: {
    subject: 'Quick question about ${dealership}',
    getHtml: (name, dealership) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 30px;">
          <p style="color: #4b5563; font-size: 16px;">Hi ${name},</p>
          
          <p style="color: #4b5563; font-size: 16px;">
            I wanted to follow up on your inquiry about AutoPosterPro.
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Quick question: How many vehicles does <strong>${dealership}</strong> typically post to Facebook Marketplace each week?
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Most of our dealers save 2-3 hours per day using our tool. I'd love to show you how it works in a quick 15-minute demo.
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Just reply to this email with a time that works for you!
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Best,<br>
            <strong>AutoPosterPro Team</strong><br>
            <a href="mailto:support@autoposterpro.com" style="color: #7c3aed;">support@autoposterpro.com</a>
          </p>
        </div>
      </div>
    `
  },
  
  // Day 3 - Success story
  day3: {
    subject: 'How dealers are using AutoPosterPro',
    getHtml: (name, dealership) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 30px;">
          <p style="color: #4b5563; font-size: 16px;">Hi ${name},</p>
          
          <p style="color: #4b5563; font-size: 16px;">
            I wanted to share how other dealerships are using AutoPosterPro:
          </p>
          
          <div style="background: #f3f4f6; border-left: 4px solid #7c3aed; padding: 15px; margin: 20px 0;">
            <p style="color: #4b5563; font-size: 14px; font-style: italic; margin: 0;">
              "We went from posting 5 cars a day to 20+. The AI descriptions are a game-changer - no more shadowbans!"
            </p>
            <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0 0;">
              — Used Car Dealer, Vancouver
            </p>
          </div>
          
          <p style="color: #4b5563; font-size: 16px;">
            <strong>Here's what dealers love most:</strong>
          </p>
          
          <ul style="color: #4b5563; font-size: 14px;">
            <li>🚗 One-click scraping from any dealer website</li>
            <li>📝 AI writes unique descriptions (no copy-paste flagging)</li>
            <li>⚡ Post in 30 seconds instead of 15 minutes</li>
            <li>📱 All images transfer automatically</li>
          </ul>
          
          <p style="color: #4b5563; font-size: 16px;">
            Would you like to see it in action? I can do a quick screen share demo whenever works for you.
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Cheers,<br>
            <strong>AutoPosterPro Team</strong>
          </p>
        </div>
      </div>
    `
  },
  
  // Day 7 - Demo invite
  day7: {
    subject: 'Ready for a demo, ${name}?',
    getHtml: (name, dealership) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 30px;">
          <p style="color: #4b5563; font-size: 16px;">Hi ${name},</p>
          
          <p style="color: #4b5563; font-size: 16px;">
            I haven't heard back from you yet, so I wanted to reach out one more time.
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            I know you're busy running <strong>${dealership}</strong>, but I truly believe AutoPosterPro can save your team hours every day.
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            <strong>Here's my offer:</strong> Let me give you a free 15-minute demo. If you don't see the value, no hard feelings!
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="mailto:support@autoposterpro.com?subject=Demo Request - ${dealership}" 
               style="background: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Schedule a Demo
            </a>
          </div>
          
          <p style="color: #4b5563; font-size: 16px;">
            Or just reply to this email with a time that works.
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Best,<br>
            <strong>AutoPosterPro Team</strong>
          </p>
        </div>
      </div>
    `
  },
  
  // Day 30 - Still thinking
  day30: {
    subject: 'Still thinking about it?',
    getHtml: (name, dealership) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 30px;">
          <p style="color: #4b5563; font-size: 16px;">Hi ${name},</p>
          
          <p style="color: #4b5563; font-size: 16px;">
            It's been about a month since you reached out about AutoPosterPro.
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            I wanted to check in - did you have any questions I could answer? Or is there something holding you back?
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Common concerns I hear:
          </p>
          
          <ul style="color: #4b5563; font-size: 14px;">
            <li><strong>"Is it hard to set up?"</strong> — We do it for you via screen share!</li>
            <li><strong>"What if Facebook changes?"</strong> — We update the extension automatically</li>
            <li><strong>"Is it worth the cost?"</strong> — If it saves 1 hour/day, that's 20+ hours/month</li>
          </ul>
          
          <p style="color: #4b5563; font-size: 16px;">
            Just reply if you have any questions!
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Best,<br>
            <strong>AutoPosterPro Team</strong>
          </p>
        </div>
      </div>
    `
  },
  
  // Day 60 and ongoing - Periodic check-in
  day60: {
    subject: 'Checking in from AutoPosterPro',
    getHtml: (name, dealership) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 30px;">
          <p style="color: #4b5563; font-size: 16px;">Hi ${name},</p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Just a quick check-in from AutoPosterPro!
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Are you still posting vehicles to Facebook Marketplace manually? We'd love to help <strong>${dealership}</strong> save time with our one-click posting tool.
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Our tool is now even better with AI-powered descriptions that help you avoid Facebook's spam filters.
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            If the timing is better now, just reply and we can set up a quick demo!
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Best,<br>
            <strong>AutoPosterPro Team</strong><br>
            <a href="https://autoposterpro.com" style="color: #7c3aed;">autoposterpro.com</a>
          </p>
          
          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
            <a href="https://autoposterpro.com/unsubscribe?email={{email}}" style="color: #9ca3af;">Unsubscribe</a> from these emails
          </p>
        </div>
      </div>
    `
  }
};

// Send a specific email from the sequence
export async function sendSequenceEmail(contact, sequenceDay) {
  const template = EMAIL_TEMPLATES[`day${sequenceDay}`];
  
  if (!template) {
    console.log('No template for day:', sequenceDay);
    return false;
  }
  
  try {
    const subject = template.subject
      .replace('${name}', contact.firstName)
      .replace('${dealership}', contact.dealership);
    
    const html = template.getHtml(contact.firstName, contact.dealership);
    
    await resend.emails.send({
      from: 'AutoPosterPro <support@autoposterpro.com>',
      to: contact.email,
      subject: subject,
      html: html
    });
    
    console.log(`Sent day ${sequenceDay} email to:`, contact.email);
    return true;
  } catch (error) {
    console.error('Failed to send sequence email:', error);
    return false;
  }
}

// Calculate which emails should be sent based on contact date
export function getScheduledEmails(contactDate) {
  const now = new Date();
  const contact = new Date(contactDate);
  const daysSinceContact = Math.floor((now - contact) / (1000 * 60 * 60 * 24));
  
  const schedule = [];
  
  // Fixed schedule emails
  const fixedDays = [0, 1, 3, 7, 30, 60];
  
  for (const day of fixedDays) {
    if (daysSinceContact >= day) {
      schedule.push(day);
    }
  }
  
  // Every 60 days after day 60
  if (daysSinceContact > 60) {
    const additionalEmails = Math.floor((daysSinceContact - 60) / 60);
    for (let i = 1; i <= additionalEmails; i++) {
      schedule.push(60 + (i * 60)); // 120, 180, 240, etc.
    }
  }
  
  return schedule;
}
