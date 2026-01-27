// api/debug-full.js
// Test auth AND database connection

import { kv } from '../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const providedKey = req.headers.authorization?.replace('Bearer ', '') || req.query.key || '';
  const envKey = process.env.ADMIN_SECRET_KEY || '';
  
  const result = {
    step1_authCheck: providedKey === envKey,
    step2_kvUrlExists: !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
    step3_kvTokenExists: !!(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
    step4_dbTest: null,
    step5_keysTest: null,
    error: null
  };

  // Test basic Redis connection
  try {
    await kv.set('test:ping', 'pong');
    const pong = await kv.get('test:ping');
    result.step4_dbTest = pong === 'pong' ? 'SUCCESS' : 'FAILED';
  } catch (err) {
    result.step4_dbTest = 'ERROR';
    result.error = err.message;
  }

  // Test keys() function (this is what admin/licenses uses)
  try {
    const keys = await kv.keys('license:*');
    result.step5_keysTest = `SUCCESS - found ${keys.length} licenses`;
  } catch (err) {
    result.step5_keysTest = 'ERROR';
    result.error = result.error || err.message;
  }

  return res.status(200).json(result);
}
