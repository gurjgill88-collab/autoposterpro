// api/contractor-agreements/sign.js
// Public endpoint for contractors to sign their agreement

import { kv } from '../../lib/redis.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://www.autoposterpro.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const { id, token } = req.query;
    
    // GET - Retrieve agreement for signing (validates token)
    if (req.method === 'GET') {
      if (!id || !token) {
        return res.status(400).json({ error: 'Agreement ID and token required' });
      }
      
      const agreement = await kv.get(id);
      if (!agreement) {
        return res.status(404).json({ error: 'Agreement not found' });
      }
      
      if (agreement.signatureToken !== token) {
        return res.status(403).json({ error: 'Invalid signature token' });
      }
      
      if (agreement.status === 'active') {
        return res.status(400).json({ error: 'Agreement already fully signed' });
      }
      
      if (new Date(agreement.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'Agreement has expired' });
      }
      
      // Track view
      agreement.viewCount = (agreement.viewCount || 0) + 1;
      agreement.lastViewedAt = new Date().toISOString();
      if (agreement.status === 'pending') {
        agreement.status = 'viewed';
      }
      await kv.set(id, agreement);
      
      // Return agreement without sensitive data
      return res.status(200).json({
        agreement: {
          id: agreement.id,
          contractorName: agreement.contractorName,
          contractorEmail: agreement.contractorEmail,
          country: agreement.country,
          startDate: agreement.startDate,
          commissionRate: agreement.commissionRate,
          content: agreement.content,
          status: agreement.status,
          expiresAt: agreement.expiresAt,
          contractorSignedAt: agreement.contractorSignedAt
        }
      });
    }
    
    // POST - Submit contractor signature
    if (req.method === 'POST') {
      const { signature, signerName, initials, agreedToTerms } = req.body;
      
      if (!id || !token) {
        return res.status(400).json({ error: 'Agreement ID and token required' });
      }
      
      if (!signature || !signerName || !agreedToTerms) {
        return res.status(400).json({ error: 'Signature, name, and agreement confirmation required' });
      }
      
      const agreement = await kv.get(id);
      if (!agreement) {
        return res.status(404).json({ error: 'Agreement not found' });
      }
      
      if (agreement.signatureToken !== token) {
        return res.status(403).json({ error: 'Invalid signature token' });
      }
      
      if (agreement.contractorSignedAt) {
        return res.status(400).json({ error: 'Agreement already signed by contractor' });
      }
      
      if (new Date(agreement.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'Agreement has expired' });
      }
      
      // Record signature
      agreement.status = 'signed';
      agreement.contractorSignedAt = new Date().toISOString();
      agreement.contractorSignatureData = {
        signature,
        signerName,
        initials,
        agreedToTerms: true,
        signedAt: new Date().toISOString(),
        ipAddress: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      };
      
      await kv.set(id, agreement);
      
      // Send confirmation to contractor
      try {
        await resend.emails.send({
          from: 'AutoPosterPro <hr@autoposterpro.com>',
          to: agreement.contractorEmail,
          subject: 'Signature Received - Independent Contractor Agreement',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7c3aed;">Thank You for Signing</h2>
              <p>Hi ${agreement.contractorName},</p>
              <p>We have received your signature on the Independent Contractor Agreement.</p>
              <p>Our team will review and counter-sign the agreement. You will receive a copy of the fully executed agreement once complete.</p>
              
              <div style="background: #f8f4ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Agreement ID:</strong> ${agreement.id}</p>
                <p><strong>Signed:</strong> ${new Date().toLocaleString()}</p>
              </div>
              
              <p>If you have any questions, please contact hr@autoposterpro.com</p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #666; font-size: 12px;">AutoPosterPro Inc.</p>
            </div>
          `
        });
      } catch (e) {
        console.error('Failed to send contractor signature confirmation:', e);
      }
      
      // Notify admin
      try {
        await resend.emails.send({
          from: 'AutoPosterPro <hr@autoposterpro.com>',
          to: 'admin@autoposterpro.com',
          subject: `Contractor Agreement Signed - ${agreement.contractorName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7c3aed;">Contractor Agreement Signed</h2>
              <p><strong>${agreement.contractorName}</strong> has signed their Independent Contractor Agreement.</p>
              
              <div style="background: #f8f4ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Name:</strong> ${agreement.contractorName}</p>
                <p><strong>Email:</strong> ${agreement.contractorEmail}</p>
                <p><strong>Country:</strong> ${agreement.country}</p>
                <p><strong>Commission Rate:</strong> ${agreement.commissionRate}%</p>
                <p><strong>Start Date:</strong> ${agreement.startDate}</p>
              </div>
              
              <p>Please review and counter-sign the agreement in the admin dashboard.</p>
              
              <p style="margin: 20px 0;">
                <a href="${BASE_URL}/dashboard.html#contractors" 
                   style="background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                  Review & Counter-Sign
                </a>
              </p>
            </div>
          `
        });
      } catch (e) {
        console.error('Failed to send admin notification:', e);
      }
      
      return res.status(200).json({ success: true, message: 'Agreement signed successfully' });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Contractor sign API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
