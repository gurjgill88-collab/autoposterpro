// api/users.js
// User/Team management API
import { kv } from '../lib/redis.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  // Verify authentication
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check permissions for user management
  const canManageUsers = ['super_admin', 'admin', 'manager'].includes(user.role);
  
  try {
    switch (req.method) {
      case 'GET':
        return await getUsers(req, res, user, canManageUsers);
      case 'POST':
        if (!canManageUsers) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        return await createUser(req, res, user);
      case 'PUT':
        if (!canManageUsers && req.query.id !== user.id) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        return await updateUser(req, res, user);
      case 'DELETE':
        if (!['super_admin', 'admin'].includes(user.role)) {
          return res.status(403).json({ error: 'Only admins can deactivate users' });
        }
        return await deactivateUser(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Users API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getUsers(req, res, currentUser, canManageUsers) {
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
        department: user.department,
        active: user.active !== false,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      });
    }
  }

  // Sort by name
  users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return res.status(200).json({ users });
}

async function createUser(req, res, currentUser) {
  const { firstName, lastName, email, role, department, password } = req.body;

  if (!firstName || !lastName || !email || !role || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Validate role
  const validRoles = ['viewer', 'sales', 'accounting', 'manager', 'admin', 'super_admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Only super_admin can create another super_admin
  if (role === 'super_admin' && currentUser.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only super admins can create super admin accounts' });
  }

  // Check if email already exists
  const userIndex = await kv.get('users:index') || [];
  for (const userId of userIndex) {
    const existingUser = await kv.get(`user:${userId}`);
    if (existingUser && existingUser.email && existingUser.email.toLowerCase() === email.toLowerCase()) {
      return res.status(400).json({ error: 'Email already in use' });
    }
  }

  // Create user
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPassword = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

  const newUser = {
    id: userId,
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    email,
    role,
    department: department || 'general',
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
      department: newUser.department,
      active: newUser.active
    }
  });
}

async function updateUser(req, res, currentUser) {
  const userId = req.query.id;
  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }

  const user = await kv.get(`user:${userId}`);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { name, firstName, lastName, email, role, department, password, active } = req.body;

  // Update fields
  if (name) user.name = name;
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (firstName && lastName) user.name = `${firstName} ${lastName}`;
  if (email) user.email = email;
  if (department) user.department = department;
  if (typeof active === 'boolean') user.active = active;
  
  // Only admins can change roles
  if (role && ['super_admin', 'admin'].includes(currentUser.role)) {
    // Can't demote self from super_admin
    if (userId === currentUser.id && currentUser.role === 'super_admin' && role !== 'super_admin') {
      return res.status(400).json({ error: 'Cannot demote yourself from super admin' });
    }
    user.role = role;
  }

  // Update password if provided
  if (password) {
    const salt = crypto.randomBytes(16).toString('hex');
    user.salt = salt;
    user.password = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  }

  user.updatedAt = new Date().toISOString();
  user.updatedBy = currentUser.id;

  await kv.set(`user:${userId}`, user);

  return res.status(200).json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      active: user.active
    }
  });
}

async function deactivateUser(req, res, currentUser) {
  const userId = req.query.id;
  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }

  // Can't deactivate yourself
  if (userId === currentUser.id) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }

  // Can't deactivate primary_admin
  if (userId === 'primary_admin') {
    return res.status(400).json({ error: 'Cannot deactivate the primary admin account' });
  }

  const user = await kv.get(`user:${userId}`);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.active = false;
  user.deactivatedAt = new Date().toISOString();
  user.deactivatedBy = currentUser.id;

  await kv.set(`user:${userId}`, user);

  return res.status(200).json({ success: true });
}

async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
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
