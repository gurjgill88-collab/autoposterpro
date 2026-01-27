// api/email/stats.js
// Email statistics and sent email list
import { kv } from '../../lib/redis.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify auth
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { period = '30d', dealId } = req.query;

    // Get sent email IDs
    const emailIds = await kv.lrange('emails:sent', 0, 500) || [];
    
    // Fetch email details
    const emails = [];
    let totalSent = 0;
    let totalDelivered = 0;
    let totalOpened = 0;
    let totalClicked = 0;
    let totalBounced = 0;

    const cutoffDate = getCutoffDate(period);

    for (const emailId of emailIds) {
      const email = await kv.get(`email:${emailId}`);
      if (!email) continue;

      // Filter by date
      if (new Date(email.sentAt) < cutoffDate) continue;

      // Filter by deal if specified
      if (dealId && email.dealId !== dealId) continue;

      // Count stats
      totalSent++;
      if (email.status === 'delivered' || email.status === 'opened' || email.status === 'clicked') {
        totalDelivered++;
      }
      if (email.status === 'opened' || email.status === 'clicked' || email.opens > 0) {
        totalOpened++;
      }
      if (email.status === 'clicked' || email.clicks > 0) {
        totalClicked++;
      }
      if (email.status === 'bounced') {
        totalBounced++;
      }

      emails.push({
        id: email.id,
        to: email.to,
        toName: email.toName,
        subject: email.subject,
        templateName: email.templateName,
        sentBy: email.sentByName,
        sentAt: email.sentAt,
        status: email.status,
        opens: email.opens || 0,
        clicks: email.clicks || 0,
        dealId: email.dealId
      });
    }

    // Calculate rates
    const openRate = totalDelivered > 0 ? ((totalOpened / totalDelivered) * 100).toFixed(1) : 0;
    const clickRate = totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : 0;
    const bounceRate = totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(1) : 0;

    return res.status(200).json({
      stats: {
        sent: totalSent,
        delivered: totalDelivered,
        opened: totalOpened,
        clicked: totalClicked,
        bounced: totalBounced,
        openRate: parseFloat(openRate),
        clickRate: parseFloat(clickRate),
        bounceRate: parseFloat(bounceRate)
      },
      emails: emails.slice(0, 100), // Return last 100 emails
      period
    });

  } catch (error) {
    console.error('Email stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch email stats' });
  }
}

function getCutoffDate(period) {
  const now = new Date();
  
  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'all':
      return new Date(0);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
