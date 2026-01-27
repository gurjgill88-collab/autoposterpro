// Transactions API
// View payment history and billing transactions

import { kv } from '../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const { period, type, limit } = req.query;
    
    // Get transactions
    const txIds = await kv.lrange('transactions', 0, parseInt(limit) || 100) || [];
    let transactions = [];
    
    for (const txId of txIds) {
      const tx = await kv.get(txId);
      if (tx) {
        // Filter by type if specified
        if (type && tx.type !== type) continue;
        
        // Filter by period
        if (period) {
          const txDate = new Date(tx.timestamp);
          const now = new Date();
          if (period === '7d' && (now - txDate) > 7 * 24 * 60 * 60 * 1000) continue;
          if (period === '30d' && (now - txDate) > 30 * 24 * 60 * 60 * 1000) continue;
          if (period === '90d' && (now - txDate) > 90 * 24 * 60 * 60 * 1000) continue;
        }
        
        transactions.push(tx);
      }
    }
    
    // Calculate summary
    const summary = {
      totalTransactions: transactions.length,
      totalRevenue: transactions
        .filter(t => t.type === 'invoice_paid' || t.type === 'checkout_complete')
        .reduce((sum, t) => sum + (t.amount || 0), 0) / 100, // Convert from cents
      failedPayments: transactions.filter(t => t.type === 'payment_failed').length,
      newCustomers: transactions.filter(t => t.type === 'checkout_complete').length,
      cancellations: transactions.filter(t => t.type === 'subscription_cancelled').length
    };
    
    // Group by day for chart
    const dailyRevenue = {};
    transactions
      .filter(t => t.type === 'invoice_paid' || t.type === 'checkout_complete')
      .forEach(t => {
        const day = t.timestamp?.split('T')[0];
        if (day) {
          dailyRevenue[day] = (dailyRevenue[day] || 0) + ((t.amount || 0) / 100);
        }
      });
    
    return res.status(200).json({
      transactions,
      summary,
      dailyRevenue: Object.entries(dailyRevenue).map(([date, amount]) => ({ date, amount }))
    });
    
  } catch (error) {
    console.error('Transactions API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
