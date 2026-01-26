// Stripe Webhook Handler
// Handles subscription events: created, updated, cancelled, payment failed

import Stripe from 'stripe';
import { kv } from '@vercel/kv';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// Disable body parsing - Stripe needs raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Generate license key
function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments = [];
  for (let s = 0; s < 3; s++) {
    let segment = '';
    for (let i = 0; i < 4; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return 'APP-' + segments.join('-');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
  
  console.log('Stripe webhook event:', event.type);
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // New subscription created via checkout
        const session = event.data.object;
        await handleNewSubscription(session);
        break;
      }
      
      case 'customer.subscription.created': {
        // Subscription created (backup handler)
        const subscription = event.data.object;
        console.log('Subscription created:', subscription.id);
        break;
      }
      
      case 'customer.subscription.updated': {
        // Subscription updated (plan change, renewal, etc.)
        const subscription = event.data.object;
        await handleSubscriptionUpdate(subscription);
        break;
      }
      
      case 'customer.subscription.deleted': {
        // Subscription cancelled
        const subscription = event.data.object;
        await handleSubscriptionCancelled(subscription);
        break;
      }
      
      case 'invoice.payment_failed': {
        // Payment failed
        const invoice = event.data.object;
        await handlePaymentFailed(invoice);
        break;
      }
      
      case 'invoice.payment_succeeded': {
        // Payment succeeded (renewal)
        const invoice = event.data.object;
        await handlePaymentSucceeded(invoice);
        break;
      }
      
      default:
        console.log('Unhandled event type:', event.type);
    }
    
    return res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

async function handleNewSubscription(session) {
  const {
    dealerName,
    dealerNumber,
    contactName,
    contactPhone,
    address,
    plan,
    numLicenses
  } = session.metadata;
  
  const customerEmail = session.customer_email;
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  const licensesCount = parseInt(numLicenses) || 1;
  
  console.log('New subscription for:', dealerName, customerEmail, 'Licenses:', licensesCount);
  
  // Generate license key(s)
  const licenseKeys = [];
  for (let i = 0; i < licensesCount; i++) {
    const licenseKey = generateLicenseKey();
    licenseKeys.push(licenseKey);
    
    // Create license in database
    const license = {
      dealerName: dealerName || '',
      dealerNumber: dealerNumber || '',
      contactName: contactName || '',
      contactEmail: customerEmail,
      contactPhone: contactPhone || '',
      address: address || '',
      plan: plan || 'professional',
      active: true,
      deviceId: null,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      licenseIndex: i + 1,
      totalLicenses: licensesCount,
      createdAt: new Date().toISOString(),
      activatedAt: null,
      lastUsed: null,
    };
    
    await kv.set(`license:${licenseKey}`, license);
  }
  
  // Store mapping from Stripe subscription to all license keys
  await kv.set(`stripe:${subscriptionId}`, JSON.stringify(licenseKeys));
  
  // Send welcome email with license key(s)
  await sendWelcomeEmail(customerEmail, contactName, dealerName, licenseKeys, plan);
  
  console.log('License(s) created:', licenseKeys.join(', '));
}

async function handleSubscriptionUpdate(subscription) {
  const licenseKey = await kv.get(`stripe:${subscription.id}`);
  
  if (!licenseKey) {
    console.log('No license found for subscription:', subscription.id);
    return;
  }
  
  const license = await kv.get(`license:${licenseKey}`);
  
  if (license) {
    // Update license status based on subscription status
    license.active = subscription.status === 'active' || subscription.status === 'trialing';
    license.subscriptionStatus = subscription.status;
    license.updatedAt = new Date().toISOString();
    
    await kv.set(`license:${licenseKey}`, license);
    console.log('License updated:', licenseKey, 'Status:', subscription.status);
  }
}

async function handleSubscriptionCancelled(subscription) {
  const licenseKeysJson = await kv.get(`stripe:${subscription.id}`);
  
  if (!licenseKeysJson) {
    console.log('No license found for subscription:', subscription.id);
    return;
  }
  
  // Handle both old (single string) and new (JSON array) formats
  let licenseKeys;
  try {
    licenseKeys = JSON.parse(licenseKeysJson);
  } catch {
    licenseKeys = [licenseKeysJson]; // Old format was just a string
  }
  
  let contactEmail, contactName, dealerName;
  
  for (const licenseKey of licenseKeys) {
    const license = await kv.get(`license:${licenseKey}`);
    
    if (license) {
      // Save contact info for email
      if (!contactEmail) {
        contactEmail = license.contactEmail;
        contactName = license.contactName;
        dealerName = license.dealerName;
      }
      
      // Deactivate the license
      license.active = false;
      license.subscriptionStatus = 'cancelled';
      license.cancelledAt = new Date().toISOString();
      
      await kv.set(`license:${licenseKey}`, license);
      console.log('License cancelled:', licenseKey);
    }
  }
  
  // Send cancellation email (once)
  if (contactEmail) {
    await sendCancellationEmail(contactEmail, contactName, dealerName);
  }
}

async function handlePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;
  const licenseKey = await kv.get(`stripe:${subscriptionId}`);
  
  if (!licenseKey) return;
  
  const license = await kv.get(`license:${licenseKey}`);
  
  if (license) {
    // Send payment failed email
    await sendPaymentFailedEmail(license.contactEmail, license.contactName, license.dealerName);
    console.log('Payment failed notification sent for:', licenseKey);
  }
}

async function handlePaymentSucceeded(invoice) {
  const subscriptionId = invoice.subscription;
  const licenseKey = await kv.get(`stripe:${subscriptionId}`);
  
  if (!licenseKey) return;
  
  const license = await kv.get(`license:${licenseKey}`);
  
  if (license) {
    // Ensure license is active
    license.active = true;
    license.lastPaymentAt = new Date().toISOString();
    await kv.set(`license:${licenseKey}`, license);
    
    console.log('Payment succeeded for:', licenseKey);
  }
}

// ============ EMAIL TEMPLATES ============

async function sendWelcomeEmail(email, name, dealerName, licenseKeys, plan) {
  // Ensure licenseKeys is an array
  const keys = Array.isArray(licenseKeys) ? licenseKeys : [licenseKeys];
  const isEnterprise = keys.length > 1;
  
  const licenseKeysHtml = keys.map((key, i) => `
    <div style="background: white; border: 2px solid #7c3aed; border-radius: 12px; padding: 15px; text-align: center; margin: 10px 0;">
      <p style="color: #6b7280; margin: 0 0 5px 0; font-size: 12px;">License Key ${isEnterprise ? (i + 1) : ''}</p>
      <p style="font-family: monospace; font-size: 20px; color: #7c3aed; font-weight: bold; margin: 0;">
        ${key}
      </p>
    </div>
  `).join('');
  
  try {
    await resend.emails.send({
      from: 'AutoPosterPro <support@autoposterpro.com>',
      to: email,
      subject: '🎉 Welcome to AutoPosterPro! Your License Key(s) Inside',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Auto<span style="color: #f97316;">Poster</span>Pro</h1>
          </div>
          
          <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #1f2937;">Welcome, ${name}! 🚗</h2>
            
            <p style="color: #4b5563; font-size: 16px;">
              Thank you for subscribing to AutoPosterPro <strong>${plan === 'enterprise' ? 'Enterprise' : 'Professional'}</strong> for <strong>${dealerName}</strong>!
            </p>
            
            <p style="color: #4b5563; font-size: 16px;">
              ${isEnterprise ? `Your plan includes <strong>${keys.length} license keys</strong> - one for each user:` : 'Your license key:'}
            </p>
            
            ${licenseKeysHtml}
            
            <h3 style="color: #1f2937; margin-top: 25px;">Getting Started:</h3>
            <ol style="color: #4b5563; font-size: 14px;">
              <li>We'll contact you within 24 hours to schedule your free setup session</li>
              <li>During the call, we'll install the Chrome extension on ${isEnterprise ? 'each user\'s computer' : 'your computer'}</li>
              <li>Enter the license key when prompted</li>
              <li>Start posting vehicles in seconds!</li>
            </ol>
            
            <p style="color: #4b5563; font-size: 14px;">
              Need help? We're here for you! Just reply to this email or contact us at 
              <a href="mailto:support@autoposterpro.com" style="color: #7c3aed;">support@autoposterpro.com</a>
            </p>
            
            <p style="color: #4b5563; font-size: 14px;">
              Happy selling! 🎉<br>
              <strong>The AutoPosterPro Team</strong>
            </p>
          </div>
          
          <div style="background: #1f2937; padding: 20px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              © 2026 AutoPosterPro. All rights reserved.<br>
              <a href="https://autoposterpro.com/privacy" style="color: #7c3aed;">Privacy Policy</a> | 
              <a href="https://autoposterpro.com/terms" style="color: #7c3aed;">Terms of Service</a>
            </p>
          </div>
        </div>
      `
    });
    console.log('Welcome email sent to:', email);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
  }
}

async function sendCancellationEmail(email, name, dealerName) {
  try {
    await resend.emails.send({
      from: 'AutoPosterPro <support@autoposterpro.com>',
      to: email,
      subject: 'Your AutoPosterPro Subscription Has Been Cancelled',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Auto<span style="color: #f97316;">Poster</span>Pro</h1>
          </div>
          
          <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #1f2937;">We're sorry to see you go, ${name}</h2>
            
            <p style="color: #4b5563; font-size: 16px;">
              Your AutoPosterPro subscription for <strong>${dealerName}</strong> has been cancelled.
            </p>
            
            <p style="color: #4b5563; font-size: 14px;">
              Your license key has been deactivated and the extension will no longer work.
            </p>
            
            <p style="color: #4b5563; font-size: 14px;">
              Changed your mind? You can resubscribe anytime at 
              <a href="https://autoposterpro.com/pricing" style="color: #7c3aed;">autoposterpro.com/pricing</a>
            </p>
            
            <p style="color: #4b5563; font-size: 14px;">
              We'd love to hear your feedback! Reply to this email and let us know how we could have done better.
            </p>
            
            <p style="color: #4b5563; font-size: 14px;">
              Best regards,<br>
              <strong>The AutoPosterPro Team</strong>
            </p>
          </div>
        </div>
      `
    });
    console.log('Cancellation email sent to:', email);
  } catch (error) {
    console.error('Failed to send cancellation email:', error);
  }
}

async function sendPaymentFailedEmail(email, name, dealerName) {
  try {
    await resend.emails.send({
      from: 'AutoPosterPro <support@autoposterpro.com>',
      to: email,
      subject: '⚠️ Payment Failed - Action Required',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Auto<span style="color: #f97316;">Poster</span>Pro</h1>
          </div>
          
          <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #ef4444;">⚠️ Payment Failed</h2>
            
            <p style="color: #4b5563; font-size: 16px;">
              Hi ${name}, we were unable to process your payment for <strong>${dealerName}</strong>'s AutoPosterPro subscription.
            </p>
            
            <p style="color: #4b5563; font-size: 14px;">
              Please update your payment method to avoid interruption to your service.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://autoposterpro.com/account" 
                 style="background: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Update Payment Method
              </a>
            </div>
            
            <p style="color: #4b5563; font-size: 14px;">
              If you have questions, contact us at 
              <a href="mailto:support@autoposterpro.com" style="color: #7c3aed;">support@autoposterpro.com</a>
            </p>
          </div>
        </div>
      `
    });
    console.log('Payment failed email sent to:', email);
  } catch (error) {
    console.error('Failed to send payment failed email:', error);
  }
}
