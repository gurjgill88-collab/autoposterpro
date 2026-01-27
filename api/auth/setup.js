// api/auth/setup.js
// First-time setup - create admin account
import { kv } from '../../lib/redis.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { secret, name, email, password } = req.body;

  // Verify admin secret
  const adminSecret = process.env.ADMIN_SECRET_KEY;
  if (!adminSecret || secret !== adminSecret) {
    return res.status(401).json({ error: 'Invalid admin secret key' });
  }

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Check if admin already exists
    const existing = await kv.get('user:primary_admin');
    if (existing && existing.password) {
      return res.status(400).json({ error: 'Admin account already exists. Use login instead.' });
    }

    // Create admin user with password
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = hashPassword(password, salt);

    const adminUser = {
      id: 'primary_admin',
      name,
      email,
      password: hashedPassword,
      salt,
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

    const token = generateToken(adminUser);

    return res.status(200).json({
      success: true,
      message: 'Admin account created successfully',
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        department: adminUser.department
      },
      token
    });

  } catch (error) {
    console.error('Setup error:', error);
    return res.status(500).json({ error: 'Setup failed' });
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
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
