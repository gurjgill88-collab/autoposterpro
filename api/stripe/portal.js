// Stripe Customer Portal
// Allows customers to manage their subscription and payment methods

import Stripe from 'stripe';
import { kv } from '@vercel/kv';

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
    const { licenseKey, email } = req.body;
    
    if (!licenseKey && !email) {
      return res.status(400).json({ error: 'License key or email required' });
    }
    
    let customerId;
    
    if (licenseKey) {
      // Get customer ID from license
      const license = await kv.get(`license:${licenseKey}`);
      if (!license) {
        return res.status(404).json({ error: 'License not found' });
      }
      customerId = license.stripeCustomerId;
    } else {
      // Look up customer by email
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      customerId = customers.data[0].id;
    }
    
    if (!customerId) {
      return res.status(404).json({ error: 'No Stripe customer found' });
    }
    
    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_URL || 'https://autoposterpro.com'}/account`,
    });
    
    return res.status(200).json({ 
      success: true,
      url: session.url 
    });
    
  } catch (error) {
    console.error('Portal error:', error);
    return res.status(500).json({ error: error.message });
  }
}
