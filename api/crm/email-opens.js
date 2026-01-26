// Email Opens API
// Get recent email opens for dashboard notifications

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const authKey = req.headers.authorization?.replace('Bearer ', '');
  if (!authKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const { since, limit } = req.query;
    
    // Get recent opens
    const opens = await kv.lrange('email-opens', 0, parseInt(limit) || 50) || [];
    
    // Parse JSON strings
    let parsedOpens = opens.map(o => {
      try {
        return typeof o === 'string' ? JSON.parse(o) : o;
      } catch {
        return o;
      }
    });
    
    // Filter by date if 'since' provided
    if (since) {
      const sinceDate = new Date(since);
      parsedOpens = parsedOpens.filter(o => new Date(o.openedAt) > sinceDate);
    }
    
    // Get today's opens
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOpens = parsedOpens.filter(o => new Date(o.openedAt) >= today);
    
    return res.status(200).json({ 
      opens: parsedOpens,
      todayCount: todayOpens.length,
      todayOpens
    });
    
  } catch (error) {
    console.error('Email opens API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
