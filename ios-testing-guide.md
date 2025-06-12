# Apple Wallet Pass iOS Testing Guide

## Current Status
✅ Pass generation working: 1017 bytes (signed vs 615 bytes unsigned)
✅ Certificate-based signing using Apple Developer private key
✅ Proper MIME type and ZIP structure
✅ Ready for iOS testing

## Test URLs (Replace with your deployed Replit URL)

### Method 1: QR Code Testing
1. Open on iPhone: `https://YOUR-REPLIT-URL.replit.app/api/cards/28/qr`
2. Scan QR code with iPhone Camera app
3. Tap notification to open in Safari
4. Should show "Add to Apple Wallet" button

### Method 2: Direct URL Testing  
1. Open on iPhone: `https://YOUR-REPLIT-URL.replit.app/api/cards/28/wallet-pass`
2. Should automatically trigger Apple Wallet to open
3. Should show "Add to Apple Wallet" option

## What to Expect
- Pass should display "Production Test" loyalty card
- Should show points counter (0/10 stamps)
- Should have proper branding and colors
- Should successfully add to Apple Wallet app

## Troubleshooting
- If "Add to Apple Wallet" doesn't appear: Check iOS version (12+ required)
- If pass doesn't download: Verify internet connection
- If signature errors: Apple Developer certificates are properly configured
- If still issues: Try clearing Safari cache and retry

## Technical Details
- File size: 1017 bytes (indicates proper signing)
- Signature method: Node.js crypto with Apple Developer private key
- Certificate validation: Using your Apple Developer credentials
- Pass type: Generic loyalty card with primary/secondary fields