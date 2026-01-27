// Reporting API
// MRR, revenue, analytics dashboards

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Admin access required' });
  }
  
  try {
    const { report } = req.query;
    
    // ========== DASHBOARD OVERVIEW ==========
    if (report === 'dashboard' || !report) {
      // Get all licenses
      const licenseKeys = await kv.keys('license:*') || [];
      let activeLicenses = 0;
      let monthlyLicenses = 0;
      let annualLicenses = 0;
      let mrr = 0;
      
      for (const key of licenseKeys) {
        const license = await kv.get(key);
        if (license && license.active) {
          activeLicenses++;
          if (license.plan === 'annual') {
            annualLicenses++;
            mrr += 79; // $948/year = $79/month
          } else {
            monthlyLicenses++;
            mrr += 99;
          }
        }
      }
      
      // Get deals stats
      const dealIds = await kv.lrange('deals', 0, -1) || [];
      let totalDeals = dealIds.length;
      let openDeals = 0;
      let wonDeals = 0;
      let lostDeals = 0;
      let pipelineValue = 0;
      
      for (const dealId of dealIds) {
        const deal = await kv.get(dealId);
        if (deal) {
          if (deal.stage === 'won') wonDeals++;
          else if (deal.stage === 'lost') lostDeals++;
          else {
            openDeals++;
            pipelineValue += deal.value || 0;
          }
        }
      }
      
      // Get today's usage
      const today = new Date().toISOString().split('T')[0];
      const activeToday = await kv.smembers(`active:${today}`) || [];
      
      // Get recent activities
      const recentDeals = [];
      for (const dealId of dealIds.slice(0, 5)) {
        const deal = await kv.get(dealId);
        if (deal) recentDeals.push(deal);
      }
      
      return res.status(200).json({
        overview: {
          activeLicenses,
          monthlyLicenses,
          annualLicenses,
          mrr,
          arr: mrr * 12,
          activeToday: activeToday.length
        },
        deals: {
          total: totalDeals,
          open: openDeals,
          won: wonDeals,
          lost: lostDeals,
          pipelineValue,
          winRate: totalDeals > 0 ? Math.round((wonDeals / (wonDeals + lostDeals || 1)) * 100) : 0
        },
        recentDeals
      });
    }
    
    // ========== MRR REPORT ==========
    if (report === 'mrr') {
      const licenseKeys = await kv.keys('license:*') || [];
      const mrrHistory = [];
      
      // Calculate MRR for last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toISOString().slice(0, 7); // YYYY-MM
        
        let monthMrr = 0;
        let activeCount = 0;
        
        for (const key of licenseKeys) {
          const license = await kv.get(key);
          if (license && license.active) {
            const createdMonth = license.createdAt?.slice(0, 7);
            if (createdMonth && createdMonth <= monthStr) {
              activeCount++;
              monthMrr += license.plan === 'annual' ? 79 : 99;
            }
          }
        }
        
        mrrHistory.push({
          month: monthStr,
          mrr: monthMrr,
          licenses: activeCount
        });
      }
      
      // Current MRR breakdown
      let monthlyMrr = 0;
      let annualMrr = 0;
      
      for (const key of licenseKeys) {
        const license = await kv.get(key);
        if (license && license.active) {
          if (license.plan === 'annual') {
            annualMrr += 79;
          } else {
            monthlyMrr += 99;
          }
        }
      }
      
      return res.status(200).json({
        currentMrr: monthlyMrr + annualMrr,
        monthlyMrr,
        annualMrr,
        arr: (monthlyMrr + annualMrr) * 12,
        history: mrrHistory
      });
    }
    
    // ========== SALES PIPELINE REPORT ==========
    if (report === 'pipeline') {
      const dealIds = await kv.lrange('deals', 0, -1) || [];
      const stages = {
        lead: { count: 0, value: 0 },
        contacted: { count: 0, value: 0 },
        qualified: { count: 0, value: 0 },
        demo: { count: 0, value: 0 },
        proposal: { count: 0, value: 0 },
        negotiation: { count: 0, value: 0 },
        won: { count: 0, value: 0 },
        lost: { count: 0, value: 0 }
      };
      
      const deals = [];
      for (const dealId of dealIds) {
        const deal = await kv.get(dealId);
        if (deal) {
          deals.push(deal);
          if (stages[deal.stage]) {
            stages[deal.stage].count++;
            stages[deal.stage].value += deal.value || 0;
          }
        }
      }
      
      // Calculate conversion rates
      const totalLeads = Object.values(stages).reduce((sum, s) => sum + s.count, 0);
      const conversionRate = totalLeads > 0 ? Math.round((stages.won.count / totalLeads) * 100) : 0;
      
      return res.status(200).json({
        stages,
        totalDeals: totalLeads,
        totalPipelineValue: Object.entries(stages)
          .filter(([k]) => !['won', 'lost'].includes(k))
          .reduce((sum, [_, v]) => sum + v.value, 0),
        conversionRate,
        deals
      });
    }
    
    // ========== USAGE REPORT ==========
    if (report === 'usage') {
      const licenseKeys = await kv.keys('stats:*') || [];
      const usageData = [];
      
      for (const key of licenseKeys) {
        const stats = await kv.get(key);
        if (stats) usageData.push(stats);
      }
      
      // Sort by last used
      usageData.sort((a, b) => new Date(b.lastUsed || 0) - new Date(a.lastUsed || 0));
      
      // Aggregate totals
      const totals = {
        totalScrapes: usageData.reduce((sum, s) => sum + (s.totalScrapes || 0), 0),
        totalPosts: usageData.reduce((sum, s) => sum + (s.totalPosts || 0), 0),
        totalClicks: usageData.reduce((sum, s) => sum + (s.totalClicks || 0), 0),
        activeLicenses: usageData.filter(s => s.lastUsed && new Date(s.lastUsed) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length
      };
      
      // Daily active for last 30 days
      const dailyActive = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const active = await kv.smembers(`active:${dateStr}`) || [];
        dailyActive.push({
          date: dateStr,
          count: active.length
        });
      }
      
      return res.status(200).json({
        totals,
        dailyActive,
        licenses: usageData
      });
    }
    
    // ========== TEAM PERFORMANCE REPORT ==========
    if (report === 'team') {
      const userIds = await kv.lrange('crm-users', 0, -1) || [];
      const dealIds = await kv.lrange('deals', 0, -1) || [];
      
      // Get all deals
      const deals = [];
      for (const dealId of dealIds) {
        const deal = await kv.get(dealId);
        if (deal) deals.push(deal);
      }
      
      // Calculate per-user stats
      const teamStats = [];
      for (const userId of userIds) {
        const user = await kv.get(userId);
        if (!user) continue;
        
        const userDeals = deals.filter(d => d.assignedTo === userId);
        const won = userDeals.filter(d => d.stage === 'won');
        const lost = userDeals.filter(d => d.stage === 'lost');
        
        teamStats.push({
          id: userId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role,
          totalDeals: userDeals.length,
          wonDeals: won.length,
          lostDeals: lost.length,
          openDeals: userDeals.length - won.length - lost.length,
          winRate: (won.length + lost.length) > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0,
          totalValue: won.reduce((sum, d) => sum + (d.value || 0), 0),
          lastActivity: user.lastLogin || user.createdAt
        });
      }
      
      // Sort by won deals
      teamStats.sort((a, b) => b.wonDeals - a.wonDeals);
      
      return res.status(200).json({ team: teamStats });
    }
    
    return res.status(400).json({ error: 'Unknown report type' });
    
  } catch (error) {
    console.error('Reporting API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
