// api/email/stats.js
// Email statistics and sent email list
import { kv } from '../../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
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
        bounceRate: parseFloat(bounceRate) that's fine it's better that way
