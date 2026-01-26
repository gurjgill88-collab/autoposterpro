// Admin API for License Management
// Protected by admin key

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Check admin authorization
  const adminKey = req.headers.authorization?.replace('Bearer ', '');
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // GET - List all licenses
    if (req.method === 'GET') {
      const keys = await kv.keys('license:*');
      const licenses = [];
      
      for (const key of keys) {
        const license = await kv.get(key);
        licenses.push({
          key: key.replace('license:', ''),
          ...license
        });
      }
      
      return res.status(200).json({ licenses });
    }
    
    // POST - Create new license
    if (req.method === 'POST') {
      const { dealerName, dealerNumber, expiresAt } = req.body;
      
      // Generate unique license key
      const licenseKey = generateLicenseKey();
      
      const license = {
        dealerName: dealerName || '',
        dealerNumber: dealerNumber || '',
        active: true,
        deviceId: null,
        createdAt: new Date().toISOString(),
        activatedAt: null,
        lastUsed: null,
        expiresAt: expiresAt || null
      };
      
      await kv.set(`license:${licenseKey}`, license);
      
      return res.status(201).json({
        success: true,
        licenseKey,
        license
      });
    }
    
    // DELETE - Deactivate license
    if (req.method === 'DELETE') {
      const { licenseKey, permanent } = req.body;
      
      if (!licenseKey) {
        return res.status(400).json({ error: 'License key required' });
      }
      
      if (permanent) {
        await kv.del(`license:${licenseKey}`);
        return res.status(200).json({ 
          success: true, 
          message: 'License permanently deleted' 
        });
      } else {
        const license = await kv.get(`license:${licenseKey}`);
        if (license) {
          license.active = false;
          await kv.set(`license:${licenseKey}`, license);
        }
        return res.status(200).json({ 
          success: true, 
          message: 'License deactivated' 
        });
      }
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

// Generate a unique license key like: APP-XXXX-XXXX-XXXX
function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0,O,1,I
  const segments = [];
  
  for (let s = 0; s < 3; s++) {
    let segment = '';
    for (let i = 0; i < 4; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  
  return 'APP-' + segments.join('-');
}
