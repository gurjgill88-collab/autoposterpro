// CRM Users API
// Manage team members with roles

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Check admin authorization
  const authKey = req.headers.authorization?.replace('Bearer ', '');
  if (authKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Admin access required' });
  }
  
  try {
    // GET - List all users
    if (req.method === 'GET') {
      const userIds = await kv.lrange('crm-users', 0, -1) || [];
      const users = [];
      
      for (const userId of userIds) {
        const user = await kv.get(userId);
        if (user) {
          // Don't return password
          const { password, ...safeUser } = user;
          users.push(safeUser);
        }
      }
      
      return res.status(200).json({ users });
    }
    
    // POST - Create new user
    if (req.method === 'POST') {
      const { firstName, lastName, email, role, password } = req.body;
      
      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      // Check if email already exists
      const existingUserIds = await kv.lrange('crm-users', 0, -1) || [];
      for (const userId of existingUserIds) {
        const existingUser = await kv.get(userId);
        if (existingUser && existingUser.email === email) {
          return res.status(400).json({ error: 'Email already exists' });
        }
      }
      
      const userId = `user:${Date.now()}`;
      const user = {
        id: userId,
        firstName,
        lastName,
        email,
        role: role || 'sales', // 'admin' or 'sales'
        password, // In production, hash this!
        status: 'active',
        createdAt: new Date().toISOString()
      };
      
      await kv.set(userId, user);
      await kv.lpush('crm-users', userId);
      
      const { password: _, ...safeUser } = user;
      return res.status(201).json({ success: true, user: safeUser });
    }
    
    // PUT - Update user
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'User ID required' });
      }
      
      const user = await kv.get(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const updatedUser = {
        ...user,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(id, updatedUser);
      
      const { password, ...safeUser } = updatedUser;
      return res.status(200).json({ success: true, user: safeUser });
    }
    
    // DELETE - Delete user
    if (req.method === 'DELETE') {
      const { id } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'User ID required' });
      }
      
      await kv.del(id);
      await kv.lrem('crm-users', 1, id);
      
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('CRM Users API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
