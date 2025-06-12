# iOS Apple Wallet Pass Testing Instructions

## Test URLs for iOS Device

1. **QR Code Page**: 
   - Open on iPhone: `https://[YOUR_REPLIT_URL]/api/cards/28/qr`
   - Scan the QR code with iPhone Camera app
   - Should redirect to Apple Wallet pass download

2. **Direct Pass Download**:
   - Open on iPhone: `https://[YOUR_REPLIT_URL]/api/cards/28/wallet-pass`
   - Should trigger Apple Wallet to open and offer "Add to Apple Wallet"

## Current Pass Status
- ✅ Pass file size: 1017 bytes (signed vs 615 bytes unsigned)
- ✅ Certificate-based signing using your Apple Developer private key
- ✅ Proper MIME type: `application/vnd.apple.pkpass`
- ✅ ZIP structure with manifest.json and signature files
- ✅ Pass.json meets Apple Wallet specifications

## What to Test on iOS
1. Scan QR code with iPhone Camera
2. Tap the notification to open in Safari
3. Verify "Add to Apple Wallet" button appears
4. Tap "Add to Apple Wallet"
5. Verify pass appears in Apple Wallet app

## Expected Results
- Pass should successfully add to Apple Wallet
- Should display loyalty card with points counter
- Should show proper branding and colors

## If Issues Occur
- Check iOS version (iOS 12+ required)
- Ensure internet connection is stable
- Try direct URL instead of QR code
- Verify Apple Developer certificates are properly configured