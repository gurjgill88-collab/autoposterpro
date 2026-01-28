// api/agreements/view.js
// Track agreement views

import { kv } from '../../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { id, token } = req.body;
    
    if (!id || !token) {
      return res.status(400).json({ error: 'Agreement ID and token required' });
    }
    
    const agreement = await kv.get(id);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }
    
    // Verify token
    if (agreement.signatureToken !== token) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    // Update view count
    agreement.viewCount = (agreement.viewCount || 0) + 1;
    agreement.lastViewedAt = new Date().toISOString();
    
    // Update status to viewed if still pending
    if (agreement.status === 'pending') {
      agreement.status = 'viewed';
    }
    
    await kv.set(id, agreement);
    
    return res.status(200).json({ success: true, viewCount: agreement.viewCount });
    
  } catch (error) {
    console.error('View tracking error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
