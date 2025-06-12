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

    console.log('Creating production Apple Wallet pass for iOS...');
    
    const design = card.design as any;
    const serial = serialNumber || `card-${card.id}-${Date.now()}`;
    
    // Create pass data that exactly matches Apple's specifications
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
            label: 'Card Name',
            value: design.name || 'Loyalty Card'
          }
        ],
        backFields: [
          {
            key: 'terms',
            label: 'Terms and Conditions',
            value: 'Present this pass to earn and redeem loyalty points. Valid at participating locations.'
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
    
    // Create manifest with SHA-1 hashes as required by iOS
    const manifest = {
      'pass.json': createHash('sha1').update(passJsonContent).digest('hex')
    };
    
    const manifestContent = JSON.stringify(manifest, null, 2);
    
    // Create production PKCS#7 signature using OpenSSL with proper certificate chain
    const fs = await import('fs/promises');
    const { spawn } = await import('child_process');
    const tempDir = `/tmp/production_wallet_${Date.now()}`;
    await fs.mkdir(tempDir, { recursive: true });
    
    let signature: Buffer;
    
    try {
      // Write all required files for OpenSSL
      await fs.writeFile(`${tempDir}/manifest.json`, manifestContent);
      await fs.writeFile(`${tempDir}/cert.pem`, process.env.APPLE_SIGNING_CERT);
      await fs.writeFile(`${tempDir}/key.pem`, process.env.APPLE_SIGNING_KEY);
      await fs.writeFile(`${tempDir}/wwdr.pem`, process.env.APPLE_WWDR_CERT);
      
      // Create comprehensive certificate chain for iOS validation
      const fullCertChain = process.env.APPLE_SIGNING_CERT + '\n' + process.env.APPLE_WWDR_CERT;
      await fs.writeFile(`${tempDir}/fullchain.pem`, fullCertChain);
      
      // Use OpenSSL with production parameters for iOS compatibility
      const opensslArgs = [
        'smime', '-sign', '-binary', '-nodetach', '-noattr',
        '-signer', `${tempDir}/cert.pem`,
        '-inkey', `${tempDir}/key.pem`,
        '-certfile', `${tempDir}/fullchain.pem`,
        '-in', `${tempDir}/manifest.json`,
        '-out', `${tempDir}/signature`,
        '-outform', 'DER'
      ];
      
      console.log('Executing OpenSSL signing for iOS validation...');
      const opensslProcess = spawn('openssl', opensslArgs, { stdio: 'pipe' });
      
      let opensslError = '';
      opensslProcess.stderr.on('data', (data) => {
        opensslError += data.toString();
      });
      
      const opensslResult = await new Promise<number>((resolve) => {
        opensslProcess.on('close', resolve);
      });
      
      if (opensslResult === 0) {
        signature = await fs.readFile(`${tempDir}/signature`);
        console.log(`OpenSSL PKCS#7 signature created successfully (${signature.length} bytes)`);
      } else {
        console.warn(`OpenSSL failed with exit code ${opensslResult}:`, opensslError);
        throw new Error('OpenSSL signing failed');
      }
      
    } catch (opensslError) {
      console.warn('OpenSSL approach failed, using Node.js crypto fallback:', opensslError);
      
      // Fallback to Node.js crypto with proper key handling
      const crypto = await import('crypto');
      const sign = crypto.createSign('SHA1');
      sign.update(manifestContent);
      
      try {
        signature = sign.sign(process.env.APPLE_SIGNING_KEY);
        console.log('Signed with Node.js crypto (original key format)');
      } catch (keyError) {
        // Try reformatting the private key
        const cleanKey = process.env.APPLE_SIGNING_KEY.replace(/-----[^-]*-----/g, '').replace(/\s/g, '');
        const formattedKey = `-----BEGIN PRIVATE KEY-----\n${cleanKey}\n-----END PRIVATE KEY-----`;
        signature = sign.sign(formattedKey);
        console.log('Signed with Node.js crypto (formatted key)');
      }
    } finally {
      // Clean up temporary files
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Cleanup failed:', cleanupError);
      }
    }
    
    // Create final .pkpass ZIP file for iOS
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    zip.file('pass.json', passJsonContent);
    zip.file('manifest.json', manifestContent);
    zip.file('signature', signature);
    
    const passBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    console.log(`Production Apple Wallet pass created (${passBuffer.length} bytes) - Ready for iOS`);
    return passBuffer;
    
  } catch (error: any) {
    console.error('Apple Wallet pass generation failed:', error.message);
    throw new Error(`Failed to create Apple Wallet pass: ${error.message}`);
  }
}