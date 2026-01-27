// Agreements API
// Digital signature and EULA management

import { kv } from '@vercel/kv';

// EULA Templates
const EULA_TEMPLATES = {
  CA: {
    title: 'End User License Agreement (Canada)',
    jurisdiction: 'Province of Ontario, Canada',
    currency: 'CAD',
    privacyLaw: 'Personal Information Protection and Electronic Documents Act (PIPEDA)',
    disputeResolution: 'binding arbitration in accordance with the Arbitration Act (Ontario)',
    content: `
END USER LICENSE AGREEMENT

This End User License Agreement ("Agreement") is entered into between AutoPosterPro Inc. ("Company") and the undersigned dealer ("Dealer").

1. LICENSE GRANT
Company grants Dealer a non-exclusive, non-transferable license to use the AutoPosterPro software extension ("Software") for posting vehicle listings to Facebook Marketplace.

2. SUBSCRIPTION TERMS
- Monthly subscription: $99 CAD per month
- Annual subscription: $948 CAD per year
- 60-day cancellation notice required
- Fees are non-refundable

3. ACCEPTABLE USE
Dealer agrees to:
- Use Software only for legitimate vehicle listings
- Maintain accurate vehicle information
- Comply with Facebook Marketplace terms of service
- Not share login credentials or license keys

4. DATA PRIVACY
Company complies with PIPEDA. Dealer data is stored securely and used only for service delivery.

5. LIMITATION OF LIABILITY
Company's liability shall not exceed fees paid in the 12 months preceding any claim.

6. GOVERNING LAW
This Agreement shall be governed by the laws of the Province of Ontario, Canada.

7. DISPUTE RESOLUTION
Any disputes shall be resolved through binding arbitration in accordance with the Arbitration Act (Ontario).

8. TERMINATION
Either party may terminate with 60 days written notice. Company may terminate immediately for breach.
`
  },
  US: {
    title: 'End User License Agreement (United States)',
    jurisdiction: 'State of Delaware, United States',
    currency: 'USD',
    privacyLaw: 'California Consumer Privacy Act (CCPA) where applicable',
    disputeResolution: 'binding arbitration in accordance with the Federal Arbitration Act',
    content: `
END USER LICENSE AGREEMENT

This End User License Agreement ("Agreement") is entered into between AutoPosterPro Inc. ("Company") and the undersigned dealer ("Dealer").

1. LICENSE GRANT
Company grants Dealer a non-exclusive, non-transferable license to use the AutoPosterPro software extension ("Software") for posting vehicle listings to Facebook Marketplace.

2. SUBSCRIPTION TERMS
- Monthly subscription: $99 USD per month
- Annual subscription: $948 USD per year
- 60-day cancellation notice required
- Fees are non-refundable

3. ACCEPTABLE USE
Dealer agrees to:
- Use Software only for legitimate vehicle listings
- Maintain accurate vehicle information
- Comply with Facebook Marketplace terms of service
- Not share login credentials or license keys

4. DATA PRIVACY
Company complies with applicable privacy laws including CCPA. Dealer data is stored securely and used only for service delivery.

5. LIMITATION OF LIABILITY
TO THE MAXIMUM EXTENT PERMITTED BY LAW, COMPANY'S LIABILITY SHALL NOT EXCEED FEES PAID IN THE 12 MONTHS PRECEDING ANY CLAIM.

6. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Delaware, United States, without regard to conflicts of law principles.

7. DISPUTE RESOLUTION
Any disputes shall be resolved through binding arbitration in accordance with the Federal Arbitration Act. CLASS ACTION WAIVER: Dealer agrees to resolve disputes individually and waives any right to participate in class actions.

8. TERMINATION
Either party may terminate with 60 days written notice. Company may terminate immediately for breach.
`
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    // GET - List agreements or get EULA template
    if (req.method === 'GET') {
      const { country, id } = req.query;
      
      // Return EULA template for country
      if (country) {
        const template = EULA_TEMPLATES[country] || EULA_TEMPLATES.CA;
        return res.status(200).json({ template });
      }
      
      // Get specific agreement
      if (id) {
        const agreement = await kv.get(id);
        if (!agreement) return res.status(404).json({ error: 'Agreement not found' });
        return res.status(200).json({ agreement });
      }
      
      // List all agreements (admin)
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ error: 'Admin access required' });
      }
      
      const agreementIds = await kv.lrange('agreements', 0, -1) || [];
      const agreements = [];
      
      for (const agId of agreementIds) {
        const ag = await kv.get(agId);
        if (ag) agreements.push(ag);
      }
      
      return res.status(200).json({ agreements });
    }
    
    // POST - Create and send agreement for signature
    if (req.method === 'POST') {
      const { 
        dealId,
        dealerName,
        contactName,
        contactEmail,
        country,
        customTerms
      } = req.body;
      
      if (!dealerName || !contactName || !contactEmail) {
        return res.status(400).json({ error: 'Dealer name, contact, and email required' });
      }
      
      const template = EULA_TEMPLATES[country] || EULA_TEMPLATES.CA;
      const agreementId = `agreement:${Date.now()}`;
      const signatureToken = generateSignatureToken();
      
      const agreement = {
        id: agreementId,
        dealId: dealId || null,
        dealerName,
        contactName,
        contactEmail,
        country: country || 'CA',
        title: template.title,
        content: template.content,
        customTerms: customTerms || null,
        status: 'pending', // pending, signed, expired, voided
        signatureToken,
        signatureUrl: `https://autoposterpro.com/sign/${agreementId}?token=${signatureToken}`,
        createdAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        signedAt: null,
        signatureData: null,
        ipAddress: null
      };
      
      await kv.set(agreementId, agreement);
      await kv.lpush('agreements', agreementId);
      
      // TODO: Send email with Resend
      // await sendAgreementEmail(agreement);
      
      return res.status(201).json({ 
        success: true, 
        agreement,
        signatureUrl: agreement.signatureUrl
      });
    }
    
    // PUT - Sign agreement
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
      
      if (agreement.status === 'signed') {
        return res.status(400).json({ error: 'Agreement already signed' });
      }
      
      if (new Date(agreement.expiresAt) < new Date()) {
        agreement.status = 'expired';
        await kv.set(id, agreement);
        return res.status(400).json({ error: 'Agreement has expired' });
      }
      
      // Record signature
      agreement.status = 'signed';
      agreement.signedAt = new Date().toISOString();
      agreement.signatureData = {
        signature, // Base64 signature image or typed name
        signerName,
        signerTitle: signerTitle || '',
        ipAddress: ipAddress || req.headers['x-forwarded-for'] || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      };
      
      await kv.set(id, agreement);
      
      // Update deal if linked
      if (agreement.dealId) {
        const deal = await kv.get(agreement.dealId);
        if (deal) {
          deal.agreementSigned = true;
          deal.agreementId = id;
          deal.updatedAt = new Date().toISOString();
          await kv.set(agreement.dealId, deal);
        }
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
