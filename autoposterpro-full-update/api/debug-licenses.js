// Debug endpoint to check KV connection
import { kv } from '../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // List all keys starting with "license:"
    const keys = await kv.keys('license:*');
    
    // Get all licenses
    const licenses = [];
    for (const key of keys) {
      const data = await kv.get(key);
      licenses.push({ key, data });
    }
    
    return res.status(200).json({
      success: true,
      kvConnected: true,
      totalKeys: keys.length,
      keys: keys,
      licenses: licenses
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      kvConnected: false,
      error: error.message
    });
  }
}
