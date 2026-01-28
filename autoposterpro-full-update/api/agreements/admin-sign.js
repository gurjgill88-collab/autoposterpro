// api/agreements/admin-sign.js
// Admin counter-signature endpoint

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
  
  // Verify admin auth
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Decode token to check role
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (!['super_admin', 'admin'].includes(payload.role)) {
      return res.status(403).json({ error: 'Admin access required for counter-signing' });
    }
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  try {
    const { id, signerName, signerTitle, signature } = req.body;
    
    if (!id || !signerName || !signature) {
      return res.status(400).json({ error: 'Agreement ID, signer name, and signature required' });
    }
    
    const agreement = await kv.get(id);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }
    
    if (agreement.status !== 'customer_signed') {
      return res.status(400).json({ error: 'Agreement must be signed by customer first' });
    }
    
    // Record admin signature
    agreement.status = 'fully_signed';
    agreement.adminSignedAt = new Date().toISOString();
    agreement.adminSignatureData = {
      signature,
      signerName,
      signerTitle: signerTitle || '',
      signedAt: new Date().toISOString()
    };
    
    await kv.set(id, agreement);
    
    // Send fully executed agreement to customer
    try {
      await resend.emails.send({
        from: 'AutoPosterPro <support@autoposterpro.com>',
        to: agreement.contactEmail,
        subject: `Agreement Fully Executed - ${agreement.dealerName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c3aed;">Agreement Complete!</h2>
            <p>Hi ${agreement.contactFirstName || agreement.contactName},</p>
            <p>Great news! Your AutoPosterPro agreement for <strong>${agreement.dealerName}</strong> has been fully executed.</p>
            
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
              <h3 style="margin-top: 0; color: #22c55e;">Agreement Summary</h3>
              <p><strong>Plan:</strong> ${agreement.planName}</p>
              <p><strong>Monthly Fee:</strong> $${agreement.finalMonthly}</p>
              <p><strong>Setup Fee:</strong> $${agreement.finalSetup}</p>
              <p><strong>Start Date:</strong> ${agreement.startDate}</p>
            </div>
            
            <p><strong>What's Next?</strong></p>
            <ul>
              <li>Our team will reach out within 24 hours to schedule your setup call</li>
              <li>You'll receive your license key and installation instructions</li>
              <li>We'll have you posting vehicles in no time!</li>
            </ul>
            
            <p>Thank you for choosing AutoPosterPro!</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">AutoPosterPro | <a href="${BASE_URL}" style="color: #7c3aed;">autoposterpro.com</a></p>
          </div>
        `
      });
    } catch (e) {
      console.error('Failed to send completion email:', e);
    }
    
    return res.status(200).json({ success: true, agreement });
    
  } catch (error) {
    console.error('Admin sign error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
