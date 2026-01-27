// Authentication Library
// JWT-based auth for CRM

import { kv } from './redis.js';

// Simple JWT-like token (in production use proper JWT library)
export function generateToken(userId, role) {
  const payload = {
    userId,
    role,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function verifyToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (payload.exp < Date.now()) {
      return { valid: false, error: 'Token expired' };
    }
    return { valid: true, userId: payload.userId, role: payload.role };
  } catch (e) {
    return { valid: false, error: 'Invalid token' };
  }
}

// Role hierarchy
export const ROLES = {
  admin: 4,    // Full access
  manager: 3,  // Team management, reports
  sales: 2,    // CRM, leads, email
  viewer: 1    // Read only
};

export function hasPermission(userRole, requiredRole) {
  return (ROLES[userRole] || 0) >= (ROLES[requiredRole] || 0);
}

// Auth middleware helper
export async function authenticate(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  // Allow admin secret key
  if (token === process.env.ADMIN_SECRET_KEY) {
    return { valid: true, userId: 'admin', role: 'admin' };
  }
  
  if (!token) {
    return { valid: false, error: 'No token provided' };
  }
  
  return verifyToken(token);
}

// Password hashing (simple for now - use bcrypt in production)
export function hashPassword(password) {
  // In production: return await bcrypt.hash(password, 10);
  return Buffer.from(password).toString('base64');
}

export function verifyPassword(password, hash) {
  // In production: return await bcrypt.compare(password, hash);
  return Buffer.from(password).toString('base64') === hash;
}
