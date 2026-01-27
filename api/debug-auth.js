// api/debug-auth.js
// Simple test - no database needed

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const providedKey = req.headers.authorization?.replace('Bearer ', '') || req.query.key || '';
  const envKey = process.env.ADMIN_SECRET_KEY || '';
  
  return res.status(200).json({
    providedKeyLength: providedKey.length,
    envKeyLength: envKey.length,
    envKeyExists: envKey.length > 0,
    providedKeyFirst3: providedKey.substring(0, 3),
    envKeyFirst3: envKey.substring(0, 3),
    exactMatch: providedKey === envKey,
    trimmedMatch: providedKey.trim() === envKey.trim()
  });
}
