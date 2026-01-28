// api/careers/apply.js
// Handle job applications

import { kv } from '../../lib/redis.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { jobId, name, email, phone, location, coverLetter, experience, linkedin } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email required' });
    }
    
    // Get job details if jobId provided
    let jobTitle = 'General Application';
    if (jobId) {
      const job = await kv.get(jobId);
      if (job) {
        jobTitle = job.title;
        // Increment application count
        job.applicationCount = (job.applicationCount || 0) + 1;
        await kv.set(jobId, job);
      }
    }
    
    // Store application
    const applicationId = `application:${Date.now()}`;
    const application = {
      id: applicationId,
      jobId: jobId || 'general',
      jobTitle,
      name,
      email,
      phone: phone || '',
      location: location || '',
      linkedin: linkedin || '',
      coverLetter: coverLetter || '',
      experience: experience || '',
      status: 'new', // new, reviewed, interviewed, hired, rejected
      createdAt: new Date().toISOString()
    };
    
    await kv.set(applicationId, application);
    await kv.lpush('job-applications', applicationId);
    
    // Send notification email to admin
    try {
      await resend.emails.send({
        from: 'AutoPosterPro <hr@autoposterpro.com>',
        to: 'support@autoposterpro.com',
        subject: `New Job Application: ${jobTitle} - ${name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c3aed;">New Job Application</h2>
            
            <div style="background: #f8f4ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Position:</strong> ${jobTitle}</p>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
              ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
              ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
              ${linkedin ? `<p><strong>LinkedIn:</strong> <a href="${linkedin}">${linkedin}</a></p>` : ''}
            </div>
            
            ${coverLetter ? `
              <h3>Why They're Interested</h3>
              <p style="white-space: pre-wrap;">${coverLetter}</p>
            ` : ''}
            
            ${experience ? `
              <h3>Relevant Experience</h3>
              <p style="white-space: pre-wrap;">${experience}</p>
            ` : ''}
            
            <hr style="margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">Application ID: ${applicationId}</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Failed to send application notification:', emailError);
    }
    
    // Send confirmation to applicant
    try {
      await resend.emails.send({
        from: 'AutoPosterPro <hr@autoposterpro.com>',
        to: email,
        subject: `Application Received - ${jobTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c3aed;">Thank You for Applying!</h2>
            <p>Hi ${name},</p>
            <p>We've received your application for <strong>${jobTitle}</strong> at AutoPosterPro.</p>
            <p>Our team will review your application and get back to you if your qualifications match our needs.</p>
            <p>Best regards,<br>The AutoPosterPro Team</p>
            
            <hr style="margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              1553048 B.C. Ltd dba AutoPosterPro<br>
              <a href="https://www.autoposterpro.com">www.autoposterpro.com</a>
            </p>
          </div>
        `
      });
    } catch (e) {
      console.error('Failed to send applicant confirmation:', e);
    }
    
    return res.status(200).json({ success: true, applicationId });
    
  } catch (error) {
    console.error('Application error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
