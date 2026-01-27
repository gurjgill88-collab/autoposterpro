// Stripe Checkout Session Creator
// Creates a checkout session for new dealer subscriptions

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
      plan  // 'monthly' or 'annual'
    } = req.body;
    
    // Validate required fields
    if (!dealerName || !contactName || !contactEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get the correct price ID based on plan
    // You'll create these in Stripe Dashboard
    let priceId;
    let numLicenses;
    
    switch (plan) {
      case 'starter':
        priceId = process.env.STRIPE_PRICE_STARTER;  // $219/month for 1 license
        numLicenses = 1;
        break;
      case 'professional':
        priceId = process.env.STRIPE_PRICE_PROFESSIONAL;  // $1,199/month for 6-11 licenses
        numLicenses = 11; // Max licenses for the plan
        break;
      case 'enterprise':
        priceId = process.env.STRIPE_PRICE_ENTERPRISE;  // $1,799/month for 12-20 licenses
        numLicenses = 20; // Max licenses for the plan
        break;
      default:
        priceId = process.env.STRIPE_PRICE_STARTER;
        numLicenses = 1;
    }
    
    if (!priceId) {
      return res.status(500).json({ error: 'Price not configured for this plan' });
    }
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: contactEmail,
      currency: 'cad',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        dealerName,
        dealerNumber: dealerNumber || '',
        contactName,
        contactPhone: contactPhone || '',
        address: address || '',
        plan: plan || 'professional',
        numLicenses: numLicenses.toString()
      },
      subscription_data: {
        metadata: {
          dealerName,
          dealerNumber: dealerNumber || '',
          contactName,
          contactEmail,
        }
      },
      success_url: `${process.env.NEXT_PUBLIC_URL || 'https://autoposterpro.com'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL || 'https://autoposterpro.com'}/pricing`,
      allow_promotion_codes: true,
    });
    
    return res.status(200).json({ 
      success: true,
      sessionId: session.id,
      url: session.url 
    });
    
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({ error: error.message });
  }
}
