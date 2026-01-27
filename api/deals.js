// api/deals.js
// Deals API
import { kv } from '../lib/redis.js';

export default async function handler(req, res) {
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check permissions
  const canViewDeals = ['super_admin', 'admin', 'manager', 'sales'].includes(user.role);
  if (!canViewDeals) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getDeals(req, res, user);
      case 'POST':
        return await createDeal(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Deals error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getDeals(req, res, user) {
  const dealIds = await kv.lrange('deals', 0, -1) || [];
  const deals = [];

  for (const dealId of dealIds) {
    const deal = await kv.get(`deal:${dealId}`);
    if (deal) {
      // Sales reps only see their own deals
      if (user.role === 'sales' && deal.ownerId !== user.id) {
        continue;
      }
      deals.push(deal);
    }
  }

  // Sort by updated date
  deals.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  return res.status(200).json({ deals });
}

async function createDeal(req, res, user) {
  const { dealerName, contactName, contactEmail, contactPhone, value, stage, notes } = req.body;

  if (!dealerName) {
    return res.status(400).json({ error: 'Dealer name is required' });
  }

  const dealId = `deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const deal = {
    id: dealId,
    dealerName,
    contactName: contactName || '',
    contactEmail: contactEmail || '',
    contactPhone: contactPhone || '',
    value: value || 0,
    stage: stage || 'lead',
    notes: notes || '',
    ownerId: user.id,
    ownerName: user.name || user.email,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await kv.set(`deal:${dealId}`, deal);
  await kv.lpush('deals', dealId);

  return res.status(201).json({ success: true, deal });
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
