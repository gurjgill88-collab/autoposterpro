// api/templates.js
// Email templates API
import { kv } from '../lib/redis.js';

export default async function handler(req, res) {
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check permissions
  const canViewTemplates = ['super_admin', 'admin', 'manager', 'sales'].includes(user.role);
  if (!canViewTemplates) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  if (req.method === 'GET') {
    try {
      const templateIndex = await kv.get('templates:index') || [];
      const templates = [];

      for (const templateId of templateIndex) {
        const template = await kv.get(`template:${templateId}`);
        if (template) {
          templates.push(template);
        }
      }

      // Sort by category then name
      templates.sort((a, b) => {
        if (a.category !== b.category) {
          return (a.category || '').localeCompare(b.category || '');
        }
        return (a.name || '').localeCompare(b.name || '');
      });

      return res.status(200).json({ templates });
    } catch (error) {
      console.error('Templates error:', error);
      return res.status(500).json({ error: 'Failed to fetch templates' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
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
