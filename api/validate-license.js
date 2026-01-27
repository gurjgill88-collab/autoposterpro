import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { licenseKey, deviceId } = req.body;
    if (!licenseKey || !deviceId) return res.status(400).json({ valid: false, error: 'Missing fields' });
    
    const license = await kv.get('licenses:' + licenseKey);
    if (!license) return res.status(401).json({ valid: false, error: 'Invalid license key' });
    if (!license.active) return res.status(401).json({ valid: false, error: 'License deactivated' });
    
    if (license.deviceId && license.deviceId !== deviceId) {
      return res.status(401).json({ valid: false, error: 'License on another computer' });
    }
    
    if (!license.deviceId) {
      license.deviceId = deviceId;
      license.activatedAt = new Date().toISOString();
    }
    license.lastUsed = new Date().toISOString();
    await kv.set('licenses:' + licenseKey, license);
    
    return res.status(200).json({ valid: true, dealerName: license.dealerName || '' });
  } catch (error) {
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
}
