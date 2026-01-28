// api/communications/templates.js
// SMS message templates

import { kv } from '../../lib/redis.js';

// Default templates
const DEFAULT_TEMPLATES = [
  {
    id: 'follow-up',
    name: 'Quick Follow-up',
    message: 'Hi {{name}}, just following up on our conversation about AutoPosterPro. Do you have a few minutes to chat?',
    category: 'follow-up'
  },
  {
    id: 'demo-reminder',
    name: 'Demo Reminder',
    message: 'Hi {{name}}, just a friendly reminder about your AutoPosterPro demo scheduled for {{date}}. Looking forward to showing you how we can save your team hours every day!',
    category: 'reminder'
  },
  {
    id: 'thank-you',
    name: 'Thank You',
    message: 'Hi {{name}}, thank you for taking the time to speak with me today! If you have any questions about AutoPosterPro, feel free to text or call anytime.',
    category: 'follow-up'
  },
  {
    id: 'check-in',
    name: 'Check In',
    message: 'Hi {{name}}, hope all is well! Wanted to check in and see if you had any questions about AutoPosterPro. Happy to help!',
    category: 'nurture'
  },
  {
    id: 'pricing',
    name: 'Pricing Info',
    message: 'Hi {{name}}, as discussed, AutoPosterPro starts at $219/month. This includes unlimited vehicle posts, automatic refreshing, and full support. Ready to get started?',
    category: 'sales'
  },
  {
    id: 'trial',
    name: 'Trial Offer',
    message: 'Hi {{name}}, we\'d love to offer you a free trial of AutoPosterPro! See for yourself how much time you can save. Interested?',
    category: 'sales'
  }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // Verify auth
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    // GET - List templates
    if (req.method === 'GET') {
      // Get custom templates
      const customTemplateIds = await kv.lrange('sms-templates', 0, -1) || [];
      const customTemplates = [];
      
      for (const id of customTemplateIds) {
        const template = await kv.get(id);
        if (template) customTemplates.push(template);
      }
      
      // Combine with defaults
      const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];
      
      return res.status(200).json({ templates: allTemplates });
    }
    
    // POST - Create custom template
    if (req.method === 'POST') {
      const { name, message, category } = req.body;
      
      if (!name || !message) {
        return res.status(400).json({ error: 'Name and message required' });
      }
      
      const templateId = `sms-template:${Date.now()}`;
      const template = {
        id: templateId,
        name,
        message,
        category: category || 'custom',
        createdAt: new Date().toISOString(),
        isCustom: true
      };
      
      await kv.set(templateId, template);
      await kv.lpush('sms-templates', templateId);
      
      return res.status(201).json({ success: true, template });
    }
    
    // DELETE - Remove custom template
    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id || !id.startsWith('sms-template:')) {
        return res.status(400).json({ error: 'Invalid template ID' });
      }
      
      await kv.del(id);
      await kv.lrem('sms-templates', 0, id);
      
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('SMS templates error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
