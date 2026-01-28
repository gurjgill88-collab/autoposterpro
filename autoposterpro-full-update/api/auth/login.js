// api/auth/login.js
// Unified login for all dashboard users
import { kv } from '../../lib/redis.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    // Check if password is the admin secret (quick admin access)
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    if (password === adminSecret) {
      // Get or create the primary admin user
      let adminUser = await kv.get('user:primary_admin');
      
      if (!adminUser) {
        // Create default admin
        adminUser = {
          id: 'primary_admin',
          email: email,
          name: 'Admin',
          role: 'super_admin',
          department: 'management',
          active: true,
          createdAt: new Date().toISOString()
        };
        await kv.set('user:primary_admin', adminUser);
        
        // Add to user index
        const userIndex = await kv.get('users:index') || [];
        if (!userIndex.includes('primary_admin')) {
          userIndex.push('primary_admin');
          await kv.set('users:index', userIndex);
        }
      }
      
      // Update last login
      adminUser.lastLogin = new Date().toISOString();
      await kv.set('user:primary_admin', adminUser);
      
      const token = generateToken(adminUser);
      
      return res.status(200).json({
        success: true,
        user: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          department: adminUser.department
        },
        token
      });
    }

    // Look up user by email
    const userIndex = await kv.get('users:index') || [];
    let foundUser = null;
    
    for (const userId of userIndex) {
      const user = await kv.get(`user:${userId}`);
      if (user && user.email && user.email.toLowerCase() === email.toLowerCase()) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    if (!foundUser.salt || !foundUser.password) {
      return res.status(401).json({ error: 'Account not properly configured' });
    }
    
    const hashedPassword = hashPassword(password, foundUser.salt);
    if (hashedPassword !== foundUser.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if active
    if (foundUser.active === false) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Update last login
    foundUser.lastLogin = new Date().toISOString();
    await kv.set(`user:${foundUser.id}`, foundUser);

    const token = generateToken(foundUser);

    return res.status(200).json({
      success: true,
      user: {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        role: foundUser.role,
        department: foundUser.department
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
