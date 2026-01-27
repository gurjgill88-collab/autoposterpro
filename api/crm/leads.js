// CRM Leads API
// Full CRUD for leads with notes, activities, and email tracking

import { kv } from '../../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Check authorization
  const authKey = req.headers.authorization?.replace('Bearer ', '');
  if (!authKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // GET - List all leads
    if (req.method === 'GET') {
      const { id, filter, search } = req.query;
      
      // Get single lead
      if (id) {
        const lead = await kv.get(`lead:${id}`);
        if (!lead) {
          return res.status(404).json({ error: 'Lead not found' });
        }
        return res.status(200).json({ lead });
      }
      
      // Get all leads
      const leadIds = await kv.lrange('leads', 0, -1) || [];
      let leads = [];
      
      for (const leadId of leadIds) {
        const lead = await kv.get(leadId);
        if (lead) {
          leads.push(lead);
        }
      }
      
      // Apply filter
      if (filter && filter !== 'all') {
        leads = leads.filter(l => l.temp === filter || l.status === filter);
      }
      
      // Apply search
      if (search) {
        const s = search.toLowerCase();
        leads = leads.filter(l => 
          l.firstName?.toLowerCase().includes(s) ||
          l.lastName?.toLowerCase().includes(s) ||
          l.dealership?.toLowerCase().includes(s) ||
          l.email?.toLowerCase().includes(s)
        );
      }
      
      // Sort by createdAt descending
      leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return res.status(200).json({ leads });
    }
    
    // POST - Create new lead
    if (req.method === 'POST') {
      const {
        firstName,
        lastName,
        dealership,
        email,
        phone,
        source,
        notes,
        assignedTo
      } = req.body;
      
      if (!firstName || !lastName || !email || !dealership) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const leadId = `lead:${Date.now()}`;
      const lead = {
        id: leadId,
        firstName,
        lastName,
        dealership,
        email,
        phone: phone || '',
        source: source || 'manual',
        status: 'new',
        temp: 'warm',
        assignedTo: assignedTo || null,
        notes: notes ? [{ text: notes, time: new Date().toISOString(), author: 'System' }] : [],
        activities: [{
          type: 'created',
          content: 'Lead created',
          time: new Date().toISOString()
        }],
        emails: [],
        nextFollowup: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        lastContact: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(leadId, lead);
      await kv.lpush('leads', leadId);
      
      return res.status(201).json({ success: true, lead });
    }
    
    // PUT - Update lead
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Lead ID required' });
      }
      
      const lead = await kv.get(id);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Merge updates
      const updatedLead = {
        ...lead,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      // If status changed, add activity
      if (updates.status && updates.status !== lead.status) {
        updatedLead.activities.unshift({
          type: 'status',
          content: `Status changed to ${updates.status}`,
          time: new Date().toISOString()
        });
      }
      
      await kv.set(id, updatedLead);
      
      return res.status(200).json({ success: true, lead: updatedLead });
    }
    
    // DELETE - Delete lead
    if (req.method === 'DELETE') {
      const { id } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Lead ID required' });
      }
      
      await kv.del(id);
      await kv.lrem('leads', 1, id);
      
      return res.status(200).json({ success: true, message: 'Lead deleted' });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('CRM Leads API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
