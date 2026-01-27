// CRM Login API
// Authenticate users

import { kv } from '../../lib/redis.js';

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
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Check for admin
    if (password === process.env.ADMIN_SECRET_KEY) {
      return res.status(200).json({
        success: true,
        user: {
          id: 'admin',
          firstName: 'Admin',
          lastName: 'User',
          email: email,
          role: 'admin'
        },
        token: password
      });
    }
    
    // Find user by email
    const userIds = await kv.lrange('crm-users', 0, -1) || [];
    
    for (const userId of userIds) {
      const user = await kv.get(userId);
      if (user && user.email === email && user.password === password) {
        if (user.status !== 'active') {
          return res.status(403).json({ error: 'Account is disabled' });
        }
        
        // Update last login
        user.lastLogin = new Date().toISOString();
        await kv.set(userId, user);
        
        const { password: _, ...safeUser } = user;
        return res.status(200).json({
          success: true,
          user: safeUser,
          token: user.id // In production, use JWT
        });
      }
    }
    
    return res.status(401).json({ error: 'Invalid credentials' });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
