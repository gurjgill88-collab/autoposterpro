// License Activation API
// Vercel Serverless Function with KV Storage

import { kv } from '@vercel/kv';

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
        success: false, 
        error: 'License key and device ID required' 
      });
    }
    
    // Get license from KV store
    const license = await kv.get(`license:${licenseKey}`);
    
    if (!license) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid license key' 
      });
    }
    
    // Check if license is active
    if (!license.active) {
      return res.status(401).json({ 
        success: false, 
        error: 'License has been deactivated' 
      });
    }
    
    // Check if already activated on different device
    if (license.deviceId && license.deviceId !== deviceId) {
      return res.status(401).json({ 
        success: false, 
        error: 'License already activated on another device. Contact support to transfer.' 
      });
    }
    
    // Activate license on this device
    const updatedLicense = {
      ...license,
      deviceId: deviceId,
      activatedAt: license.activatedAt || new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    
    await kv.set(`license:${licenseKey}`, updatedLicense);
    
    return res.status(200).json({
      success: true,
      message: 'License activated successfully',
      dealerName: license.dealerName || '',
      dealerNumber: license.dealerNumber || '',
      expiresAt: license.expiresAt || null
    });
    
  } catch (error) {
    console.error('License activation error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
}
