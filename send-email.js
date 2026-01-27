// CRM Email API
// Send emails with open tracking and attachments

import { kv } from '../../lib/redis.js';
import { Resend } from 'resend';
import { promises as fs } from 'fs';
import path from 'path';

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://www.autoposterpro.com';

// Available sales attachments
const SALES_ATTACHMENTS = {
  'pitch-deck': {
    name: 'AutoPosterPro-PitchDeck.pdf',
    path: '/assets/sales/AutoPosterPro-PitchDeck.pdf',
    description: 'Full Pitch Deck (PDF)'
  },
  'one-pager': {
    name: 'AutoPosterPro-OnePager.pdf',
    path: '/assets/sales/AutoPosterPro-OnePager.pdf',
    description: 'One-Page Overview'
  },
  'workflow': {
    name: 'AutoPosterPro-Workflow.pdf',
    path: '/assets/sales/AutoPosterPro-Workflow.pdf',
    description: 'How It Works Guide'
  },
  'roi': {
    name: 'AutoPosterPro-ROI.pdf',
    path: '/assets/sales/AutoPosterPro-ROI.pdf',
    description: 'ROI Calculator'
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET - Return available attachments
  if (req.method === 'GET') {
    return res.json({ attachments: SALES_ATTACHMENTS });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const authKey = req.headers.authorization?.replace('Bearer ', '');
  if (!authKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const { leadId, to, subject, body, trackOpens, sender, attachments, templateId, variables } = req.body;
    
    let finalSubject = subject;
    let finalBody = body;
    
    // Load template if specified
    if (templateId) {
      const template = await kv.get(templateId);
      if (template) {
        finalSubject = finalSubject || template.subject;
        finalBody = finalBody || template.body;
        
        // Increment usage count
        template.usageCount = (template.usageCount || 0) + 1;
        template.lastUsedAt = new Date().toISOString();
        await kv.set(templateId, template);
      }
    }
    
    // Replace variables in subject and body
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        finalSubject = finalSubject.replace(regex, value || '');
        finalBody = finalBody.replace(regex, value || '');
      }
    }
    
    if (!to || !finalSubject || !finalBody) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    }
    
    // Generate tracking ID
    const trackingId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Add tracking pixel if requested
    let htmlBody = finalBody.replace(/\n/g, '<br>');
    if (trackOpens) {
      const trackingPixel = `<img src="${BASE_URL}/api/crm/track-open?id=${trackingId}" width="1" height="1" style="display:none;" />`;
      htmlBody += trackingPixel;
    }
    
    // Wrap in nice template
    const fullHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${htmlBody}
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
          <p>AutoPosterPro | <a href="${BASE_URL}" style="color: #7c3aed;">autoposterpro.com</a></p>
        </div>
      </div>
    `;
    
    // Build email options
    const emailOptions = {
      from: 'AutoPosterPro <support@autoposterpro.com>',
      to: to,
      subject: finalSubject,
      html: fullHtml
    };
    
    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      emailOptions.attachments = [];
      
      for (const attachmentId of attachments) {
        const attachment = SALES_ATTACHMENTS[attachmentId];
        if (attachment) {
          // For Resend, we can use URL-based attachments
          emailOptions.attachments.push({
            filename: attachment.name,
            path: `${BASE_URL}${attachment.path}`
          });
        }
      }
    }
    
    // Send email
    const result = await resend.emails.send(emailOptions);
    
    // Store email record
    const emailRecord = {
      id: trackingId,
      leadId: leadId || null,
      to,
      subject: finalSubject,
      body: finalBody,
      templateId: templateId || null,
      variables: variables || null,
      sender: sender || 'System',
      attachments: attachments || [],
      sentAt: new Date().toISOString(),
      opened: false,
      openedAt: null,
      openCount: 0
    };
    
    await kv.set(trackingId, emailRecord);
    await kv.lpush('sent-emails', trackingId);
    
    // Update lead's email history if leadId provided
    if (leadId) {
      const lead = await kv.get(leadId);
      if (lead) {
        lead.emails = lead.emails || [];
        lead.emails.unshift({
          id: trackingId,
          subject: finalSubject,
          sentAt: new Date().toISOString(),
          opened: false,
          attachments: attachments || []
        });
        
        lead.activities = lead.activities || [];
        lead.activities.unshift({
          type: 'email',
          content: `Email sent: "${finalSubject}"${attachments?.length ? ` (with ${attachments.length} attachment${attachments.length > 1 ? 's' : ''})` : ''}`,
          time: new Date().toISOString()
        });
        
        lead.lastContact = new Date().toISOString();
        lead.updatedAt = new Date().toISOString();
        
        await kv.set(leadId, lead);
      }
    }
    
    return res.status(200).json({ 
      success: true, 
      emailId: trackingId,
      message: 'Email sent successfully',
      attachmentCount: attachments?.length || 0
    });
    
  } catch (error) {
    console.error('CRM Email send error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
