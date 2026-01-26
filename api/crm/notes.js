// CRM Notes API
// Add/get notes for leads

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const authKey = req.headers.authorization?.replace('Bearer ', '');
  if (!authKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const { leadId } = req.query;
    
    if (!leadId) {
      return res.status(400).json({ error: 'Lead ID required' });
    }
    
    const lead = await kv.get(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // GET - Get all notes for a lead
    if (req.method === 'GET') {
      return res.status(200).json({ notes: lead.notes || [] });
    }
    
    // POST - Add a note
    if (req.method === 'POST') {
      const { text, author } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Note text required' });
      }
      
      const note = {
        id: `note-${Date.now()}`,
        text,
        author: author || 'Unknown',
        time: new Date().toISOString()
      };
      
      lead.notes = lead.notes || [];
      lead.notes.unshift(note);
      
      // Also add to activities
      lead.activities = lead.activities || [];
      lead.activities.unshift({
        type: 'note',
        content: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        time: new Date().toISOString()
      });
      
      lead.updatedAt = new Date().toISOString();
      
      await kv.set(leadId, lead);
      
      return res.status(201).json({ success: true, note });
    }
    
    // DELETE - Delete a note
    if (req.method === 'DELETE') {
      const { noteId } = req.body;
      
      lead.notes = (lead.notes || []).filter(n => n.id !== noteId);
      lead.updatedAt = new Date().toISOString();
      
      await kv.set(leadId, lead);
      
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('CRM Notes API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
