// api/team.js
// Team member management - CRUD operations
import { kv } from '../lib/redis.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  const user = verifyToken(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Only admin and manager can manage team
  if (!['admin', 'manager'].includes(user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getUsers(req, res, user);
      case 'POST':
        return await createUser(req, res, user);
      case 'PUT':
        return await updateUser(req, res, user);
      case 'DELETE':
        return await deleteUser(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Team API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getUsers(req, res, currentUser) {
  const userIndex = await kv.get('users:index') || [];
  const users = [];

  for (const userId of userIndex) {
    const user = await kv.get(`user:${userId}`);
    if (user) {
      // Don't expose password/salt
      users.push({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      });
    }
  }

  // Also include admin user if exists
  const adminUser = await kv.get('user:admin');
  if (adminUser) {
    users.unshift({
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      active: adminUser.active !== false,
      createdAt: adminUser.createdAt,
      lastLogin: adminUser.lastLogin
    });
  }

  return res.status(200).json({ users });
}

async function createUser(req, res, currentUser) {
  // Only admin can create users
  if (currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create users' });
  }

  const { name, email, role, password } = req.body;

  if (!name || !email || !role || !password) {
    return res.status(400).json({ error: 'Name, email, role, and password are required' });
  }

  // Validate role
  const validRoles = ['admin', 'manager', 'sales', 'accounting', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Check if email already exists
  const userIndex = await kv.get('users:index') || [];
  for (const userId of userIndex) {
    const existingUser = await kv.get(`user:${userId}`);
    if (existingUser && existingUser.email === email) {
      return res.status(400).json({ error: 'Email already in use' });
    }
  }

  // Create user
  const userId = `user_${Date.now()}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPassword = hashPassword(password, salt);

  const newUser = {
    id: userId,
    name,
    email,
    role,
    password: hashedPassword,
    salt,
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: currentUser.id
  };

  await kv.set(`user:${userId}`, newUser);
  
  // Update index
  userIndex.push(userId);
  await kv.set('users:index', userIndex);

  return res.status(201).json({
    success: true,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      active: newUser.active
    }
  });
}

async function updateUser(req, res, currentUser) {
  const { id, name, email, role, password, active } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'User ID required' });
  }

  // Only admin can update users (or user updating themselves)
  if (currentUser.role !== 'admin' && currentUser.id !== id) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const user = await kv.get(`user:${id}`);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Update fields
  if (name) user.name = name;
  if (email) user.email = email;
  if (role && currentUser.role === 'admin') user.role = role;
  if (typeof active === 'boolean' && currentUser.role === 'admin') user.active = active;
  
  if (password) {
    const salt = crypto.randomBytes(16).toString('hex');
    user.salt = salt;
    user.password = hashPassword(password, salt);
  }

  user.updatedAt = new Date().toISOString();
  user.updatedBy = currentUser.id;

  await kv.set(`user:${id}`, user);

  return res.status(200).json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active
    }
  });
}

async function deleteUser(req, res, currentUser) {
  // Only admin can delete users
  if (currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can delete users' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'User ID required' });
  }

  // Can't delete yourself
  if (id === currentUser.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  // Can't delete admin
  if (id === 'admin') {
    return res.status(400).json({ error: 'Cannot delete the admin account' });
  }

  await kv.del(`user:${id}`);

  // Update index
  const userIndex = await kv.get('users:index') || [];
  const newIndex = userIndex.filter(uid => uid !== id);
  await kv.set('users:index', newIndex);

  return res.status(200).json({ success: true });
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function verifyToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Check expiration
    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}
