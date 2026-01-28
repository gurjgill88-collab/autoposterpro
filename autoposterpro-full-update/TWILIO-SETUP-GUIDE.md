# AutoPosterPro Phone & SMS Setup Guide

## Overview

AutoPosterPro includes a built-in Phone & SMS system that:
- **Click-to-Call**: Works immediately (no setup required)
- **SMS Texting**: Requires Twilio account (very affordable)
- **Call Logging**: Automatic proof of calls made
- **Conversation History**: Track all communications per contact

---

## How It Works

### Without Twilio (Basic - Free)
- **Click-to-Call**: Opens your phone app on mobile or desktop
- **Call Logging**: All calls are logged with outcome, duration, notes
- **SMS**: Logged but NOT sent (for record-keeping)

### With Twilio (Full Features - ~$1-2/month)
- **Real SMS**: Actually sends text messages
- **Call Routing**: Calls route through your Twilio number to your cell
- **Two-Way SMS**: Receive replies from customers
- **Professional Caller ID**: Shows your business number

---

## Twilio Setup (10 minutes)

### Step 1: Create Twilio Account
1. Go to https://www.twilio.com/try-twilio
2. Sign up for free (no credit card required for trial)
3. Verify your email and phone number

### Step 2: Get a Phone Number
1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a Number**
2. Search for a number in your area code
3. Cost: ~$1.15/month for a local number
4. Make sure it has **SMS** and **Voice** capabilities

### Step 3: Get Your Credentials
1. Go to **Account** → **API Keys & Tokens**
2. Copy your:
   - **Account SID** (starts with AC...)
   - **Auth Token** (click to reveal)
3. Note your Twilio phone number (format: +1XXXXXXXXXX)

### Step 4: Add to Vercel
1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add these three variables:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567
```

3. Click **Save**
4. Redeploy your project

### Step 5: Configure Webhooks (for receiving SMS)
1. In Twilio Console, go to **Phone Numbers** → Click your number
2. Under **Messaging**, set:
   - **A MESSAGE COMES IN**: Webhook
   - **URL**: `https://www.autoposterpro.com/api/communications/sms-callback`
   - **HTTP Method**: POST
3. Click **Save**

---

## Cost Breakdown

| Item | Cost |
|------|------|
| Twilio Phone Number | ~$1.15/month |
| Outbound SMS | $0.0079/message (~1 cent) |
| Inbound SMS | $0.0075/message (~1 cent) |
| Outbound Calls | $0.014/min (~1.5 cents) |
| Inbound Calls | $0.0085/min (~1 cent) |

**Example Monthly Cost** (moderate usage):
- Phone number: $1.15
- 200 SMS sent: $1.58
- 100 SMS received: $0.75
- 50 minutes calls: $0.70
- **Total: ~$4.18/month**

---

## Using the Phone & SMS Feature

### In the Dashboard
1. Click **Phone & SMS** in the left navigation
2. Use **Quick Dialer** to call or text any number
3. View **Call Log** and **SMS Messages** tabs
4. Use **Conversations** for threaded message view

### From Contact Records
- Click the 📞 phone icon next to any contact
- Click the 💬 SMS icon to send a text
- All activity is logged automatically

### Call Flow (with Twilio)
1. You click "Call" in the CRM
2. YOUR phone rings first (from your Twilio number)
3. When you answer, it connects you to the customer
4. Customer sees your Twilio business number
5. After the call, log the outcome in the CRM

### SMS Templates
Pre-built templates included:
- Quick Follow-up
- Demo Reminder
- Thank You
- Check In
- Pricing Info
- Trial Offer

Create your own custom templates in the Settings.

---

## Troubleshooting

### SMS Not Sending
1. Check Twilio credentials in Vercel
2. Verify phone number format (+1XXXXXXXXXX)
3. Check Twilio Console for error logs

### Calls Not Routing
1. Set your "Forwarding Number" in Phone Settings
2. Make sure your cell phone accepts calls from unknown numbers
3. Check Twilio Console for call logs

### Need Help?
Contact: support@autoposterpro.com

---

## Environment Variables Reference

```bash
# Required for full SMS/Calling features
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567

# Optional
NEXT_PUBLIC_URL=https://www.autoposterpro.com
```

---

1553048 B.C. Ltd. dba AutoPosterPro
support@autoposterpro.com
