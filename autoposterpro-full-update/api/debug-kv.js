// Debug endpoint to check KV storage
// DELETE THIS FILE AFTER DEBUGGING

import { kv } from '../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // List all license keys
    const keys = await kv.keys('license:*');
    
    // Get all licenses
    const licenses = [];
    for (const key of keys) {
      const data = await kv.get(key);
      licenses.push({ key, data });
    }
    
    return res.status(200).json({
      totalKeys: keys.length,
      keys: keys,
      licenses: licenses,
      kvConnected: true
    });
    
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      kvConnected: false
    });
  }
}
