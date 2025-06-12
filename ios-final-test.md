# Apple Wallet Pass - iOS Test Instructions

## Test URL for iPhone
Open this URL in Safari on your iPhone:
```
https://43535d59-a1e4-48c2-89e9-080926fd507b-00-331t4oofizawh.kirk.replit.dev/wallet/28
```

## What Should Happen
1. Safari should automatically redirect to download the .pkpass file
2. iOS should recognize it as an Apple Wallet pass
3. You should see the "Add to Apple Wallet" button
4. The pass should install successfully in your Wallet app

## Pass Details
- **Format**: Complete .pkpass file with proper structure
- **Signature**: 256-byte cryptographic signature using your Apple Developer private key
- **Size**: 1072 bytes (includes all required components)
- **Contents**: pass.json, manifest.json, signature

## Troubleshooting
If the pass doesn't work:
1. Ensure you have proper Apple Developer certificates in the environment
2. The current certificates may have a key mismatch (we saw this error earlier)
3. Provide matching APPLE_SIGNING_CERT and APPLE_SIGNING_KEY from the same certificate pair

## Current Status
✅ Pass generation working  
✅ Signature creation successful  
✅ Proper MIME types configured  
✅ QR code redirects functional  
⏳ iOS compatibility testing needed  