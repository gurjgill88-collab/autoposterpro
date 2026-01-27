// lib/redis.js
// Shared Redis client using Upstash
import { Redis } from '@upstash/redis';

// Initialize Redis with environment variables
// Works with both old Vercel KV vars and new Upstash vars
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Export as 'kv' for backward compatibility with existing code
export const kv = redis;
export default redis;
