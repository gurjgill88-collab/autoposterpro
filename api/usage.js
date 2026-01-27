// Usage Tracking API
// Track extension usage per dealer/user

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    // POST - Track usage event (called from extension)
    if (req.method === 'POST') {
      const { licenseKey, event, metadata } = req.body;
      
      if (!licenseKey || !event) {
        return res.status(400).json({ error: 'License key and event required' });
      }
      
      const today = new Date().toISOString().split('T')[0];
      const usageKey = `usage:${licenseKey}:${today}`;
      
      // Get or create today's usage record
      let usage = await kv.get(usageKey) || {
        licenseKey,
        date: today,
        events: {},
        totalActions: 0
      };
      
      // Increment event count
      usage.events[event] = (usage.events[event] || 0) + 1;
      usage.totalActions++;
      usage.lastActivity = new Date().toISOString();
      
      // Store metadata if provided
      if (metadata) {
        usage.lastMetadata = metadata;
      }
      
      await kv.set(usageKey, usage);
      
      // Also update aggregate stats
      const statsKey = `stats:${licenseKey}`;
      let stats = await kv.get(statsKey) || {
        licenseKey,
        totalScrapes: 0,
        totalPosts: 0,
        totalClicks: 0,
        firstUsed: new Date().toISOString(),
        lastUsed: null,
        activeDays: 0
      };
      
      if (event === 'scrape') stats.totalScrapes++;
      if (event === 'post') stats.totalPosts++;
      if (event === 'click') stats.totalClicks++;
      stats.lastUsed = new Date().toISOString();
      
      await kv.set(statsKey, stats);
      
      // Track active licenses for the day
      await kv.sadd(`active:${today}`, licenseKey);
      
      return res.status(200).json({ success: true });
    }
    
    // GET - Get usage stats (admin)
    if (req.method === 'GET') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ error: 'Admin access required' });
      }
      
      const { licenseKey, period } = req.query;
      
      // Get specific license stats
      if (licenseKey) {
        const stats = await kv.get(`stats:${licenseKey}`) || {};
        
        // Get last 30 days of usage
        const dailyUsage = [];
        for (let i = 0; i < 30; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          const usage = await kv.get(`usage:${licenseKey}:${dateStr}`);
          if (usage) dailyUsage.push(usage);
        }
        
        return res.status(200).json({ stats, dailyUsage });
      }
      
      // Get aggregate stats
      const today = new Date().toISOString().split('T')[0];
      const activeToday = await kv.smembers(`active:${today}`) || [];
      
      // Get all license stats
      const licenseKeys = await kv.keys('stats:*') || [];
      const allStats = [];
      
      for (const key of licenseKeys) {
        const stat = await kv.get(key);
        if (stat) allStats.push(stat);
      }
      
      // Aggregate
      const totalScrapes = allStats.reduce((sum, s) => sum + (s.totalScrapes || 0), 0);
      const totalPosts = allStats.reduce((sum, s) => sum + (s.totalPosts || 0), 0);
      
      return res.status(200).json({
        activeToday: activeToday.length,
        totalLicenses: allStats.length,
        totalScrapes,
        totalPosts,
        licenses: allStats.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
      });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Usage tracking error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
