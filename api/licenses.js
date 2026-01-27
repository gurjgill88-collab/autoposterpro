// api/licenses.js
// License listing API
import { kv } from '../lib/redis.js';

export default async function handler(req, res) {
  // Verify auth
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check permissions
  const canViewLicenses = ['super_admin', 'admin', 'accounting'].includes(user.role);
  if (!canViewLicenses) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  if (req.method === 'GET') {
    try {
      const licenseKeys = await kv.lrange('licenses', 0, -1) || [];
      const licenses = [];

      for (const key of licenseKeys) {
        const license = await kv.get(`license:${key}`);
        if (license) {
          licenses.push({
            key: license.key,
            dealerName: license.dealerName,
            email: license.email,
            plan: license.plan || 'monthly',
            active: license.active,
            createdAt: license.createdAt,
            activatedAt: license.activatedAt
          });
        }
      }

      return res.status(200).json({ licenses });
    } catch (error) {
      console.error('Licenses error:', error);
      return res.status(500).json({ error: 'Failed to fetch licenses' });
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
