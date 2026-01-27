// Invoices API
// Generate, view, and manage invoices

import { kv } from '../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    // GET - List invoices
    if (req.method === 'GET') {
      const { id, customerId } = req.query;
      
      // Get single invoice
      if (id) {
        const invoice = await kv.get(id);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        return res.status(200).json({ invoice });
      }
      
      // List all invoices
      const invoiceIds = await kv.lrange('invoices', 0, 100) || [];
      const invoices = [];
      
      for (const invId of invoiceIds) {
        const invoice = await kv.get(invId);
        if (invoice) {
          if (!customerId || invoice.customerId === customerId) {
            invoices.push(invoice);
          }
        }
      }
      
      // Sort by date descending
      invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Calculate totals
      const totals = {
        total: invoices.length,
        paid: invoices.filter(i => i.status === 'paid').length,
        pending: invoices.filter(i => i.status === 'pending').length,
        overdue: invoices.filter(i => i.status === 'overdue').length,
        totalRevenue: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0)
      };
      
      return res.status(200).json({ invoices, totals });
    }
    
    // POST - Create manual invoice
    if (req.method === 'POST') {
      const {
        dealerName,
        contactName,
        contactEmail,
        amount,
        currency,
        description,
        dueDate,
        items,
        notes,
        licenseKey
      } = req.body;
      
      if (!dealerName || !amount) {
        return res.status(400).json({ error: 'Dealer name and amount required' });
      }
      
      const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
      const invoiceId = `inv:${Date.now()}`;
      
      const invoice = {
        id: invoiceId,
        invoiceNumber,
        dealerName,
        contactName: contactName || '',
        contactEmail: contactEmail || '',
        amount: parseFloat(amount),
        currency: currency || 'CAD',
        description: description || 'AutoPosterPro Subscription',
        items: items || [
          { description: 'AutoPosterPro Monthly Subscription', amount: parseFloat(amount) }
        ],
        notes: notes || '',
        licenseKey: licenseKey || null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        paidAt: null,
        paymentMethod: null
      };
      
      await kv.set(invoiceId, invoice);
      await kv.lpush('invoices', invoiceId);
      
      return res.status(201).json({ success: true, invoice });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Invoices API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
