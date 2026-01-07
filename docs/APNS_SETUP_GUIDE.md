# Apple Push Notifications Setup Guide

This guide will walk you through setting up Apple Push Notifications (APNs) for your LoyaltyPro app. Don't worry if you're not technical - we'll go step by step!

## What You'll Need
- Apple Developer Account ($99/year) - you should already have this for Apple Wallet passes
- About 15-30 minutes of your time
- Access to your Replit project

## Why APNs Matters
Without APNs, customers must manually download updated passes after staff scans their QR codes. **With APNs, passes automatically update in their Apple Wallet within 30-60 seconds** - that's the magic experience!

---

## Step 1: Create APNs Authentication Key

### 1.1 Log into Apple Developer Portal
1. Go to https://developer.apple.com/account
2. Sign in with your Apple ID (the one associated with your developer account)
3. Click on "Certificates, Identifiers & Profiles" in the left sidebar

### 1.2 Create a New Key
1. Click on "Keys" in the left sidebar
2. Click the blue "+" button in the top right corner
3. You'll see a form to register a new key

### 1.3 Fill Out the Key Details
1. **Key Name**: Enter `LoyaltyPro APNs Key` (or any name you'll remember)
2. Check the box next to **"Apple Push Notifications service (APNs)"**
3. Click "Continue" button
4. Review the information and click "Register"

### 1.4 Download the Key (IMPORTANT!)
1. You'll see a success page with your Key ID displayed (looks like `ABC123XYZ`)
2. **Write down or copy the Key ID** - you'll need this later
3. Click "Download" to download the `.p8` file (e.g., `AuthKey_ABC123XYZ.p8`)
4. **Save this file somewhere safe on your computer**

⚠️ **CRITICAL**: Apple only lets you download this file ONCE. If you lose it, you'll have to create a new key. Store it securely!

### 1.5 What You Should Have Now
- ✅ Key ID (looks like: `ABC123XYZ`)
- ✅ Downloaded .p8 file (looks like: `AuthKey_ABC123XYZ.p8`)

---

## Step 2: Get Your Replit Domain

You need to know your Replit app's public URL.

1. Open your Replit project
2. Look at the top of the screen - you'll see a URL like `https://your-app-name.repl.co`
3. Write this down - you'll need it in the next step

**Example**: If your URL is `https://loyaltypro-main.repl.co`, you'll use `https://loyaltypro-main.repl.co/v1` for the wallet service URL.

---

## Step 3: Configure Replit Secrets

Now we'll add the APNs credentials to your Replit project.

### 3.1 Open Replit Secrets
1. In your Replit project, click "Tools" in the left sidebar
2. Click "Secrets" (looks like a lock icon)
3. You'll see a list of existing secrets

### 3.2 Generate a Wallet Auth Token Secret

First, you need to generate a random secret for securing your wallet service.

1. Open the Shell tab in Replit (bottom of screen)
2. Type this command and press Enter:
   ```bash
   openssl rand -base64 32
   ```
3. Copy the output (a long random string)

### 3.3 Open the .p8 File

1. On your computer, find the `.p8` file you downloaded in Step 1
2. Open it with a text editor (Notepad on Windows, TextEdit on Mac)
3. You'll see something like:
   ```
   -----BEGIN PRIVATE KEY-----
   MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
   (many lines of random characters)
   -----END PRIVATE KEY-----
   ```
4. **Copy ALL of this text** (including the BEGIN and END lines)

### 3.4 Add the 5 New Secrets

Now add these secrets to Replit. For each one:
1. Click "New Secret"
2. Enter the **Key** name exactly as shown
3. Enter the **Value** as described
4. Click "Add Secret"

#### Secret 1: APPLE_APNS_KEY_ID
- **Key**: `APPLE_APNS_KEY_ID`
- **Value**: Your Key ID from Step 1.4 (e.g., `ABC123XYZ`)

#### Secret 2: APPLE_APNS_KEY
- **Key**: `APPLE_APNS_KEY`
- **Value**: Paste the ENTIRE contents of the .p8 file (from Step 3.3)
  - Make sure to include `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
  - All lines in between should be included

#### Secret 3: APPLE_APNS_ENVIRONMENT
- **Key**: `APPLE_APNS_ENVIRONMENT`
- **Value**: `production`
  - Use `sandbox` only if you're testing with development passes

#### Secret 4: WALLET_SERVICE_URL
- **Key**: `WALLET_SERVICE_URL`
- **Value**: Your Replit URL from Step 2 + `/v1`
  - Example: `https://loyaltypro-main.repl.co/v1`
  - ⚠️ Don't forget the `/v1` at the end!

#### Secret 5: WALLET_AUTH_TOKEN_SECRET
- **Key**: `WALLET_AUTH_TOKEN_SECRET`
- **Value**: The random string you generated in Step 3.2

### 3.5 Verify Your Secrets

You should now have these 5 new secrets (plus your existing Apple Wallet secrets):

**Existing Secrets** (you should already have these):
- `APPLE_PASS_TYPE_ID`
- `APPLE_TEAM_ID`
- `APPLE_SIGNING_CERT`
- `APPLE_SIGNING_KEY`
- `APPLE_WWDR_CERT`

**New Secrets** (you just added):
- `APPLE_APNS_KEY_ID` ← Key ID like ABC123XYZ
- `APPLE_APNS_KEY` ← Contents of .p8 file
- `APPLE_APNS_ENVIRONMENT` ← "production"
- `WALLET_SERVICE_URL` ← Your Replit URL + /v1
- `WALLET_AUTH_TOKEN_SECRET` ← Random token

---

## Step 4: Restart Your Replit App

1. Click the "Stop" button at the top of Replit
2. Wait 5 seconds
3. Click the "Run" button

### 4.1 Check for Success Message

Look at the console logs (bottom of screen). You should see:

```
✅ APNs provider initialized successfully (production mode)
✅ Apple Wallet web service endpoints registered
```

If you see these messages, congratulations! APNs is configured correctly! 🎉

### 4.2 Troubleshooting Startup Errors

**Error: "APNs credentials not configured"**
- Go back to Step 3 and verify all 5 secrets are added correctly
- Make sure there are no extra spaces in the secret values
- Check that the Key ID matches what Apple showed you

**Error: "Failed to initialize APNs provider"**
- Verify the APPLE_APNS_KEY includes the BEGIN and END lines
- Make sure you copied the ENTIRE .p8 file contents
- Check that APPLE_TEAM_ID is set (should already exist)

**Error: "Missing required Apple Wallet configuration"**
- Make sure all your existing Apple Wallet secrets are still there
- Don't delete any existing secrets

---

## Step 5: Test the Integration

Now let's make sure everything works end-to-end!

### 5.1 Generate a Test Pass

1. Log into your LoyaltyPro app
2. Go to "Cards" and create a new loyalty card (or use an existing one)
3. Go to "Customers"
4. Create a test customer or use an existing one
5. Issue a pass to this customer
6. Download the pass to your iPhone

### 5.2 Add to Apple Wallet

1. On your iPhone, open the downloaded pass
2. Tap "Add" to add it to Apple Wallet
3. Open Apple Wallet and verify the pass is there

### 5.3 Check Device Registration

Back in Replit, check the console logs. You should see:

```
✅ Registered device [device-id] for pass: [serial-number]
```

This means your iPhone successfully registered with your server!

### 5.4 Test Push Notifications

1. Open the Staff Scanner on a computer/tablet
2. Scan the customer's QR code (use the pass in Apple Wallet)
3. The scan should succeed
4. Check the console logs - you should see:

```
✅ Push notification sent for pass: [serial-number]
📤 Sending push notifications to 1 device(s) for pass: [serial-number]
✅ Push notification sent successfully to device: [device-id]
```

5. Within 30-60 seconds, check the pass in Apple Wallet on your iPhone
6. **The balance should update automatically!** ✨

---

## Step 6: Verify in Database (Optional)

If you're comfortable with SQL, you can verify the data is being stored correctly.

### 6.1 Open Replit Database Tool

1. In Replit, click "Tools" → "Database"
2. You'll see a SQL console

### 6.2 Check Device Registrations

Run this query:

```sql
SELECT * FROM device_registrations;
```

You should see at least one row with:
- device_library_identifier
- serial_number
- push_token
- registered_at

### 6.3 Check Push Notification Log

Run this query:

```sql
SELECT * FROM push_notification_log
ORDER BY sent_at DESC
LIMIT 10;
```

You should see logs of push notifications with `status = 'sent'`.

---

## Common Issues and Solutions

### Issue 1: Push notifications not received on iPhone

**Possible Causes**:
1. iPhone doesn't have internet connection
2. WALLET_SERVICE_URL is incorrect
3. Pass was generated before APNs was configured

**Solutions**:
- Ensure iPhone has WiFi or cellular data
- Verify WALLET_SERVICE_URL matches your Replit domain exactly
- Regenerate the pass after configuring APNs
- Try manually pulling down on the pass in Wallet (forces refresh)
- Wait up to 60 seconds - Apple has variable delays

### Issue 2: "Unauthorized" error when adding pass to wallet

**Possible Causes**:
- webServiceURL or authenticationToken missing from pass
- Pass was generated before APNs configuration

**Solutions**:
- Delete the pass from iPhone
- Regenerate the pass in your admin panel
- Download and re-add to wallet
- Verify logs show "webServiceURL" in pass.json

### Issue 3: Device registration not appearing in database

**Possible Causes**:
- WALLET_SERVICE_URL is incorrect or unreachable
- Replit app went to sleep (free tier limitation)
- Firewall blocking Apple's servers

**Solutions**:
- Verify WALLET_SERVICE_URL is correct (check for typos!)
- Keep the Replit app awake (consider upgrading to paid tier)
- Check if your Replit domain is accessible from your phone's browser

### Issue 4: "BadDeviceToken" errors in logs

**This is normal!**

It happens when:
- Customer deleted the pass
- Customer got a new phone
- Customer reset their device

The system automatically removes invalid tokens, so no action needed.

---

## Monitoring (Post-Launch)

### Daily Health Check (First Week)

Run this SQL query to check push notification success rate:

```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM push_notification_log
WHERE sent_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

**Expected**: 95%+ should be 'sent'. Some 'failed' is normal.

### Weekly Growth Check

```sql
SELECT
  DATE(registered_at) as date,
  COUNT(*) as new_registrations
FROM device_registrations
GROUP BY DATE(registered_at)
ORDER BY date DESC
LIMIT 7;
```

You should see steady growth as more customers add passes.

---

## Security Notes

Your APNs setup is secure because:

1. ✅ **256-bit random authentication tokens** per pass
2. ✅ **Token validation** on every Apple Wallet API request
3. ✅ **Rate limiting** (100 requests per 15 minutes)
4. ✅ **TLS encryption** for all communications
5. ✅ **No sensitive data** in push notifications (just a "check for updates" signal)
6. ✅ **Automatic cleanup** of invalid device tokens

Your private .p8 key is stored securely in Replit Secrets and never exposed to the public.

---

## Next Steps

### Gradual Rollout (Recommended)

Don't enable for all customers at once. Follow this rollout:

**Week 1**: Test with 5-10 internal users (staff, friends, family)
- Monitor logs daily
- Fix any issues that come up
- Verify push notifications work consistently

**Week 2**: Enable for 50 early adopter customers
- Ask for feedback
- Monitor push success rate
- Address any edge cases

**Week 3**: Enable for all new customers
- New pass enrollments automatically get APNs

**Week 4**: Regenerate passes for all existing customers
- Batch generate new passes with APNs enabled
- Send email notification to customers to download updated pass

### Cost Notes

APNs is **completely free** - no additional costs!

- No per-notification charges from Apple
- No third-party services required
- Only cost is your existing Apple Developer membership ($99/year)

---

## Need Help?

If you encounter issues not covered in this guide:

1. Check the Replit console logs for error messages
2. Verify all secrets are set correctly (no typos!)
3. Try the troubleshooting steps in this guide
4. Check that your iPhone has internet connection

Remember: The system is designed with graceful degradation. If push notifications fail, customers can still manually refresh their passes. The core loyalty program functionality always works!

---

## Summary

You've successfully configured Apple Push Notifications! Here's what you accomplished:

✅ Created APNs authentication key in Apple Developer Portal
✅ Configured 5 new Replit secrets
✅ Tested device registration
✅ Verified push notifications work
✅ Checked database for correct data storage

Your customers can now enjoy the **magic experience** of automatic pass updates! 🎉
