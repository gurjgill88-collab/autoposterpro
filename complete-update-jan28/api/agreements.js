// Agreements API
// Digital signature and EULA management with dual signatures

import { kv } from '../lib/redis.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://www.autoposterpro.com';

// Pricing plans
const PLANS = {
  starter: { name: 'Starter', monthly: 219, setup: 299 },
  professional: { name: 'Professional', monthly: 1199, setup: 1000 },
  enterprise: { name: 'Enterprise', monthly: 1799, setup: 2000 }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    // GET - List agreements or get specific one
    if (req.method === 'GET') {
      const { country, id } = req.query;
      
      // Get specific agreement (public - for signing page)
      if (id) {
        const agreement = await kv.get(id);
        if (!agreement) return res.status(404).json({ error: 'Agreement not found' });
        return res.status(200).json({ agreement });
      }
      
      // List all agreements (authenticated)
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const agreementIds = await kv.lrange('agreements', 0, -1) || [];
      const agreements = [];
      
      for (const agId of agreementIds) {
        const ag = await kv.get(agId);
        if (ag) agreements.push(ag);
      }
      
      // Sort by most recent first
      agreements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return res.status(200).json({ agreements });
    }
    
    // POST - Create and send agreement
    if (req.method === 'POST') {
      const { 
        dealerName,
        contactName,
        contactFirstName,
        contactLastName,
        contactTitle,
        contactEmail,
        contactPhone,
        country,
        plan,
        monthlyFee,
        setupFee,
        discount,
        term,
        startDate,
        customTerms
      } = req.body;
      
      if (!dealerName || !contactName || !contactEmail) {
        return res.status(400).json({ error: 'Dealer name, contact, and email required' });
      }
      
      const agreementId = `agreement:${Date.now()}`;
      const signatureToken = generateSignatureToken();
      const planDetails = PLANS[plan] || PLANS.starter;
      
      // Calculate final pricing
      const discountMultiplier = 1 - (discount || 0) / 100;
      const finalMonthly = (monthlyFee || planDetails.monthly) * discountMultiplier;
      const finalSetup = (setupFee || planDetails.setup) * discountMultiplier;
      
      const agreement = {
        id: agreementId,
        dealerName,
        contactName,
        contactFirstName: contactFirstName || '',
        contactLastName: contactLastName || '',
        contactTitle: contactTitle || '',
        contactEmail,
        contactPhone: contactPhone || '',
        country: country || 'CA',
        plan: plan || 'starter',
        planName: planDetails.name,
        monthlyFee: monthlyFee || planDetails.monthly,
        setupFee: setupFee || planDetails.setup,
        discount: discount || 0,
        finalMonthly,
        finalSetup,
        term: term || 'monthly',
        startDate: startDate || new Date().toISOString().split('T')[0],
        customTerms: customTerms || null,
        
        // Status tracking
        status: 'pending', // pending, viewed, customer_signed, fully_signed, expired, voided
        signatureToken,
        signatureUrl: `${BASE_URL}/sign/${agreementId}?token=${signatureToken}`,
        
        // Timestamps
        createdAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        
        // View tracking
        viewCount: 0,
        lastViewedAt: null,
        
        // Customer signature
        customerSignedAt: null,
        customerSignatureData: null,
        
        // Admin counter-signature  
        adminSignedAt: null,
        adminSignatureData: null,
        
        // Reminders
        reminder45minSent: false,
        reminderNextDaySent: false
      };
      
      await kv.set(agreementId, agreement);
      await kv.lpush('agreements', agreementId);
      
      // Schedule reminders (store in a queue)
      await kv.lpush('agreement-reminders', JSON.stringify({
        agreementId,
        type: '45min',
        sendAt: new Date(Date.now() + 45 * 60 * 1000).toISOString()
      }));
      
      // Send initial email
      try {
        await resend.emails.send({
          from: 'AutoPosterPro <support@autoposterpro.com>',
          to: contactEmail,
          subject: `Agreement Ready for Signature - ${dealerName}`,
          html: generateAgreementEmail(agreement, 'initial')
        });
      } catch (emailError) {
        console.error('Failed to send agreement email:', emailError);
      }
      
      return res.status(201).json({ 
        success: true, 
        agreement,
        signatureUrl: agreement.signatureUrl
      });
    }
    
    // PUT - Sign agreement (customer)
    if (req.method === 'PUT') {
      const { id, token, signature, signerName, signerTitle, ipAddress } = req.body;
      
      if (!id || !token || !signature || !signerName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const agreement = await kv.get(id);
      if (!agreement) return res.status(404).json({ error: 'Agreement not found' });
      
      if (agreement.signatureToken !== token) {
        return res.status(403).json({ error: 'Invalid signature token' });
      }
      
      if (agreement.status === 'customer_signed' || agreement.status === 'fully_signed') {
        return res.status(400).json({ error: 'Agreement already signed' });
      }
      
      if (new Date(agreement.expiresAt) < new Date()) {
        agreement.status = 'expired';
        await kv.set(id, agreement);
        return res.status(400).json({ error: 'Agreement has expired' });
      }
      
      // Record customer signature
      agreement.status = 'customer_signed';
      agreement.customerSignedAt = new Date().toISOString();
      agreement.customerSignatureData = {
        signature,
        signerName,
        signerTitle: signerTitle || '',
        ipAddress: ipAddress || req.headers['x-forwarded-for'] || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        signedAt: new Date().toISOString()
      };
      
      await kv.set(id, agreement);
      
      // Notify admin that customer has signed
      try {
        await resend.emails.send({
          from: 'AutoPosterPro <support@autoposterpro.com>',
          to: 'admin@autoposterpro.com',
          subject: `Agreement Signed by ${agreement.dealerName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7c3aed;">Customer Has Signed!</h2>
              <p><strong>${agreement.contactName}</strong> from <strong>${agreement.dealerName}</strong> has signed their agreement.</p>
              <p><strong>Plan:</strong> ${agreement.planName} - $${agreement.finalMonthly}/mo</p>
              <p><strong>Signed at:</strong> ${new Date().toLocaleString()}</p>
              <p style="margin-top: 20px;">
                <a href="${BASE_URL}/dashboard" style="background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">
                  Counter-Sign Now
                </a>
              </p>
            </div>
          `
        });
      } catch (e) {
        console.error('Failed to send admin notification:', e);
      }
      
      // Send confirmation to customer
      try {
        await resend.emails.send({
          from: 'AutoPosterPro <support@autoposterpro.com>',
          to: agreement.contactEmail,
          subject: `Signature Received - ${agreement.dealerName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7c3aed;">Thank You for Signing!</h2>
              <p>Hi ${agreement.contactFirstName || agreement.contactName},</p>
              <p>We've received your signature on the AutoPosterPro agreement for <strong>${agreement.dealerName}</strong>.</p>
              <p>Our team will counter-sign shortly to finalize the agreement. You'll receive a copy of the fully executed document once complete.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #666; font-size: 12px;">AutoPosterPro | <a href="${BASE_URL}" style="color: #7c3aed;">autoposterpro.com</a></p>
            </div>
          `
        });
      } catch (e) {
        console.error('Failed to send customer confirmation:', e);
      }
      
      return res.status(200).json({ success: true, agreement });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Agreements API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

function generateSignatureToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function generateAgreementEmail(agreement, type) {
  const baseHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #7c3aed; margin: 0;">AutoPosterPro</h1>
      </div>
  `;
  
  if (type === 'initial') {
    const taxNote = agreement.country === 'CA' 
      ? 'All fees plus applicable GST/HST/PST' 
      : 'All fees plus applicable state/local taxes';
    
    return baseHtml + `
      <h2>Agreement Ready for Signature</h2>
      <p>Hi ${agreement.contactFirstName || agreement.contactName},</p>
      <p>Your AutoPosterPro agreement for <strong>${agreement.dealerName}</strong> is ready for your signature.</p>
      
      <div style="background: #f8f4ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #7c3aed;">Agreement Summary</h3>
        <p><strong>Plan:</strong> ${agreement.planName}</p>
        <p><strong>Monthly Fee:</strong> $${agreement.finalMonthly.toFixed(2)} ${agreement.country === 'CA' ? 'CAD' : 'USD'}</p>
        <p><strong>Setup Fee:</strong> $${agreement.finalSetup.toFixed(2)} ${agreement.country === 'CA' ? 'CAD' : 'USD'}</p>
        ${agreement.discount > 0 ? `<p><strong>Discount:</strong> ${agreement.discount}%</p>` : ''}
        <p style="font-size: 13px; color: #666; margin-top: 10px;"><em>${taxNote}</em></p>
      </div>
      
      <p style="margin: 30px 0; text-align: center;">
        <a href="${agreement.signatureUrl}" 
           style="background: #7c3aed; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          Review & Sign Agreement
        </a>
      </p>
      
      <p style="color: #666; font-size: 14px;">This agreement will expire on ${new Date(agreement.expiresAt).toLocaleDateString()}.</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">AutoPosterPro | <a href="${BASE_URL}" style="color: #7c3aed;">autoposterpro.com</a></p>
    </div>
    `;
  }
  
  if (type === 'reminder') {
    return baseHtml + `
      <h2>Friendly Reminder: Agreement Awaiting Signature</h2>
      <p>Hi ${agreement.contactFirstName || agreement.contactName},</p>
      <p>Just a quick reminder that your AutoPosterPro agreement for <strong>${agreement.dealerName}</strong> is still waiting for your signature.</p>
      
      <p style="margin: 30px 0; text-align: center;">
        <a href="${agreement.signatureUrl}" 
           style="background: #7c3aed; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          Sign Agreement Now
        </a>
      </p>
      
      <p style="color: #666; font-size: 14px;">This agreement will expire on ${new Date(agreement.expiresAt).toLocaleDateString()}.</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">AutoPosterPro | <a href="${BASE_URL}" style="color: #7c3aed;">autoposterpro.com</a></p>
    </div>
    `;
  }
  
  return baseHtml + '</div>';
}
