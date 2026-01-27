import { kv } from '../lib/redis.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // POST - Track an event
    if (req.method === 'POST') {
      const { licenseKey, event, data } = req.body;
      
      if (!licenseKey || !event) {
        return res.status(400).json({ error: 'Missing licenseKey or event' });
      }
      
      // Verify license exists
      const license = await kv.get(`license:${licenseKey}`);
      if (!license) {
        return res.status(401).json({ error: 'Invalid license' });
      }
      
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const hourKey = now.getHours();
      
      // Create analytics record
      const analyticsKey = `analytics:${licenseKey}:${dateKey}`;
      let dailyStats = await kv.get(analyticsKey) || {
        date: dateKey,
        licenseKey,
        dealerName: license.dealerName,
        posts: 0,
        scrapes: 0,
        aiDescriptions: 0,
        sessionsStarted: 0,
        totalTimeSeconds: 0,
        hourlyActivity: {},
        vehicles: []
      };
      
      // Update based on event type
      switch (event) {
        case 'post_created':
          dailyStats.posts += 1;
          dailyStats.vehicles.push({
            timestamp: now.toISOString(),
            vin: data?.vin || 'unknown',
            year: data?.year,
            make: data?.make,
            model: data?.model,
            price: data?.price,
            timeToPost: data?.timeToPost // seconds from scrape to post
          });
          break;
          
        case 'scrape_completed':
          dailyStats.scrapes += 1;
          break;
          
        case 'ai_description_generated':
          dailyStats.aiDescriptions += 1;
          break;
          
        case 'session_start':
          dailyStats.sessionsStarted += 1;
          // Track hourly activity
          dailyStats.hourlyActivity[hourKey] = (dailyStats.hourlyActivity[hourKey] || 0) + 1;
          break;
          
        case 'session_end':
          if (data?.durationSeconds) {
            dailyStats.totalTimeSeconds += data.durationSeconds;
          }
          break;
          
        case 'heartbeat':
          // Update time tracking (sent every minute while active)
          dailyStats.totalTimeSeconds += 60;
          dailyStats.hourlyActivity[hourKey] = (dailyStats.hourlyActivity[hourKey] || 0) + 1;
          break;
      }
      
      // Save daily stats (expire after 365 days)
      await kv.set(analyticsKey, dailyStats, { ex: 365 * 24 * 60 * 60 });
      
      // Update lifetime stats
      const lifetimeKey = `analytics:${licenseKey}:lifetime`;
      let lifetime = await kv.get(lifetimeKey) || {
        totalPosts: 0,
        totalScrapes: 0,
        totalAiDescriptions: 0,
        totalTimeSeconds: 0,
        firstActivity: now.toISOString(),
        lastActivity: now.toISOString()
      };
      
      if (event === 'post_created') lifetime.totalPosts += 1;
      if (event === 'scrape_completed') lifetime.totalScrapes += 1;
      if (event === 'ai_description_generated') lifetime.totalAiDescriptions += 1;
      if (event === 'heartbeat') lifetime.totalTimeSeconds += 60;
      lifetime.lastActivity = now.toISOString();
      
      await kv.set(lifetimeKey, lifetime);
      
      return res.json({ success: true });
    }
    
    // GET - Retrieve analytics
    if (req.method === 'GET') {
      const { licenseKey, period, adminKey } = req.query;
      
      // Admin can view all analytics
      const isAdmin = adminKey === process.env.ADMIN_SECRET_KEY;
      
      if (!licenseKey && !isAdmin) {
        return res.status(400).json({ error: 'License key required' });
      }
      
      // If admin wants all users
      if (isAdmin && !licenseKey) {
        return await getAllUsersAnalytics(res, period);
      }
      
      // Get analytics for specific license
      const now = new Date();
      let stats = {
        today: null,
        yesterday: null,
        thisWeek: { posts: 0, scrapes: 0, aiDescriptions: 0, timeSeconds: 0, days: [] },
        thisMonth: { posts: 0, scrapes: 0, aiDescriptions: 0, timeSeconds: 0, days: [] },
        lifetime: null
      };
      
      // Today
      const todayKey = `analytics:${licenseKey}:${now.toISOString().split('T')[0]}`;
      stats.today = await kv.get(todayKey);
      
      // Yesterday
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `analytics:${licenseKey}:${yesterday.toISOString().split('T')[0]}`;
      stats.yesterday = await kv.get(yesterdayKey);
      
      // This week (last 7 days)
      for (let i = 0; i < 7; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayStats = await kv.get(`analytics:${licenseKey}:${dateStr}`);
        
        if (dayStats) {
          stats.thisWeek.posts += dayStats.posts || 0;
          stats.thisWeek.scrapes += dayStats.scrapes || 0;
          stats.thisWeek.aiDescriptions += dayStats.aiDescriptions || 0;
          stats.thisWeek.timeSeconds += dayStats.totalTimeSeconds || 0;
          stats.thisWeek.days.push({
            date: dateStr,
            posts: dayStats.posts || 0,
            scrapes: dayStats.scrapes || 0,
            timeSeconds: dayStats.totalTimeSeconds || 0
          });
        }
      }
      
      // This month (last 30 days)
      for (let i = 0; i < 30; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayStats = await kv.get(`analytics:${licenseKey}:${dateStr}`);
        
        if (dayStats) {
          stats.thisMonth.posts += dayStats.posts || 0;
          stats.thisMonth.scrapes += dayStats.scrapes || 0;
          stats.thisMonth.aiDescriptions += dayStats.aiDescriptions || 0;
          stats.thisMonth.timeSeconds += dayStats.totalTimeSeconds || 0;
          stats.thisMonth.days.push({
            date: dateStr,
            posts: dayStats.posts || 0,
            scrapes: dayStats.scrapes || 0,
            timeSeconds: dayStats.totalTimeSeconds || 0
          });
        }
      }
      
      // Lifetime
      stats.lifetime = await kv.get(`analytics:${licenseKey}:lifetime`);
      
      // Calculate averages
      const activeDaysWeek = stats.thisWeek.days.filter(d => d.posts > 0).length || 1;
      const activeDaysMonth = stats.thisMonth.days.filter(d => d.posts > 0).length || 1;
      
      stats.averages = {
        postsPerDayWeek: Math.round(stats.thisWeek.posts / activeDaysWeek * 10) / 10,
        postsPerDayMonth: Math.round(stats.thisMonth.posts / activeDaysMonth * 10) / 10,
        avgTimePerPostSeconds: stats.thisMonth.posts > 0 
          ? Math.round(stats.thisMonth.timeSeconds / stats.thisMonth.posts) 
          : 0,
        avgSessionMinutes: stats.thisWeek.days.length > 0 
          ? Math.round(stats.thisWeek.timeSeconds / 60 / activeDaysWeek) 
          : 0
      };
      
      return res.json(stats);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Analytics API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAllUsersAnalytics(res, period = '7') {
  const days = parseInt(period) || 7;
  const now = new Date();
  
  // Get all license keys
  const licenseKeys = await kv.keys('license:*');
  const userStats = [];
  
  for (const key of licenseKeys) {
    const licenseKey = key.replace('license:', '');
    const license = await kv.get(key);
    
    if (!license) continue;
    
    let totalPosts = 0;
    let totalScrapes = 0;
    let totalTime = 0;
    let activeDays = 0;
    
    // Sum up stats for period
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayStats = await kv.get(`analytics:${licenseKey}:${dateStr}`);
      
      if (dayStats) {
        totalPosts += dayStats.posts || 0;
        totalScrapes += dayStats.scrapes || 0;
        totalTime += dayStats.totalTimeSeconds || 0;
        if (dayStats.posts > 0) activeDays++;
      }
    }
    
    // Get lifetime
    const lifetime = await kv.get(`analytics:${licenseKey}:lifetime`);
    
    userStats.push({
      licenseKey,
      dealerName: license.dealerName,
      plan: license.plan,
      active: license.active,
      period: {
        days,
        posts: totalPosts,
        scrapes: totalScrapes,
        timeMinutes: Math.round(totalTime / 60),
        activeDays,
        avgPostsPerDay: activeDays > 0 ? Math.round(totalPosts / activeDays * 10) / 10 : 0
      },
      lifetime: lifetime || { totalPosts: 0, totalScrapes: 0, totalTimeSeconds: 0 },
      lastActivity: lifetime?.lastActivity || null
    });
  }
  
  // Sort by recent activity
  userStats.sort((a, b) => {
    if (!a.lastActivity) return 1;
    if (!b.lastActivity) return -1;
    return new Date(b.lastActivity) - new Date(a.lastActivity);
  });
  
  return res.json({
    period: days,
    totalUsers: userStats.length,
    activeUsers: userStats.filter(u => u.period.posts > 0).length,
    totalPosts: userStats.reduce((sum, u) => sum + u.period.posts, 0),
    users: userStats
  });
}
