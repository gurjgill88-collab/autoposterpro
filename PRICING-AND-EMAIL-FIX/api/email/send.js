// api/email/send.js
// Send emails via Resend with tracking
import { kv } from '../../lib/redis.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify auth
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { to, toName, subject, body, templateId, dealId, variables } = req.body;

  if (!to || !subject) {
    return res.status(400).json({ error: 'To and subject are required' });
  }

  try {
    let emailBody = body;
    let templateName = 'Custom';

    // If using template, get it and replace variables
    if (templateId) {
      const template = await kv.get(`template:${templateId}`);
      if (template) {
        emailBody = replaceVariables(template.body, variables || {});
        templateName = template.name;
        
        // Update template usage count
        template.usageCount = (template.usageCount || 0) + 1;
        template.lastUsed = new Date().toISOString();
        await kv.set(`template:${templateId}`, template);
      }
    }

    // Replace any remaining variables in subject too
    const emailSubject = replaceVariables(subject, variables || {});

    // Send via Resend
    const { data, error } = await resend.emails.send({
      from: 'AutoPosterPro <noreply@autoposterpro.com>',
      to: [to],
      subject: emailSubject,
      html: formatEmailHtml(emailBody, toName),
      headers: {
        'X-Entity-Ref-ID': dealId || `email_${Date.now()}`
      }
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Store email record for tracking
    const emailRecord = {
      id: data.id,
      resendId: data.id,
      to,
      toName,
      subject: emailSubject,
      templateId,
      templateName,
      dealId,
      sentBy: user.id,
      sentByName: user.name || user.email,
      sentAt: new Date().toISOString(),
      status: 'sent',
      opens: 0,
      clicks: 0,
      events: []
    };

    await kv.set(`email:${data.id}`, emailRecord);
    
    // Add to email list
    await kv.lpush('emails:sent', data.id);

    // If associated with a deal, update deal's last activity
    if (dealId) {
      const deal = await kv.get(`deal:${dealId}`);
      if (deal) {
        deal.lastActivity = new Date().toISOString();
        deal.lastActivityType = 'email_sent';
        deal.lastActivityBy = user.name || user.email;
        
        // Add to deal's email list
        if (!deal.emails) deal.emails = [];
        deal.emails.push(data.id);
        
        await kv.set(`deal:${dealId}`, deal);
      }
    }

    return res.status(200).json({
      success: true,
      emailId: data.id,
      message: `Email sent to ${to}`
    });

  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}

function replaceVariables(text, variables) {
  if (!text) return '';
  
  let result = text;
  
  // Replace {{variable}} patterns
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(pattern, value || '');
  }
  
  return result;
}

function formatEmailHtml(body, recipientName) {
  // Convert line breaks to HTML if not already HTML
  const htmlBody = body.includes('<') ? body : body.replace(/\n/g, '<br>');
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: 700; color: #7c3aed; }
    .logo span { color: #f97316; }
    .content { padding: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
    a { color: #7c3aed; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Auto<span>Poster</span>Pro</div>
  </div>
  
  <div class="content">
    ${htmlBody}
  </div>
  
  <div class="footer">
    <p>Sent by AutoPosterPro - The #1 Facebook Marketplace Posting Tool for Car Dealers</p>
    <p><a href="https://www.autoposterpro.com">www.autoposterpro.com</a></p>
  </div>
</body>
</html>
`;
}

async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
