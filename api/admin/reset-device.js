// Reset Device API
// Allows admin to unbind a license from its device

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Check admin authorization
  const adminKey = req.headers.authorization?.replace('Bearer ', '');
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const { licenseKey } = req.body;
    
    if (!licenseKey) {
      return res.status(400).json({ error: 'License key required' });
    }
    
    const license = await kv.get(`license:${licenseKey}`);
    
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    
    // Reset device binding
    license.deviceId = null;
    license.activatedAt = null;
    
    await kv.set(`license:${licenseKey}`, license);
    
    return res.status(200).json({
      success: true,
      message: 'Device binding reset. License can now be activated on a new device.'
    });
    
  } catch (error) {
    console.error('Reset device error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
