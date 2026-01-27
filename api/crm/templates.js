// Email Templates API
import { kv } from '../../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    if (req.method === 'GET') {
      let templates = [];
      
      try {
        const templateIndex = await kv.get('templates:index');
        if (templateIndex && Array.isArray(templateIndex)) {
          for (const id of templateIndex) {
            const template = await kv.get(`template:${id}`);
            if (template) templates.push(template);
          }
        }
      } catch (e) {}
      
      try {
        const templateIds = await kv.lrange('email-templates', 0, -1) || [];
        for (const id of templateIds) {
          const template = await kv.get(id);
          if (template && !templates.find(t => t.id === template.id)) {
            templates.push(template);
          }
        }
      } catch (e) {}
      
      templates.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
      
      return res.status(200).json({ templates });
    }
    
    if (req.method === 'POST') {
      const { name, subject, body, category } = req.body;
      
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
        createdAt: new Date().toISOString(),
        usageCount: 0
      };
      
      await kv.set(templateId, template);
      await kv.lpush('email-templates', templateId);
      
      return res.status(201).json({ success: true, template });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
}
