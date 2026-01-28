// api/invoices.js
// Invoice management with tax calculations for Canada and USA

import { kv } from '../lib/redis.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://www.autoposterpro.com';

// Pricing plans
export const PLANS = {
  starter: { name: 'Starter', monthly: 219, setup: 299 },
  professional: { name: 'Professional', monthly: 1199, setup: 1000 },
  enterprise: { name: 'Enterprise', monthly: 1799, setup: 2000 }
};

// Canadian tax rates by province
export const CANADA_TAXES = {
  AB: { name: 'Alberta', gst: 5, pst: 0, hst: 0, type: 'GST' },
  BC: { name: 'British Columbia', gst: 5, pst: 7, hst: 0, type: 'GST+PST' },
  MB: { name: 'Manitoba', gst: 5, pst: 7, hst: 0, type: 'GST+PST' },
  NB: { name: 'New Brunswick', gst: 0, pst: 0, hst: 15, type: 'HST' },
  NL: { name: 'Newfoundland and Labrador', gst: 0, pst: 0, hst: 15, type: 'HST' },
  NS: { name: 'Nova Scotia', gst: 0, pst: 0, hst: 15, type: 'HST' },
  NT: { name: 'Northwest Territories', gst: 5, pst: 0, hst: 0, type: 'GST' },
  NU: { name: 'Nunavut', gst: 5, pst: 0, hst: 0, type: 'GST' },
  ON: { name: 'Ontario', gst: 0, pst: 0, hst: 13, type: 'HST' },
  PE: { name: 'Prince Edward Island', gst: 0, pst: 0, hst: 15, type: 'HST' },
  QC: { name: 'Quebec', gst: 5, pst: 9.975, hst: 0, type: 'GST+QST' },
  SK: { name: 'Saskatchewan', gst: 5, pst: 6, hst: 0, type: 'GST+PST' },
  YT: { name: 'Yukon', gst: 5, pst: 0, hst: 0, type: 'GST' }
};

// US state sales tax rates
export const US_TAXES = {
  AL: { name: 'Alabama', rate: 4 },
  AK: { name: 'Alaska', rate: 0 },
  AZ: { name: 'Arizona', rate: 5.6 },
  AR: { name: 'Arkansas', rate: 6.5 },
  CA: { name: 'California', rate: 7.25 },
  CO: { name: 'Colorado', rate: 2.9 },
  CT: { name: 'Connecticut', rate: 6.35 },
  DE: { name: 'Delaware', rate: 0 },
  FL: { name: 'Florida', rate: 6 },
  GA: { name: 'Georgia', rate: 4 },
  HI: { name: 'Hawaii', rate: 4 },
  ID: { name: 'Idaho', rate: 6 },
  IL: { name: 'Illinois', rate: 6.25 },
  IN: { name: 'Indiana', rate: 7 },
  IA: { name: 'Iowa', rate: 6 },
  KS: { name: 'Kansas', rate: 6.5 },
  KY: { name: 'Kentucky', rate: 6 },
  LA: { name: 'Louisiana', rate: 4.45 },
  ME: { name: 'Maine', rate: 5.5 },
  MD: { name: 'Maryland', rate: 6 },
  MA: { name: 'Massachusetts', rate: 6.25 },
  MI: { name: 'Michigan', rate: 6 },
  MN: { name: 'Minnesota', rate: 6.875 },
  MS: { name: 'Mississippi', rate: 7 },
  MO: { name: 'Missouri', rate: 4.225 },
  MT: { name: 'Montana', rate: 0 },
  NE: { name: 'Nebraska', rate: 5.5 },
  NV: { name: 'Nevada', rate: 6.85 },
  NH: { name: 'New Hampshire', rate: 0 },
  NJ: { name: 'New Jersey', rate: 6.625 },
  NM: { name: 'New Mexico', rate: 5.125 },
  NY: { name: 'New York', rate: 4 },
  NC: { name: 'North Carolina', rate: 4.75 },
  ND: { name: 'North Dakota', rate: 5 },
  OH: { name: 'Ohio', rate: 5.75 },
  OK: { name: 'Oklahoma', rate: 4.5 },
  OR: { name: 'Oregon', rate: 0 },
  PA: { name: 'Pennsylvania', rate: 6 },
  RI: { name: 'Rhode Island', rate: 7 },
  SC: { name: 'South Carolina', rate: 6 },
  SD: { name: 'South Dakota', rate: 4.5 },
  TN: { name: 'Tennessee', rate: 7 },
  TX: { name: 'Texas', rate: 6.25 },
  UT: { name: 'Utah', rate: 6.1 },
  VT: { name: 'Vermont', rate: 6 },
  VA: { name: 'Virginia', rate: 5.3 },
  WA: { name: 'Washington', rate: 6.5 },
  WV: { name: 'West Virginia', rate: 6 },
  WI: { name: 'Wisconsin', rate: 5 },
  WY: { name: 'Wyoming', rate: 4 },
  DC: { name: 'District of Columbia', rate: 6 }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    // GET - List invoices or get tax rates
    if (req.method === 'GET') {
      const { id, taxRates } = req.query;
      
      // Return tax rates for form
      if (taxRates) {
        return res.status(200).json({ 
          canada: CANADA_TAXES, 
          usa: US_TAXES,
          plans: PLANS
        });
      }
      
      // Get specific invoice (public for payment)
      if (id) {
        const invoice = await kv.get(id);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        return res.status(200).json({ invoice });
      }
      
      // List all invoices (authenticated)
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'Authentication required' });
      
      const invoiceIds = await kv.lrange('invoices', 0, -1) || [];
      const invoices = [];
      let totalRevenue = 0;
      let pendingCount = 0;
      
      for (const invId of invoiceIds) {
        const inv = await kv.get(invId);
        if (inv) {
          invoices.push(inv);
          if (inv.status === 'paid') {
            totalRevenue += inv.total || 0;
          } else if (inv.status === 'pending') {
            pendingCount++;
          }
        }
      }
      
      invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return res.status(200).json({ 
        invoices,
        totals: {
          totalRevenue,
          pending: pendingCount,
          total: invoices.length
        }
      });
    }
    
    // POST - Create and send invoice
    if (req.method === 'POST') {
      const { 
        dealerName,
        contactName,
        contactEmail,
        country,
        province,
        state,
        plan,
        monthlyFee,
        setupFee,
        includeSetup,
        discount,
        dueDate,
        notes,
        sendEmail
      } = req.body;
      
      if (!dealerName || !contactEmail) {
        return res.status(400).json({ error: 'Dealer name and email required' });
      }
      
      const invoiceId = `invoice:${Date.now()}`;
      const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
      const planDetails = PLANS[plan] || PLANS.starter;
      const currency = country === 'US' ? 'USD' : 'CAD';
      
      // Calculate base amounts
      const baseMonthly = monthlyFee !== undefined ? parseFloat(monthlyFee) : planDetails.monthly;
      const baseSetup = includeSetup ? (setupFee !== undefined ? parseFloat(setupFee) : planDetails.setup) : 0;
      const discountPercent = parseFloat(discount) || 0;
      
      const subtotalBeforeDiscount = baseMonthly + baseSetup;
      const discountAmount = subtotalBeforeDiscount * (discountPercent / 100);
      const subtotal = subtotalBeforeDiscount - discountAmount;
      
      // Calculate taxes
      let taxDetails = { type: 'None', rate: 0, amount: 0, breakdown: [] };
      
      if (country === 'CA' && province && CANADA_TAXES[province]) {
        const tax = CANADA_TAXES[province];
        if (tax.hst > 0) {
          const hstAmount = subtotal * (tax.hst / 100);
          taxDetails = {
            type: 'HST',
            rate: tax.hst,
            amount: hstAmount,
            breakdown: [{ name: 'HST', rate: tax.hst, amount: hstAmount }]
          };
        } else {
          const gstAmount = subtotal * (tax.gst / 100);
          const pstAmount = subtotal * (tax.pst / 100);
          const pstName = province === 'QC' ? 'QST' : 'PST';
          taxDetails = {
            type: tax.type,
            rate: tax.gst + tax.pst,
            amount: gstAmount + pstAmount,
            breakdown: [{ name: 'GST', rate: tax.gst, amount: gstAmount }]
          };
          if (tax.pst > 0) {
            taxDetails.breakdown.push({ name: pstName, rate: tax.pst, amount: pstAmount });
          }
        }
      } else if (country === 'US' && state && US_TAXES[state]) {
        const tax = US_TAXES[state];
        if (tax.rate > 0) {
          const taxAmount = subtotal * (tax.rate / 100);
          taxDetails = {
            type: 'Sales Tax',
            rate: tax.rate,
            amount: taxAmount,
            breakdown: [{ name: `${tax.name} Sales Tax`, rate: tax.rate, amount: taxAmount }]
          };
        }
      }
      
      const total = subtotal + taxDetails.amount;
      
      const invoice = {
        id: invoiceId,
        invoiceNumber,
        dealerName,
        contactName: contactName || '',
        contactEmail,
        country: country || 'CA',
        province: province || null,
        state: state || null,
        currency,
        
        plan: plan || 'starter',
        planName: planDetails.name,
        
        // Line items
        items: [
          { description: `${planDetails.name} Plan - Monthly Subscription`, amount: baseMonthly },
          ...(baseSetup > 0 ? [{ description: 'One-Time Setup Fee', amount: baseSetup }] : [])
        ],
        
        // Amounts
        baseMonthly,
        baseSetup,
        subtotalBeforeDiscount,
        discount: discountPercent,
        discountAmount,
        subtotal,
        taxDetails,
        total,
        
        // Status
        status: 'pending',
        dueDate: dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: notes || '',
        
        // Timestamps
        createdAt: new Date().toISOString(),
        sentAt: null,
        paidAt: null,
        
        paymentUrl: `${BASE_URL}/pay/${invoiceId}`
      };
      
      await kv.set(invoiceId, invoice);
      await kv.lpush('invoices', invoiceId);
      
      // Send invoice email if requested
      if (sendEmail !== false) {
        try {
          await resend.emails.send({
            from: 'AutoPosterPro <billing@autoposterpro.com>',
            to: contactEmail,
            subject: `Invoice ${invoiceNumber} from AutoPosterPro`,
            html: generateInvoiceEmail(invoice)
          });
          invoice.sentAt = new Date().toISOString();
          await kv.set(invoiceId, invoice);
        } catch (emailError) {
          console.error('Failed to send invoice email:', emailError);
        }
      }
      
      return res.status(201).json({ success: true, invoice });
    }
    
    // PUT - Update invoice
    if (req.method === 'PUT') {
      const { id, status, paidAt } = req.body;
      
      if (!id) return res.status(400).json({ error: 'Invoice ID required' });
      
      const invoice = await kv.get(id);
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
      
      if (status) {
        invoice.status = status;
        if (status === 'paid') {
          invoice.paidAt = paidAt || new Date().toISOString();
        }
      }
      
      await kv.set(id, invoice);
      
      return res.status(200).json({ success: true, invoice });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Invoices API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

function generateInvoiceEmail(invoice) {
  const itemsHtml = invoice.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.amount.toFixed(2)}</td>
    </tr>
  `).join('');
  
  const taxHtml = invoice.taxDetails.breakdown.map(t => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${t.name} (${t.rate}%)</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${t.amount.toFixed(2)}</td>
    </tr>
  `).join('');
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #7c3aed; margin: 0;">AutoPosterPro</h1>
        <p style="color: #666;">Invoice ${invoice.invoiceNumber}</p>
      </div>
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <p style="margin: 5px 0;"><strong>Bill To:</strong></p>
        <p style="margin: 5px 0;">${invoice.dealerName}</p>
        <p style="margin: 5px 0;">${invoice.contactName}</p>
        <p style="margin: 5px 0;">${invoice.contactEmail}</p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #7c3aed; color: white;">
            <th style="padding: 12px; text-align: left;">Description</th>
            <th style="padding: 12px; text-align: right;">Amount (${invoice.currency})</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          ${invoice.discount > 0 ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">Discount (${invoice.discount}%)</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #22c55e;">-$${invoice.discountAmount.toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Subtotal</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${invoice.subtotal.toFixed(2)}</td>
          </tr>
          ${taxHtml}
          <tr style="background: #f8f4ff;">
            <td style="padding: 12px;"><strong>Total</strong></td>
            <td style="padding: 12px; text-align: right;"><strong style="font-size: 20px;">$${invoice.total.toFixed(2)} ${invoice.currency}</strong></td>
          </tr>
        </tbody>
      </table>
      
      <p><strong>Due Date:</strong> ${invoice.dueDate}</p>
      
      <p style="margin: 30px 0; text-align: center;">
        <a href="${invoice.paymentUrl}" 
           style="background: #7c3aed; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          Pay Invoice
        </a>
      </p>
      
      ${invoice.notes ? `<p style="color: #666;"><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #888; font-size: 12px;">AutoPosterPro Inc. | <a href="${BASE_URL}">autoposterpro.com</a></p>
    </div>
  `;
}
