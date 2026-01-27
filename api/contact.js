// Contact Form API
// Stores contact submissions and triggers immediate follow-up email

import { kv } from '../lib/redis.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const { firstName, lastName, dealership, email, phone, interest, message } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !dealership || !email || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Store the contact submission
    const contactId = `contact-${Date.now()}`;
    const contact = {
      id: contactId,
      firstName,
      lastName,
      dealership,
      email,
      phone,
      interest: interest || 'general',
      message: message || '',
      submittedAt: new Date().toISOString(),
      status: 'new',
      sentEmails: [0], // Mark day 0 as sent (we're sending it now)
      lastEmailSent: new Date().toISOString(),
      lastEmailDay: 0
    };
    
    await kv.set(contactId, contact);
    await kv.lpush('contacts', contactId);
    
    // Send immediate thank you email (Day 0)
    try {
      await resend.emails.send({
        from: 'AutoPosterPro <support@autoposterpro.com>',
        to: email,
        subject: 'Thanks for reaching out to AutoPosterPro!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Auto<span style="color: #f97316;">Poster</span>Pro</h1>
            </div>
            
            <div style="padding: 30px; background: #f9fafb;">
              <h2 style="color: #1f2937;">Hi ${firstName}! 👋</h2>
              
              <p style="color: #4b5563; font-size: 16px;">
                Thanks for your interest in AutoPosterPro for <strong>${dealership}</strong>!
              </p>
              
              <p style="color: #4b5563; font-size: 16px;">
                We received your message and will get back to you within 24 hours.
              </p>
              
              <p style="color: #4b5563; font-size: 16px;">
                In the meantime, here's what AutoPosterPro can do for your dealership:
              </p>
              
              <ul style="color: #4b5563; font-size: 14px;">
                <li>✅ Post to Facebook Marketplace in seconds (not minutes)</li>
                <li>✅ AI-powered descriptions that avoid shadowbans</li>
                <li>✅ Works with ANY dealer website</li>
                <li>✅ One-click vehicle data scraping</li>
              </ul>
              
              <p style="color: #4b5563; font-size: 16px;">
                Talk soon!<br>
                <strong>The AutoPosterPro Team</strong>
              </p>
            </div>
            
            <div style="background: #1f2937; padding: 20px; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2026 AutoPosterPro | <a href="https://autoposterpro.com" style="color: #7c3aed;">autoposterpro.com</a>
              </p>
            </div>
          </div>
        `
      });
      console.log('Welcome email sent to:', email);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the request if email fails
    }
    
    // Also send notification to admin
    try {
      await resend.emails.send({
        from: 'AutoPosterPro <support@autoposterpro.com>',
        to: 'support@autoposterpro.com',
        subject: `🚗 New Lead: ${dealership}`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${firstName} ${lastName}</p>
            <p><strong>Dealership:</strong> ${dealership}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Interest:</strong> ${interest || 'Not specified'}</p>
            <p><strong>Message:</strong> ${message || 'No message'}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            <hr>
            <p><a href="https://autoposterpro.com/admin">View in Admin Dashboard</a></p>
          </div>
        `
      });
    } catch (notifyError) {
      console.error('Failed to send admin notification:', notifyError);
    }
    
    console.log('New contact submission:', email, dealership);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Contact form submitted successfully' 
    });
    
  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
