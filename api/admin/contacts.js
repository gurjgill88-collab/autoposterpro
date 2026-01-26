// Admin Contacts API
// List contact form submissions

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Check admin authorization
  const adminKey = req.headers.authorization?.replace('Bearer ', '');
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get list of contact IDs
    const contactIds = await kv.lrange('contacts', 0, -1) || [];
    const contacts = [];
    
    for (const id of contactIds) {
      const contact = await kv.get(id);
      if (contact) {
        contacts.push(contact);
      }
    }
    
    // Sort by date, newest first
    contacts.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    
    return res.status(200).json({ contacts });
    
  } catch (error) {
    console.error('Contacts fetch error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
