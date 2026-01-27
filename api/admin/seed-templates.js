// Seed Email Templates
// Run once to populate default email templates

import { kv } from '../../lib/redis.js';

const DEFAULT_TEMPLATES = [
  {
    name: 'Cold Introduction',
    category: 'Introduction',
    subject: 'Automate Your Facebook Marketplace Listings - AutoPosterPro',
    body: `Hi {{firstName}},

I noticed {{dealerName}} isn't on Facebook Marketplace yet. You're missing out on millions of local car buyers searching there every day!

AutoPosterPro makes it effortless:
• One-click posting from your existing website
• 30 seconds per vehicle instead of 10+ minutes
• Auto-imports photos, price, and details
• Reaches local buyers actively searching

Want a quick 10-minute demo? Just reply to this email and I'll set one up.

Best,
{{senderName}}`,
    variables: ['firstName', 'dealerName', 'senderName']
  },
  {
    name: 'Follow-up #1',
    category: 'Follow-up',
    subject: 'Quick follow-up: Facebook Marketplace for {{dealerName}}',
    body: `Hi {{firstName}},

I wanted to follow up on my previous email about AutoPosterPro.

Dealers using AutoPosterPro typically see 15-30 additional leads per month from Facebook Marketplace.

At just $99/month, that's potentially $3-10 per lead - far less than AutoTrader or Cars.com.

Would you have 10 minutes this week for a quick demo?

Best,
{{senderName}}`,
    variables: ['firstName', 'dealerName', 'senderName']
  },
  {
    name: 'Follow-up #2 - Last Chance',
    category: 'Follow-up',
    subject: 'One last thing about {{dealerName}}...',
    body: `Hi {{firstName}},

I don't want to be a pest, so this will be my last email.

Just wanted to mention that we're offering a 14-day free trial for new dealers. No credit card required.

If Facebook Marketplace isn't a priority right now, no worries - I'll leave you alone. But if you'd like to give it a try risk-free, just reply "yes" and I'll set you up.

Best,
{{senderName}}`,
    variables: ['firstName', 'dealerName', 'senderName']
  },
  {
    name: 'Demo Confirmation',
    category: 'Demo',
    subject: 'Your AutoPosterPro Demo is Confirmed! 📅',
    body: `Hi {{firstName}},

Great news! Your AutoPosterPro demo is confirmed.

📅 Date: {{demoDate}}
⏰ Time: {{demoTime}}

What to expect:
• Live demo of the extension on your website
• See a real vehicle posted in under 30 seconds
• Q&A about features and pricing
• Special demo discount if you sign up!

See you soon!
{{senderName}}`,
    variables: ['firstName', 'demoDate', 'demoTime', 'senderName']
  },
  {
    name: 'Post-Demo Follow-up',
    category: 'Demo',
    subject: 'Thanks for the demo - Next steps',
    body: `Hi {{firstName}},

Thanks for taking the time to see AutoPosterPro in action today!

As promised, here's the special demo discount: Use code DEMO20 for 20% off your first 3 months.

Ready to get started? Here's your signup link:
https://autoposterpro.com/signup?code=DEMO20

Questions? Just reply to this email - I'm happy to help!

Best,
{{senderName}}`,
    variables: ['firstName', 'senderName']
  },
  {
    name: 'Proposal',
    category: 'Proposal',
    subject: 'Your AutoPosterPro Proposal - {{dealerName}}',
    body: `Hi {{firstName}},

Thanks for your interest in AutoPosterPro for {{dealerName}}!

Here's your custom proposal:

Plan: {{plan}}
Monthly Price: {{price}}
Users Included: {{users}}
Setup: FREE ($200 value)

Ready to get started? Click here to sign up:
https://autoposterpro.com/signup

Questions? Just reply to this email!

Best,
{{senderName}}`,
    variables: ['firstName', 'dealerName', 'plan', 'price', 'users', 'senderName']
  },
  {
    name: 'Agreement Request',
    category: 'Closing',
    subject: 'AutoPosterPro License Agreement - Please Sign',
    body: `Hi {{firstName}},

Thanks for choosing AutoPosterPro for {{dealerName}}!

Before we get you set up, please sign the license agreement:
{{signatureUrl}}

This link expires in 7 days.

Once signed, we'll:
1. Generate your license key
2. Schedule your onboarding call
3. Get you posting to Facebook Marketplace!

Questions? Just reply to this email.

Best,
{{senderName}}`,
    variables: ['firstName', 'dealerName', 'signatureUrl', 'senderName']
  },
  {
    name: 'Welcome Email',
    category: 'Onboarding',
    subject: '🎉 Welcome to AutoPosterPro! Your License Key Inside',
    body: `Welcome to AutoPosterPro! 🚗

Thank you for subscribing! Your account for {{dealerName}} is now active.

Your License Key: {{licenseKey}}

Getting Started:
1. Install the AutoPosterPro Chrome extension
2. Click the extension icon and enter your license key
3. Navigate to any vehicle on your dealer website
4. Click "Scrape" to capture vehicle details
5. Click "Post to Facebook" to list instantly!

Need help? We offer free onboarding calls to get you set up. Reply to this email to schedule yours!

Happy selling! 🎉
The AutoPosterPro Team`,
    variables: ['dealerName', 'licenseKey']
  },
  {
    name: 'Onboarding Call Scheduled',
    category: 'Onboarding',
    subject: 'Your AutoPosterPro Setup Call is Confirmed',
    body: `Hi {{firstName}},

Your AutoPosterPro onboarding call is scheduled!

📅 Date: {{callDate}}
⏰ Time: {{callTime}}
📞 We'll call you at: {{phone}}

What we'll cover:
• Install the Chrome extension
• Enter your license key
• Post your first vehicle together
• Answer any questions

Make sure you're at your computer with Chrome browser installed.

See you then!
{{senderName}}`,
    variables: ['firstName', 'callDate', 'callTime', 'phone', 'senderName']
  },
  {
    name: 'Check-in (Week 1)',
    category: 'Onboarding',
    subject: 'How\'s it going with AutoPosterPro?',
    body: `Hi {{firstName}},

You've been using AutoPosterPro for about a week now. How's it going?

Quick questions:
• Have you been able to post vehicles easily?
• Are you getting inquiries from Facebook?
• Any features you wish you had?

I'd love to hear your feedback. Just reply to this email!

Best,
{{senderName}}`,
    variables: ['firstName', 'senderName']
  },
  {
    name: 'Payment Failed',
    category: 'Billing',
    subject: '⚠️ Payment Failed - Action Required',
    body: `Hi {{firstName}},

We were unable to process your payment of ${{amount}} for {{dealerName}}'s AutoPosterPro subscription.

Please update your payment method to avoid interruption to your service:
https://autoposterpro.com/account

Questions? Contact us at support@autoposterpro.com

Thanks,
The AutoPosterPro Team`,
    variables: ['firstName', 'amount', 'dealerName']
  },
  {
    name: 'Subscription Cancelled',
    category: 'Billing',
    subject: 'Your AutoPosterPro Subscription Has Been Cancelled',
    body: `Hi {{firstName}},

Your AutoPosterPro subscription for {{dealerName}} has been cancelled.

Your license key has been deactivated. If this was a mistake or you'd like to resubscribe, you can do so anytime at:
https://autoposterpro.com/pricing

We'd love your feedback! What could we have done better? Reply to this email and let us know.

Best,
The AutoPosterPro Team`,
    variables: ['firstName', 'dealerName']
  }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Only allow POST with admin key
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Admin access required' });
  }
  
  try {
    const created = [];
    
    for (const template of DEFAULT_TEMPLATES) {
      const templateId = `template:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const templateRecord = {
        id: templateId,
        name: template.name,
        subject: template.subject,
        body: template.body,
        category: template.category,
        variables: template.variables || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0
      };
      
      await kv.set(templateId, templateRecord);
      await kv.lpush('email-templates', templateId);
      
      created.push(template.name);
      
      // Small delay to ensure unique timestamps
      await new Promise(r => setTimeout(r, 10));
    }
    
    return res.status(200).json({ 
      success: true, 
      created: created.length,
      templates: created
    });
    
  } catch (error) {
    console.error('Seed templates error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
