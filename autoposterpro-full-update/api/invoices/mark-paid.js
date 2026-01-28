// api/invoices/mark-paid.js
// Mark invoice as paid

import { kv } from '../../lib/redis.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://www.autoposterpro.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Verify auth
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const { id, paymentMethod, paymentReference } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Invoice ID required' });
    }
    
    const invoice = await kv.get(id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice already paid' });
    }
    
    // Update invoice
    invoice.status = 'paid';
    invoice.paidAt = new Date().toISOString();
    invoice.paymentMethod = paymentMethod || 'manual';
    invoice.paymentReference = paymentReference || null;
    
    await kv.set(id, invoice);
    
    // Send payment confirmation email
    try {
      await resend.emails.send({
        from: 'AutoPosterPro <billing@autoposterpro.com>',
        to: invoice.contactEmail,
        subject: `Payment Received - Invoice ${invoice.invoiceNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #7c3aed; margin: 0;">AutoPosterPro</h1>
            </div>
            
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
              <h2 style="margin-top: 0; color: #22c55e;">Payment Received!</h2>
              <p>Thank you for your payment of <strong>$${invoice.total.toFixed(2)} ${invoice.currency}</strong>.</p>
            </div>
            
            <p><strong>Invoice:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Dealer:</strong> ${invoice.dealerName}</p>
            <p><strong>Date Paid:</strong> ${new Date().toLocaleDateString()}</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #666;">If you have any questions about this payment, please contact us.</p>
            
            <p style="color: #888; font-size: 12px;">AutoPosterPro Inc. | <a href="${BASE_URL}">autoposterpro.com</a></p>
          </div>
        `
      });
    } catch (e) {
      console.error('Failed to send payment confirmation:', e);
    }
    
    return res.status(200).json({ success: true, invoice });
    
  } catch (error) {
    console.error('Mark paid error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
