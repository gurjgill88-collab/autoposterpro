// api/agreements/resend.js
// Resend agreement email

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
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Agreement ID required' });
    }
    
    const agreement = await kv.get(id);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }
    
    if (agreement.status === 'fully_signed') {
      return res.status(400).json({ error: 'Agreement is already fully signed' });
    }
    
    if (agreement.status === 'expired') {
      return res.status(400).json({ error: 'Agreement has expired. Create a new one.' });
    }
    
    // Update sent timestamp
    agreement.sentAt = new Date().toISOString();
    // Extend expiry by 7 more days
    agreement.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await kv.set(id, agreement);
    
    // Send email
    try {
      await resend.emails.send({
        from: 'AutoPosterPro <support@autoposterpro.com>',
        to: agreement.contactEmail,
        subject: `Reminder: Agreement Ready for Signature - ${agreement.dealerName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #7c3aed; margin: 0;">AutoPosterPro</h1>
            </div>
            
            <h2>Your Agreement is Waiting</h2>
            <p>Hi ${agreement.contactFirstName || agreement.contactName},</p>
            <p>This is a friendly reminder that your AutoPosterPro agreement for <strong>${agreement.dealerName}</strong> is ready for your signature.</p>
            
            <div style="background: #f8f4ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #7c3aed;">Agreement Summary</h3>
              <p><strong>Plan:</strong> ${agreement.planName}</p>
              <p><strong>Monthly Fee:</strong> $${agreement.finalMonthly}</p>
              <p><strong>Setup Fee:</strong> $${agreement.finalSetup}</p>
              ${agreement.discount > 0 ? `<p><strong>Discount:</strong> ${agreement.discount}%</p>` : ''}
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
        `
      });
    } catch (emailError) {
      console.error('Failed to resend agreement email:', emailError);
      return res.status(500).json({ error: 'Failed to send email' });
    }
    
    return res.status(200).json({ success: true, message: 'Agreement resent' });
    
  } catch (error) {
    console.error('Resend agreement error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
