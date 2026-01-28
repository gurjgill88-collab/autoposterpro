// api/careers.js
// Job posting and application management

import { kv } from '../lib/redis.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    // GET - List jobs
    if (req.method === 'GET') {
      const { all, id } = req.query;
      
      // Get specific job
      if (id) {
        const job = await kv.get(id);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        return res.status(200).json({ job });
      }
      
      const jobIds = await kv.lrange('job-postings', 0, -1) || [];
      const jobs = [];
      
      // Check if admin
      const token = req.headers.authorization?.replace('Bearer ', '');
      let isAdmin = token === process.env.ADMIN_SECRET_KEY;
      if (!isAdmin && token) {
        try {
          const payload = JSON.parse(Buffer.from(token, 'base64').toString());
          isAdmin = ['admin', 'super_admin'].includes(payload.role);
        } catch (e) {}
      }
      
      for (const jobId of jobIds) {
        const job = await kv.get(jobId);
        if (job) {
          if (isAdmin && all === 'true') {
            jobs.push(job);
          } else if (job.status === 'active') {
            jobs.push({
              id: job.id,
              title: job.title,
              location: job.location,
              type: job.type,
              compensation: job.compensation,
              shortDescription: job.shortDescription,
              status: job.status,
              createdAt: job.createdAt
            });
          }
        }
      }
      
      jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({ jobs });
    }
    
    // POST - Create job (admin only)
    if (req.method === 'POST') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'Auth required' });
      
      let isAdmin = token === process.env.ADMIN_SECRET_KEY;
      if (!isAdmin) {
        try {
          const payload = JSON.parse(Buffer.from(token, 'base64').toString());
          isAdmin = ['admin', 'super_admin'].includes(payload.role);
        } catch (e) {}
      }
      if (!isAdmin) return res.status(403).json({ error: 'Admin required' });
      
      const { title, location, type, compensation, shortDescription, fullDescription, requirements, responsibilities, benefits, status } = req.body;
      
      if (!title) return res.status(400).json({ error: 'Title required' });
      
      const jobId = `job:${Date.now()}`;
      const job = {
        id: jobId,
        title,
        location: location || 'Remote (Canada/USA)',
        type: type || 'Independent Contractor',
        compensation: compensation || 'Commission-based',
        shortDescription: shortDescription || '',
        fullDescription: fullDescription || '',
        requirements: requirements || [],
        responsibilities: responsibilities || [],
        benefits: benefits || [],
        status: status || 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        applicationCount: 0
      };
      
      await kv.set(jobId, job);
      await kv.lpush('job-postings', jobId);
      
      return res.status(201).json({ success: true, job });
    }
    
    // PUT - Update job (admin only)
    if (req.method === 'PUT') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'Auth required' });
      
      let isAdmin = token === process.env.ADMIN_SECRET_KEY;
      if (!isAdmin) {
        try {
          const payload = JSON.parse(Buffer.from(token, 'base64').toString());
          isAdmin = ['admin', 'super_admin'].includes(payload.role);
        } catch (e) {}
      }
      if (!isAdmin) return res.status(403).json({ error: 'Admin required' });
      
      const { id, ...updates } = req.body;
      if (!id) return res.status(400).json({ error: 'Job ID required' });
      
      const job = await kv.get(id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      
      const updatedJob = { ...job, ...updates, updatedAt: new Date().toISOString() };
      await kv.set(id, updatedJob);
      
      return res.status(200).json({ success: true, job: updatedJob });
    }
    
    // DELETE - Remove job (admin only)
    if (req.method === 'DELETE') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'Auth required' });
      
      let isAdmin = token === process.env.ADMIN_SECRET_KEY;
      if (!isAdmin) {
        try {
          const payload = JSON.parse(Buffer.from(token, 'base64').toString());
          isAdmin = ['admin', 'super_admin'].includes(payload.role);
        } catch (e) {}
      }
      if (!isAdmin) return res.status(403).json({ error: 'Admin required' });
      
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Job ID required' });
      
      await kv.del(id);
      await kv.lrem('job-postings', 0, id);
      
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Careers API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
