// api/dashboard/stats.js
// Dashboard statistics endpoint
import { kv } from '../../lib/redis.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify auth
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Count licenses
    const licenseKeys = await kv.lrange('licenses', 0, -1) || [];
    let activeLicenses = 0;
    let mrr = 0;

    for (const key of licenseKeys) {
      const license = await kv.get(`license:${key}`);
      if (license && license.active) {
        activeLicenses++;
        mrr += license.plan === 'annual' ? 79 : 99;
      }
    }

    // Count deals
    const dealIds = await kv.lrange('deals', 0, -1) || [];
    let openDeals = 0;
    
    for (const dealId of dealIds) {
      const deal = await kv.get(`deal:${dealId}`);
      if (deal && !['won', 'lost'].includes(deal.stage)) {
        openDeals++;
      }
    }

    // Count users
    const userIndex = await kv.get('users:index') || [];
    const activeUsers = userIndex.length;

    return res.status(200).json({
      mrr,
      licenses: activeLicenses,
      deals: openDeals,
      users: activeUsers
    });

  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
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
