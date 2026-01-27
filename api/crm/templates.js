// Email Templates API
// CRUD for email templates with categories

import { kv } from '../../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    // GET - List templates
    if (req.method === 'GET') {
      const templateIds = await kv.lrange('email-templates', 0, -1) || [];
      const templates = [];
      
      for (const id of templateIds) {
        const template = await kv.get(id);
        if (template) templates.push(template);
      }
      
      // Sort by category
      templates.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
      
      return res.status(200).json({ templates });
    }
    }
    
    // POST - Create template
    if (req.method === 'POST') {
      const { name, subject, body, category, variables } = req.body;
      
      if (!name || !subject || !body) {
        return res.status(400).json({ error: 'Name, subject, and body required' });
      }
      
      const templateId = `template:${Date.now()}`;
      const template = {
        id: templateId,
        name,
        subject,
        body,
        category: category || 'General',
        variables: variables || [], // e.g., ['firstName', 'dealerName', 'price']
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0
      };
      
      await kv.set(templateId, template);
      await kv.lpush('email-templates', templateId);
      
      return res.status(201).json({ success: true, template });
    }
    
    // PUT - Update template
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      
      if (!id) return res.status(400).json({ error: 'Template ID required' });
      
      const template = await kv.get(id);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      
      const updatedTemplate = {
        ...template,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(id, updatedTemplate);
      
      return res.status(200).json({ success: true, template: updatedTemplate });
    }
    
    // DELETE - Delete template
    if (req.method === 'DELETE') {
      const { id } = req.body;
      
      if (!id) return res.status(400).json({ error: 'Template ID required' });
      
      await kv.del(id);
      await kv.lrem('email-templates', 1, id);
      
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Email templates error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
