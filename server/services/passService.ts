import type { LoyaltyCard } from '@db/schema';
import { createHash } from 'crypto';
import { PKPass } from 'passkit-generator';

export async function generateAppleWalletPass(card: LoyaltyCard, serialNumber?: string): Promise<Buffer> {
  try {
    // Validate required environment variables
    if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID || 
        !process.env.APPLE_SIGNING_CERT || !process.env.APPLE_SIGNING_KEY || 
        !process.env.APPLE_WWDR_CERT) {
      throw new Error('Missing required Apple Wallet configuration');
    }

    console.log('Creating Apple Wallet pass with passkit-generator...');
    
    const design = card.design as any;
    const serial = serialNumber || `card-${card.id}-${Date.now()}`;
    
    // Use the proper passkit-generator library for iOS compatibility
    const pass = new PKPass({
      "pass.json": {
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
      }
    }, {
      wwdr: process.env.APPLE_WWDR_CERT,
      signerCert: process.env.APPLE_SIGNING_CERT,
      signerKey: process.env.APPLE_SIGNING_KEY
    });
    
    // Generate the properly signed pass for iOS
    const passBuffer = await pass.generate();
    
    console.log(`Apple Wallet pass generated with proper iOS signing (${passBuffer.length} bytes)`);
    return passBuffer;
    
  } catch (passkitError: any) {
    console.warn('Passkit-generator failed:', passkitError.message);
    
    // Fallback to manual implementation
    return await createManualPass(card, serialNumber);
  }
}

async function createManualPass(card: LoyaltyCard, serialNumber?: string): Promise<Buffer> {
  try {
    console.log('Creating manual Apple Wallet pass...');
    
    const design = card.design as any;
    const serial = serialNumber || `card-${card.id}-${Date.now()}`;
    
    // Create pass.json structure
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
    
    // Create proper PKCS#7 signature using OpenSSL with correct parameters
    const fs = await import('fs/promises');
    const { spawn } = await import('child_process');
    const tempDir = `/tmp/wallet_${Date.now()}`;
    await fs.mkdir(tempDir, { recursive: true });
    
    // Write files for OpenSSL
    const manifestFile = `${tempDir}/manifest.json`;
    const certFile = `${tempDir}/cert.pem`;
    const keyFile = `${tempDir}/key.pem`;
    const wwdrFile = `${tempDir}/wwdr.pem`;
    const sigFile = `${tempDir}/signature`;
    
    await fs.writeFile(manifestFile, manifestContent);
    await fs.writeFile(certFile, process.env.APPLE_SIGNING_CERT);
    await fs.writeFile(keyFile, process.env.APPLE_SIGNING_KEY);
    await fs.writeFile(wwdrFile, process.env.APPLE_WWDR_CERT);
    
    // Use OpenSSL with specific parameters for Apple Wallet PKCS#7
    const opensslArgs = [
      'smime', '-sign', '-binary', '-nodetach', '-noattr',
      '-signer', certFile,
      '-inkey', keyFile,
      '-certfile', wwdrFile,
      '-passin', 'pass:',
      '-in', manifestFile,
      '-out', sigFile,
      '-outform', 'DER'
    ];
    
    const opensslProcess = spawn('openssl', opensslArgs);
    let signature: Buffer;
    
    const opensslResult = await new Promise<number>((resolve) => {
      opensslProcess.on('close', resolve);
    });
    
    if (opensslResult === 0) {
      signature = await fs.readFile(sigFile);
      console.log('Created proper PKCS#7 signature with OpenSSL');
    } else {
      // Fallback to Node.js crypto if OpenSSL fails
      const crypto = await import('crypto');
      const sign = crypto.createSign('SHA1');
      sign.update(manifestContent);
      
      try {
        signature = sign.sign(process.env.APPLE_SIGNING_KEY);
        console.log('Fallback: signed with original key format');
      } catch (keyError) {
        const cleanKey = process.env.APPLE_SIGNING_KEY.replace(/-----[^-]*-----/g, '').replace(/\s/g, '');
        const formattedKey = `-----BEGIN PRIVATE KEY-----\n${cleanKey}\n-----END PRIVATE KEY-----`;
        signature = sign.sign(formattedKey);
        console.log('Fallback: signed with formatted key');
      }
    }
    
    // Clean up temp files
    await fs.rm(tempDir, { recursive: true, force: true });
    
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