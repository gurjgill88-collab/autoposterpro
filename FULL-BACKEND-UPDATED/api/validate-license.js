// License Validation API
// Vercel Serverless Function with KV Storage

import { kv } from '../lib/redis.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { licenseKey, deviceId } = req.body;
    
    if (!licenseKey || !deviceId) {
      return res.status(400).json({ 
        valid: false, 
        error: 'License key and device ID required' 
      });
    }
    
    // Get license from KV storage
    const license = await kv.get(`license:${licenseKey}`);
    
    if (!license) {
      return res.status(401).json({ 
        valid: false, 
        error: 'Invalid license key' 
      });
    }
    
    // Check if license is active
    if (!license.active) {
      return res.status(401).json({ 
        valid: false, 
        error: 'License has been deactivated. Contact support to reactivate.' 
      });
    }
    
    // Check expiration
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      return res.status(401).json({ 
        valid: false, 
        error: 'License has expired. Please renew your subscription.' 
      });
    }
    
    // Check device binding (first activation or same device)
    if (license.deviceId && license.deviceId !== deviceId) {
      return res.status(401).json({ 
        valid: false, 
        error: 'License is registered to another computer. Contact support to reset.' 
      });
    }
    
    // First time activation - bind device
    if (!license.deviceId) {
      license.deviceId = deviceId;
      license.activatedAt = new Date().toISOString();
    }
    
    // Update last used timestamp
    license.lastUsed = new Date().toISOString();
    await kv.set(`license:${licenseKey}`, license);
    
    // Return success with dealer info
    return res.status(200).json({
      valid: true,
      dealerName: license.dealerName || '',
      dealerNumber: license.dealerNumber || '',
      expiresAt: license.expiresAt || null,
      plan: license.plan || 'monthly'
    });
    
  } catch (error) {
    console.error('License validation error:', error);
    return res.status(500).json({ 
      valid: false, 
      error: 'Server error. Please try again.' 
    });
  }
}
