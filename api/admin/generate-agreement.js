// Agreement PDF Generation API
// Generates a pre-filled EULA/Service Agreement for dealer signature

import { kv } from '../../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Check admin authorization
  const adminKey = req.headers.authorization?.replace('Bearer ', '');
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const {
      dealerName,
      dealerNumber,
      contactName,
      contactEmail,
      contactPhone,
      address,
      plan,      // 'monthly' or 'annual'
      price,
      startDate
    } = req.body;
    
    // Validate required fields
    if (!dealerName || !contactName || !contactEmail || !plan || !price) {
      return res.status(400).json({ 
        error: 'Missing required fields: dealerName, contactName, contactEmail, plan, price' 
      });
    }
    
    // Store agreement info
    const agreementId = `agreement-${Date.now()}`;
    const agreement = {
      id: agreementId,
      dealerName,
      dealerNumber: dealerNumber || '',
      contactName,
      contactEmail,
      contactPhone: contactPhone || '',
      address: address || '',
      plan,
      price,
      startDate: startDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      status: 'pending_signature'
    };
    
    await kv.set(agreementId, agreement);
    await kv.lpush('agreements', agreementId);
    
    // In a full implementation, you would:
    // 1. Generate the PDF server-side (using a Python microservice or serverless function)
    // 2. Send it via email to the dealer
    // 3. Integrate with a digital signature service like DocuSign, HelloSign, or PandaDoc
    
    // For now, return the agreement data that can be used client-side
    return res.status(200).json({
      success: true,
      agreementId,
      agreement,
      message: 'Agreement created. Use the dealer info to generate PDF.',
      // This data structure matches what the Python script expects
      pdfData: {
        dealer_name: dealerName,
        dealer_number: dealerNumber || '',
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone || '',
        address: address || '',
        plan: plan,
        price: price,
        start_date: startDate || new Date().toISOString().split('T')[0]
      }
    });
    
  } catch (error) {
    console.error('Agreement generation error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
