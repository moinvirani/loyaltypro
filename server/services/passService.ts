import type { LoyaltyCard } from '@db/schema';
import { createHash } from 'crypto';

export async function generateAppleWalletPass(card: LoyaltyCard, serialNumber?: string): Promise<Buffer> {
  try {
    // Validate required environment variables
    if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID || 
        !process.env.APPLE_SIGNING_CERT || !process.env.APPLE_SIGNING_KEY || 
        !process.env.APPLE_WWDR_CERT) {
      throw new Error('Missing required Apple Wallet configuration');
    }

    console.log('Creating Apple Wallet pass for iOS...');
    
    const design = card.design as any;
    const serial = serialNumber || `card-${card.id}-${Date.now()}`;
    
    // Create pass.json structure that iOS will accept
    const passData = {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
      serialNumber: serial,
      teamIdentifier: process.env.APPLE_TEAM_ID,
      organizationName: design.name || 'Loyalty Business',
      description: `${design.name || 'Loyalty'} Card`,
      foregroundColor: design.textColor || '#000000',
      backgroundColor: design.backgroundColor || '#ffffff',
      labelColor: design.textColor || '#000000',
      logoText: design.name,
      generic: {
        primaryFields: [
          {
            key: 'balance',
            label: 'Points',
            value: `${design.stamps || 0}/${design.stamps || 10}`
          }
        ],
        secondaryFields: [
          {
            key: 'name',
            label: 'Card',
            value: design.name || 'Loyalty Card'
          }
        ],
        backFields: [
          {
            key: 'terms',
            label: 'Terms and Conditions',
            value: 'Present this pass to earn and redeem loyalty points.'
          }
        ]
      },
      barcodes: [
        {
          message: `CUSTOMER-${card.id}`,
          format: 'PKBarcodeFormatQR',
          messageEncoding: 'iso-8859-1'
        }
      ]
    };

    const passJsonContent = JSON.stringify(passData, null, 2);
    
    // Create manifest with SHA-1 hashes
    const manifest: { [key: string]: string } = {
      'pass.json': createHash('sha1').update(passJsonContent).digest('hex')
    };
    
    const manifestContent = JSON.stringify(manifest, null, 2);
    
    // Sign with your Apple Developer private key
    const crypto = await import('crypto');
    const sign = crypto.createSign('SHA1');
    sign.update(manifestContent);
    
    let signature: Buffer;
    try {
      // First try with the key as-is
      signature = sign.sign(process.env.APPLE_SIGNING_KEY);
      console.log('Signed with original key format');
    } catch (keyError) {
      // Try cleaning and reformatting the key
      const cleanKey = process.env.APPLE_SIGNING_KEY.replace(/-----[^-]*-----/g, '').replace(/\s/g, '');
      const formattedKey = `-----BEGIN PRIVATE KEY-----\n${cleanKey}\n-----END PRIVATE KEY-----`;
      signature = sign.sign(formattedKey);
      console.log('Signed with formatted key');
    }
    
    // Create final ZIP file for iOS
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    zip.file('pass.json', passJsonContent);
    zip.file('manifest.json', manifestContent);
    zip.file('signature', signature);
    
    const passBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });
    
    console.log(`Apple Wallet pass created for iOS (${passBuffer.length} bytes)`);
    return passBuffer;
    
  } catch (error: any) {
    console.error('Apple Wallet pass generation failed:', error);
    throw new Error(`Failed to create Apple Wallet pass: ${error.message}`);
  }
}