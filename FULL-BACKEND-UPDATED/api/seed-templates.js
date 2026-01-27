// api/seed-templates.js
// One-time endpoint to seed email templates into database
import { kv } from '../lib/redis.js';

// Pre-built Email Templates
const EMAIL_TEMPLATES = {
  cold_intro: {
    name: 'Cold Introduction',
    category: 'Introduction',
    subject: 'Save 10+ Hours/Week on Vehicle Listings - {{dealerName}}',
    body: `Hi {{firstName}},

I noticed {{dealerName}} is actively listing vehicles on Facebook Marketplace - that's smart! It's where the buyers are.

But here's the thing: manually posting each vehicle takes 5-10 minutes. With 50+ vehicles in inventory, that's 4-8 hours per week of tedious copy-paste work.

What if you could post a vehicle in 30 seconds?

AutoPosterPro is a Chrome extension that:
• Scrapes vehicle data directly from your DMS/website
• Auto-fills Facebook Marketplace listings
• Includes all photos, price, description - everything

Dealers using AutoPosterPro save 10+ hours per week and report 30-40% more inquiries from Marketplace.

Worth a quick 15-minute demo? I can show you exactly how it works with YOUR inventory.

Reply "yes" and I'll send over some times.

Best,
{{senderName}}`
  },

  warm_intro: {
    name: 'Warm Introduction (Referral)',
    category: 'Introduction',
    subject: '{{referralName}} suggested I reach out - Facebook Marketplace tool',
    body: `Hi {{firstName}},

{{referralName}} from {{referralDealer}} mentioned you might be interested in how they've been crushing it on Facebook Marketplace lately.

They're using AutoPosterPro - a Chrome extension that posts vehicles to Marketplace in about 30 seconds (instead of 5-10 minutes manually).

{{referralName}} told me they've seen a 40% increase in Marketplace leads since switching. Happy to show you the same setup.

Quick 15-minute demo work for you this week?

Best,
{{senderName}}`
  },

  follow_up_1: {
    name: 'Follow Up #1 (3 days)',
    category: 'Follow-up',
    subject: 'Re: Save 10+ Hours/Week on Vehicle Listings',
    body: `Hi {{firstName}},

Just floating this back to the top of your inbox.

I know things get busy at the dealership - especially with month-end coming up.

If you're still manually posting vehicles to Facebook Marketplace, I'd love to show you a faster way. Most dealers tell me they wish they'd found AutoPosterPro sooner.

Got 15 minutes this week?

Best,
{{senderName}}`
  },

  follow_up_2: {
    name: 'Follow Up #2 (7 days)',
    category: 'Follow-up',
    subject: 'Quick question about Marketplace listings',
    body: `Hi {{firstName}},

Quick question: Who at {{dealerName}} handles your Facebook Marketplace listings?

I've got a tool that cuts posting time from 5-10 minutes per vehicle down to 30 seconds. Would love to connect with the right person.

If that's you - great! If not, could you point me in the right direction?

Thanks,
{{senderName}}`
  },

  follow_up_3: {
    name: 'Follow Up #3 (14 days) - Breakup',
    category: 'Follow-up',
    subject: 'Should I close your file?',
    body: `Hi {{firstName}},

I've reached out a few times about AutoPosterPro and haven't heard back.

No worries - I know dealership life is crazy busy.

I'm going to assume the timing isn't right and close out your file for now. But if you ever want to chat about faster Marketplace posting, I'm just an email away.

All the best,
{{senderName}}

P.S. If you're just swamped and still interested, reply "busy" and I'll check back in a month.`
  },

  demo_confirmation: {
    name: 'Demo Confirmation',
    category: 'Demo',
    subject: 'Confirmed: AutoPosterPro Demo - {{demoDate}}',
    body: `Hi {{firstName}},

Great talking with you! Looking forward to our demo.

Here are the details:
📅 Date: {{demoDate}}
⏰ Time: {{demoTime}}
📍 How: I'll call you at {{contactPhone}}

What we'll cover (15 min):
1. Quick walkthrough of AutoPosterPro
2. Live demo using YOUR actual inventory
3. Pricing and next steps

To make the most of our time, please have Chrome open on a computer with access to your dealer website.

See you soon!

{{senderName}}`
  },

  demo_reminder: {
    name: 'Demo Reminder (1 day before)',
    category: 'Demo',
    subject: 'Tomorrow: AutoPosterPro Demo at {{demoTime}}',
    body: `Hi {{firstName}},

Quick reminder about our AutoPosterPro demo tomorrow at {{demoTime}}.

I'll call you at {{contactPhone}}.

Please have Chrome open on a computer with access to your dealer website - I'll show you how fast we can post one of YOUR vehicles.

Talk tomorrow!

{{senderName}}`
  },

  demo_no_show: {
    name: 'Demo No-Show Follow Up',
    category: 'Demo',
    subject: 'Missed you today - want to reschedule?',
    body: `Hi {{firstName}},

I tried calling for our demo today but didn't catch you.

No worries - dealership emergencies happen! I totally get it.

Want to reschedule? Just reply with a couple times that work better for you.

Best,
{{senderName}}`
  },

  proposal_send: {
    name: 'Proposal/Quote',
    category: 'Proposal',
    subject: 'AutoPosterPro Proposal for {{dealerName}}',
    body: `Hi {{firstName}},

Thanks for taking the time to see AutoPosterPro in action! Here's the proposal we discussed:

**AutoPosterPro Professional**
• $99/month (or $948/year - save $240!)
• Unlimited vehicle postings
• All DMS integrations included
• Free setup and training
• Email support

**What's included:**
✓ Chrome extension license
✓ 1-on-1 setup call
✓ Ongoing support
✓ All future updates

**ROI:**
If AutoPosterPro saves just 1 hour per week, that's 52 hours/year.
At $20/hour, that's $1,040 in time savings - more than the annual cost!

Plus dealers report 30-40% more Marketplace leads.

Ready to get started? Reply "let's do it" and I'll send over the signup link.

Best,
{{senderName}}`
  },

  proposal_follow_up: {
    name: 'Proposal Follow Up',
    category: 'Proposal',
    subject: 'Re: AutoPosterPro Proposal - any questions?',
    body: `Hi {{firstName}},

Just checking in on the proposal I sent over for AutoPosterPro.

Any questions I can answer? Happy to hop on a quick call if that's easier.

If you're ready to move forward, just reply and I'll get you set up this week.

Best,
{{senderName}}`
  },

  objection_price: {
    name: 'Handle Price Objection',
    category: 'Closing',
    subject: 'Re: AutoPosterPro pricing',
    body: `Hi {{firstName}},

I totally understand wanting to make sure the investment makes sense.

Let me break down the math:

**Time Savings:**
• Manual posting: 5-10 min/vehicle
• With AutoPosterPro: 30 seconds/vehicle
• With 50 vehicles/month: 4-8 hours saved

**Value of Time:**
• 6 hours/month × $20/hour = $120/month in labor
• AutoPosterPro: $99/month
• Net savings: $21/month PLUS more leads

**Lead Generation:**
• Dealers report 30-40% more Marketplace inquiries
• Just ONE extra sale covers the annual subscription

The question isn't "can we afford it?" - it's "can we afford NOT to have it?"

Want me to set you up with a 14-day trial so you can see the results for yourself?

Best,
{{senderName}}`
  },

  objection_timing: {
    name: 'Handle Timing Objection',
    category: 'Closing',
    subject: 'Re: AutoPosterPro - when timing is better',
    body: `Hi {{firstName}},

I hear you - timing is everything in the car business.

Here's the thing though: every week without AutoPosterPro is:
• 4-8 hours of manual posting work
• Potentially 30-40% fewer Marketplace leads
• More frustration for your team

The setup takes just 15 minutes. Once it's installed, you're saving time immediately.

What if we got you set up now, and you started seeing results by end of week?

Let me know - I can have you up and running today.

Best,
{{senderName}}`
  },

  welcome: {
    name: 'Welcome Email',
    category: 'Onboarding',
    subject: '🎉 Welcome to AutoPosterPro! Your License Key Inside',
    body: `Hi {{firstName}},

Welcome to AutoPosterPro! 🚗

Your license key: {{licenseKey}}

**Next Steps:**

1. Download Chrome Extension
   → We'll schedule a call to install it together

2. Setup Call (15 min)
   → We'll walk through the extension
   → Post your first vehicle together
   → Answer any questions

I'll reach out within 24 hours to schedule your setup call.

In the meantime, if you have questions, just reply to this email.

Excited to help {{dealerName}} sell more cars!

{{senderName}}`
  },

  setup_scheduled: {
    name: 'Setup Call Scheduled',
    category: 'Onboarding',
    subject: 'Setup Call Confirmed - {{setupDate}}',
    body: `Hi {{firstName}},

Your AutoPosterPro setup call is confirmed!

📅 Date: {{setupDate}}
⏰ Time: {{setupTime}}
📍 Call: I'll call you at {{contactPhone}}

**Please have ready:**
• Computer with Chrome browser
• Access to your dealer website
• Your license key: {{licenseKey}}

The call takes about 15 minutes. By the end, you'll be posting vehicles in seconds!

Talk soon,
{{senderName}}`
  },

  onboarding_check_in: {
    name: 'Onboarding Check-In (1 week)',
    category: 'Onboarding',
    subject: "How's AutoPosterPro working for you?",
    body: `Hi {{firstName}},

It's been a week since we got you set up with AutoPosterPro!

Quick check-in:
• How many vehicles have you posted?
• Any questions or issues?
• Is everything working smoothly?

If you're loving it, I'd really appreciate a quick Google review - helps other dealers find us!

If you're having any trouble, just reply and I'll help right away.

Best,
{{senderName}}`
  },

  renewal_reminder: {
    name: 'Renewal Reminder (7 days before)',
    category: 'Renewal',
    subject: 'Your AutoPosterPro subscription renews soon',
    body: `Hi {{firstName}},

Just a heads up - your AutoPosterPro subscription for {{dealerName}} will renew on {{renewalDate}}.

**Your plan:** {{plan}}
**Amount:** {{amount}}

No action needed if you want to continue (we hope you do!).

If you have any questions about your subscription, just reply to this email.

Thanks for being a customer!

{{senderName}}`
  },

  win_back: {
    name: 'Win-Back (Cancelled Customer)',
    category: 'Win-back',
    subject: 'We miss you at AutoPosterPro',
    body: `Hi {{firstName}},

I noticed {{dealerName}} cancelled AutoPosterPro a while back.

I wanted to reach out because we've made some big improvements:
• Faster posting (now just 20 seconds!)
• Better photo handling
• New DMS integrations
• Improved support

Would you be open to giving it another try? I can set you up with a free month to see the improvements.

Just reply "yes" and I'll get you sorted.

Best,
{{senderName}}`
  }
};

export default async function handler(req, res) {
  // Allow GET for easy browser access with query param
  const secret = req.query.secret || req.headers.authorization?.replace('Bearer ', '');
  const adminSecret = process.env.ADMIN_SECRET_KEY;
  
  if (!adminSecret || secret !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized - provide ?secret=YOUR_ADMIN_SECRET' });
  }

  try {
    let seeded = 0;
    const results = [];

    for (const [id, template] of Object.entries(EMAIL_TEMPLATES)) {
      const templateData = {
        id,
        ...template,
        isDefault: true,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store in KV
      await kv.set(`template:${id}`, templateData);
      results.push({ id, name: template.name, category: template.category });
      seeded++;
    }

    // Store template index
    const templateIndex = Object.keys(EMAIL_TEMPLATES);
    await kv.set('templates:index', templateIndex);

    return res.status(200).json({
      success: true,
      message: `Seeded ${seeded} email templates`,
      templates: results
    });

  } catch (error) {
    console.error('Seed error:', error);
    return res.status(500).json({ error: 'Failed to seed templates', details: error.message });
  }
}
