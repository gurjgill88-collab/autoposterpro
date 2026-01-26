// License Validation API
// Vercel Serverless Function

// In production, use Vercel KV or a real database
// For now, we'll use a simple in-memory store that persists via Vercel's edge config
// You'll want to upgrade to Vercel KV or Supabase for production

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
    
    // Get licenses from environment variable (JSON string)
    // In production, use a real database
    const licensesJson = process.env.LICENSES_DB || '{}';
    const licenses = JSON.parse(licensesJson);
    
    const license = licenses[licenseKey];
    
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
        error: 'License has been deactivated' 
      });
    }
    
    // Check expiration
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      return res.status(401).json({ 
        valid: false, 
        error: 'License has expired' 
      });
    }
    
    // Check device binding
    if (license.deviceId && license.deviceId !== deviceId) {
      return res.status(401).json({ 
        valid: false, 
        error: 'License is registered to another device. Contact support.' 
      });
    }
    
    // Return success with dealer info
    return res.status(200).json({
      valid: true,
      dealerName: license.dealerName || '',
      dealerNumber: license.dealerNumber || '',
      expiresAt: license.expiresAt || null
    });
    
  } catch (error) {
    console.error('License validation error:', error);
    return res.status(500).json({ 
      valid: false, 
      error: 'Server error' 
    });
  }
}
