// Deals/Pipeline API
// Sales pipeline management

import { kv } from '../../lib/redis.js';

const STAGES = [
  'lead',
  'contacted',
  'qualified', 
  'demo',
  'proposal',
  'negotiation',
  'won',
  'lost'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    // GET - List deals
    if (req.method === 'GET') {
      const dealIds = await kv.lrange('deals', 0, -1) || [];
      const deals = [];
      
      for (const id of dealIds) {
        const deal = await kv.get(id);
        if (deal) deals.push(deal);
      }
      
      // Sort by updated date
      deals.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      
      return res.status(200).json({ deals, stages: STAGES });
    }
    
    // POST - Create deal
    if (req.method === 'POST') {
      const { 
        dealerName, 
        contactName, 
        contactEmail, 
        contactPhone,
        value,
        stage,
        source,
        notes,
        assignedTo,
        country // 'CA' or 'US'
      } = req.body;
      
      if (!dealerName || !contactName) {
        return res.status(400).json({ error: 'Dealer name and contact required' });
      }
      
      const dealId = `deal:${Date.now()}`;
      const deal = {
        id: dealId,
        dealerName,
        contactName,
        contactEmail: contactEmail || '',
        contactPhone: contactPhone || '',
        value: value || 0,
        stage: stage || 'lead',
        source: source || 'manual',
        notes: notes || '',
        assignedTo: assignedTo || null,
        country: country || 'CA',
        activities: [],
        emails: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        closedAt: null
      };
      
      await kv.set(dealId, deal);
      await kv.lpush('deals', dealId);
      
      // Track activity
      await logActivity(dealId, 'created', 'Deal created', token);
      
      return res.status(201).json({ success: true, deal });
    }
    
    // PUT - Update deal
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      
      if (!id) return res.status(400).json({ error: 'Deal ID required' });
      
      const deal = await kv.get(id);
      if (!deal) return res.status(404).json({ error: 'Deal not found' });
      
      const oldStage = deal.stage;
      
      const updatedDeal = {
        ...deal,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      // Track if closed
      if ((updates.stage === 'won' || updates.stage === 'lost') && !deal.closedAt) {
        updatedDeal.closedAt = new Date().toISOString();
      }
      
      await kv.set(id, updatedDeal);
      
      // Log stage change
      if (updates.stage && updates.stage !== oldStage) {
        await logActivity(id, 'stage_change', `Stage changed: ${oldStage} → ${updates.stage}`, token);
      }
      
      return res.status(200).json({ success: true, deal: updatedDeal });
    }
    
    // DELETE - Delete deal
    if (req.method === 'DELETE') {
      const { id } = req.body;
      
      if (!id) return res.status(400).json({ error: 'Deal ID required' });
      
      await kv.del(id);
      await kv.lrem('deals', 1, id);
      
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Deals API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

async function logActivity(dealId, type, description, userId) {
  const deal = await kv.get(dealId);
  if (!deal) return;
  
  const activity = {
    id: `activity:${Date.now()}`,
    type,
    description,
    userId: userId || 'system',
    timestamp: new Date().toISOString()
  };
  
  deal.activities = deal.activities || [];
  deal.activities.unshift(activity);
  deal.activities = deal.activities.slice(0, 100); // Keep last 100
  
  await kv.set(dealId, deal);
}
