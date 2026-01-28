// Reporting API
// MRR, revenue, analytics dashboards

import { kv } from '../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Determine user role
  let userRole = 'viewer';
  let isAdmin = false;
  
  if (token === process.env.ADMIN_SECRET_KEY) {
    userRole = 'admin';
    isAdmin = true;
  } else {
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      userRole = payload.role || 'viewer';
      isAdmin = ['admin', 'super_admin'].includes(userRole);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
  
  try {
    const { report } = req.query;
    
    // Reports requiring admin access (contain customer data)
    const adminOnlyReports = ['customers', 'aging'];
    
    if (adminOnlyReports.includes(report) && !isAdmin) {
      return res.status(403).json({ 
        error: 'Admin access required for customer reports',
        message: 'Contact your administrator for access to customer data'
      });
    }
    
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
    
    // ========== TAX REPORT ==========
    if (report === 'tax') {
      const { startDate, endDate, country, region, period } = req.query;
      
      // Default to current month if no dates provided
      let start, end;
      if (period === 'monthly') {
        start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end = new Date();
      } else if (period === 'quarterly') {
        const quarter = Math.floor(new Date().getMonth() / 3);
        start = new Date(new Date().getFullYear(), quarter * 3, 1);
        end = new Date();
      } else if (period === 'yearly') {
        start = new Date(new Date().getFullYear(), 0, 1);
        end = new Date();
      } else {
        start = startDate ? new Date(startDate) : new Date(new Date().setDate(1));
        end = endDate ? new Date(endDate) : new Date();
      }
      
      const invoiceIds = await kv.lrange('invoices', 0, -1) || [];
      
      // Tax breakdown by region
      const taxByRegion = {};
      const taxSummary = {
        totalRevenue: 0,
        totalSubtotal: 0,
        totalTax: 0,
        totalGST: 0,
        totalHST: 0,
        totalPST: 0,
        totalQST: 0,
        totalStateTax: 0,
        invoiceCount: 0,
        paidCount: 0
      };
      
      for (const invoiceId of invoiceIds) {
        const inv = await kv.get(invoiceId);
        if (!inv) continue;
        
        // Filter by date
        const invDate = new Date(inv.paidAt || inv.createdAt);
        if (invDate < start || invDate > end) continue;
        
        // Filter by country
        if (country && inv.country !== country) continue;
        
        // Filter by region (province/state)
        const invRegion = inv.province || inv.state;
        if (region && invRegion !== region) continue;
        
        // Only count paid invoices for tax reporting
        if (inv.status !== 'paid') {
          taxSummary.invoiceCount++;
          continue;
        }
        
        taxSummary.invoiceCount++;
        taxSummary.paidCount++;
        taxSummary.totalRevenue += inv.total || 0;
        taxSummary.totalSubtotal += inv.subtotal || 0;
        
        // Process tax breakdown
        if (inv.taxDetails && inv.taxDetails.breakdown) {
          for (const tax of inv.taxDetails.breakdown) {
            taxSummary.totalTax += tax.amount || 0;
            
            // Categorize by tax type
            const taxName = tax.name.toUpperCase();
            if (taxName.includes('GST')) taxSummary.totalGST += tax.amount || 0;
            else if (taxName.includes('HST')) taxSummary.totalHST += tax.amount || 0;
            else if (taxName.includes('QST')) taxSummary.totalQST += tax.amount || 0;
            else if (taxName.includes('PST')) taxSummary.totalPST += tax.amount || 0;
            else taxSummary.totalStateTax += tax.amount || 0;
          }
        }
        
        // Group by region
        const regionKey = `${inv.country}-${invRegion || 'Unknown'}`;
        if (!taxByRegion[regionKey]) {
          taxByRegion[regionKey] = {
            country: inv.country,
            region: invRegion || 'Unknown',
            regionName: getRegionName(inv.country, invRegion),
            invoiceCount: 0,
            subtotal: 0,
            taxCollected: 0,
            total: 0,
            taxBreakdown: {}
          };
        }
        
        taxByRegion[regionKey].invoiceCount++;
        taxByRegion[regionKey].subtotal += inv.subtotal || 0;
        taxByRegion[regionKey].total += inv.total || 0;
        
        if (inv.taxDetails && inv.taxDetails.breakdown) {
          for (const tax of inv.taxDetails.breakdown) {
            taxByRegion[regionKey].taxCollected += tax.amount || 0;
            const taxType = tax.name.split(' ')[0]; // GST, HST, PST, QST, etc.
            if (!taxByRegion[regionKey].taxBreakdown[taxType]) {
              taxByRegion[regionKey].taxBreakdown[taxType] = { rate: tax.rate, amount: 0 };
            }
            taxByRegion[regionKey].taxBreakdown[taxType].amount += tax.amount || 0;
          }
        }
      }
      
      // Convert to array and sort
      const regions = Object.values(taxByRegion).sort((a, b) => b.taxCollected - a.taxCollected);
      
      // Separate Canada and USA
      const canadaRegions = regions.filter(r => r.country === 'CA');
      const usaRegions = regions.filter(r => r.country === 'US');
      
      return res.status(200).json({
        period: { start: start.toISOString(), end: end.toISOString() },
        summary: taxSummary,
        canada: {
          regions: canadaRegions,
          totalTax: canadaRegions.reduce((sum, r) => sum + r.taxCollected, 0),
          gst: taxSummary.totalGST,
          hst: taxSummary.totalHST,
          pst: taxSummary.totalPST,
          qst: taxSummary.totalQST
        },
        usa: {
          regions: usaRegions,
          totalTax: usaRegions.reduce((sum, r) => sum + r.taxCollected, 0)
        }
      });
    }
    
    // ========== REVENUE REPORT ==========
    if (report === 'revenue') {
      const { startDate, endDate, groupBy } = req.query;
      
      const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 12));
      const end = endDate ? new Date(endDate) : new Date();
      
      const invoiceIds = await kv.lrange('invoices', 0, -1) || [];
      
      // Group revenue by period
      const revenueByPeriod = {};
      const revenueByPlan = { starter: 0, professional: 0, enterprise: 0, other: 0 };
      const revenueByType = { setup: 0, monthly: 0, annual: 0 };
      let totalRevenue = 0;
      let totalInvoices = 0;
      
      for (const invoiceId of invoiceIds) {
        const inv = await kv.get(invoiceId);
        if (!inv || inv.status !== 'paid') continue;
        
        const invDate = new Date(inv.paidAt || inv.createdAt);
        if (invDate < start || invDate > end) continue;
        
        totalInvoices++;
        totalRevenue += inv.total || 0;
        
        // By plan
        const plan = inv.plan || 'other';
        revenueByPlan[plan] = (revenueByPlan[plan] || 0) + (inv.total || 0);
        
        // By type (check description or items)
        if (inv.items) {
          for (const item of inv.items) {
            if (item.description.toLowerCase().includes('setup')) {
              revenueByType.setup += item.amount || 0;
            } else if (item.description.toLowerCase().includes('annual')) {
              revenueByType.annual += item.amount || 0;
            } else {
              revenueByType.monthly += item.amount || 0;
            }
          }
        }
        
        // Group by period
        let periodKey;
        if (groupBy === 'day') {
          periodKey = invDate.toISOString().split('T')[0];
        } else if (groupBy === 'week') {
          const weekStart = new Date(invDate);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
        } else {
          periodKey = invDate.toISOString().slice(0, 7); // YYYY-MM
        }
        
        if (!revenueByPeriod[periodKey]) {
          revenueByPeriod[periodKey] = { period: periodKey, revenue: 0, count: 0, tax: 0 };
        }
        revenueByPeriod[periodKey].revenue += inv.total || 0;
        revenueByPeriod[periodKey].count++;
        revenueByPeriod[periodKey].tax += inv.taxDetails?.amount || 0;
      }
      
      // Convert to sorted array
      const history = Object.values(revenueByPeriod).sort((a, b) => a.period.localeCompare(b.period));
      
      return res.status(200).json({
        period: { start: start.toISOString(), end: end.toISOString() },
        summary: {
          totalRevenue,
          totalInvoices,
          averageInvoice: totalInvoices > 0 ? totalRevenue / totalInvoices : 0
        },
        byPlan: revenueByPlan,
        byType: revenueByType,
        history
      });
    }
    
    // ========== AGING RECEIVABLES REPORT ==========
    if (report === 'aging') {
      const invoiceIds = await kv.lrange('invoices', 0, -1) || [];
      const now = new Date();
      
      const aging = {
        current: { count: 0, amount: 0, invoices: [] },      // Not yet due
        overdue1to30: { count: 0, amount: 0, invoices: [] }, // 1-30 days overdue
        overdue31to60: { count: 0, amount: 0, invoices: [] }, // 31-60 days
        overdue61to90: { count: 0, amount: 0, invoices: [] }, // 61-90 days
        overdue90plus: { count: 0, amount: 0, invoices: [] }  // 90+ days
      };
      
      for (const invoiceId of invoiceIds) {
        const inv = await kv.get(invoiceId);
        if (!inv || inv.status === 'paid') continue;
        
        const dueDate = new Date(inv.dueDate || inv.createdAt);
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
        
        const invSummary = {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          dealerName: inv.dealerName,
          amount: inv.total,
          dueDate: inv.dueDate,
          daysOverdue: Math.max(0, daysOverdue),
          contactEmail: inv.contactEmail
        };
        
        if (daysOverdue <= 0) {
          aging.current.count++;
          aging.current.amount += inv.total || 0;
          aging.current.invoices.push(invSummary);
        } else if (daysOverdue <= 30) {
          aging.overdue1to30.count++;
          aging.overdue1to30.amount += inv.total || 0;
          aging.overdue1to30.invoices.push(invSummary);
        } else if (daysOverdue <= 60) {
          aging.overdue31to60.count++;
          aging.overdue31to60.amount += inv.total || 0;
          aging.overdue31to60.invoices.push(invSummary);
        } else if (daysOverdue <= 90) {
          aging.overdue61to90.count++;
          aging.overdue61to90.amount += inv.total || 0;
          aging.overdue61to90.invoices.push(invSummary);
        } else {
          aging.overdue90plus.count++;
          aging.overdue90plus.amount += inv.total || 0;
          aging.overdue90plus.invoices.push(invSummary);
        }
      }
      
      const totalOutstanding = aging.current.amount + aging.overdue1to30.amount + 
                               aging.overdue31to60.amount + aging.overdue61to90.amount + 
                               aging.overdue90plus.amount;
      
      return res.status(200).json({
        summary: {
          totalOutstanding,
          totalOverdue: totalOutstanding - aging.current.amount,
          invoiceCount: aging.current.count + aging.overdue1to30.count + aging.overdue31to60.count + 
                        aging.overdue61to90.count + aging.overdue90plus.count
        },
        aging
      });
    }
    
    // ========== CUSTOMER REPORT ==========
    if (report === 'customers') {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      
      const invoiceIds = await kv.lrange('invoices', 0, -1) || [];
      const agreementIds = await kv.lrange('agreements', 0, -1) || [];
      
      // Build customer data from invoices
      const customers = {};
      
      for (const invoiceId of invoiceIds) {
        const inv = await kv.get(invoiceId);
        if (!inv) continue;
        
        const invDate = new Date(inv.createdAt);
        if (invDate < start || invDate > end) continue;
        
        const key = inv.dealerName?.toLowerCase().trim();
        if (!key) continue;
        
        if (!customers[key]) {
          customers[key] = {
            dealerName: inv.dealerName,
            contactName: inv.contactName,
            contactEmail: inv.contactEmail,
            country: inv.country,
            region: inv.province || inv.state,
            plan: inv.plan,
            totalInvoices: 0,
            totalPaid: 0,
            totalOutstanding: 0,
            firstInvoice: inv.createdAt,
            lastInvoice: inv.createdAt,
            totalTaxPaid: 0
          };
        }
        
        customers[key].totalInvoices++;
        if (inv.status === 'paid') {
          customers[key].totalPaid += inv.total || 0;
          customers[key].totalTaxPaid += inv.taxDetails?.amount || 0;
        } else {
          customers[key].totalOutstanding += inv.total || 0;
        }
        
        if (inv.createdAt < customers[key].firstInvoice) {
          customers[key].firstInvoice = inv.createdAt;
        }
        if (inv.createdAt > customers[key].lastInvoice) {
          customers[key].lastInvoice = inv.createdAt;
        }
      }
      
      // Add agreement data
      for (const agreementId of agreementIds) {
        const ag = await kv.get(agreementId);
        if (!ag) continue;
        
        const key = ag.dealerName?.toLowerCase().trim();
        if (!key || !customers[key]) continue;
        
        customers[key].agreementStatus = ag.status;
        customers[key].agreementSignedAt = ag.adminSignedAt || ag.customerSignedAt;
        customers[key].plan = ag.plan || customers[key].plan;
      }
      
      // Convert to array and sort by revenue
      const customerList = Object.values(customers)
        .map(c => ({
          ...c,
          lifetimeValue: c.totalPaid,
          avgInvoice: c.totalInvoices > 0 ? c.totalPaid / c.totalInvoices : 0
        }))
        .sort((a, b) => b.lifetimeValue - a.lifetimeValue);
      
      // Summary stats
      const summary = {
        totalCustomers: customerList.length,
        totalRevenue: customerList.reduce((sum, c) => sum + c.totalPaid, 0),
        totalOutstanding: customerList.reduce((sum, c) => sum + c.totalOutstanding, 0),
        avgLifetimeValue: customerList.length > 0 ? 
          customerList.reduce((sum, c) => sum + c.lifetimeValue, 0) / customerList.length : 0,
        topCustomers: customerList.slice(0, 10)
      };
      
      return res.status(200).json({
        period: { start: start.toISOString(), end: end.toISOString() },
        summary,
        customers: customerList
      });
    }
    
    // ========== CHURN REPORT ==========
    if (report === 'churn') {
      const licenseKeys = await kv.keys('license:*') || [];
      const now = new Date();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
      
      let activeCount = 0;
      let inactiveCount = 0;
      let cancelledCount = 0;
      let atRiskCount = 0; // Active but no usage in 14+ days
      
      const churned = [];
      const atRisk = [];
      
      for (const key of licenseKeys) {
        const license = await kv.get(key);
        if (!license) continue;
        
        if (!license.active) {
          inactiveCount++;
          if (license.cancelledAt) {
            cancelledCount++;
            const cancelDate = new Date(license.cancelledAt);
            if (cancelDate > ninetyDaysAgo) {
              churned.push({
                dealerName: license.dealerName,
                email: license.email,
                plan: license.plan,
                cancelledAt: license.cancelledAt,
                reason: license.cancellationReason
              });
            }
          }
        } else {
          activeCount++;
          
          // Check for at-risk (no usage in 14+ days)
          const lastUsed = license.lastUsed ? new Date(license.lastUsed) : null;
          if (!lastUsed || lastUsed < new Date(now - 14 * 24 * 60 * 60 * 1000)) {
            atRiskCount++;
            atRisk.push({
              dealerName: license.dealerName,
              email: license.email,
              plan: license.plan,
              lastUsed: license.lastUsed,
              daysSinceActive: lastUsed ? Math.floor((now - lastUsed) / (1000 * 60 * 60 * 24)) : 'Never'
            });
          }
        }
      }
      
      // Calculate churn rate (cancelled in last 30 days / total at start of period)
      const churnedLast30 = churned.filter(c => new Date(c.cancelledAt) > thirtyDaysAgo).length;
      const totalAtStartOfMonth = activeCount + churnedLast30;
      const churnRate = totalAtStartOfMonth > 0 ? (churnedLast30 / totalAtStartOfMonth) * 100 : 0;
      
      return res.status(200).json({
        summary: {
          activeCount,
          inactiveCount,
          cancelledCount,
          atRiskCount,
          churnRate: churnRate.toFixed(2),
          retentionRate: (100 - churnRate).toFixed(2)
        },
        churned: churned.slice(0, 50),
        atRisk: atRisk.slice(0, 50)
      });
    }

    return res.status(400).json({ error: 'Unknown report type' });
    
  } catch (error) {
    console.error('Reporting API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

// Helper to get region name
function getRegionName(country, code) {
  const CANADA_PROVINCES = {
    AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
    NL: 'Newfoundland', NS: 'Nova Scotia', NT: 'Northwest Territories', NU: 'Nunavut',
    ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon'
  };
  const US_STATES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
    CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
    MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
    OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
    VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
    DC: 'Washington D.C.'
  };
  
  if (country === 'CA') return CANADA_PROVINCES[code] || code;
  if (country === 'US') return US_STATES[code] || code;
  return code;
}
