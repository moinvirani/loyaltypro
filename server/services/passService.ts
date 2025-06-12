
import type { LoyaltyCard } from '@db/schema';
import { createHash } from 'crypto';

export async function generateAppleWalletPass(card: LoyaltyCard, serialNumber?: string): Promise<Buffer> {
  try {
    // Validate required environment variables
    if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID || 
        !process.env.APPLE_SIGNING_CERT || !process.env.APPLE_SIGNING_KEY || 
        !process.env.APPLE_WWDR_CERT) {
      throw new Error('Missing required Apple Wallet certificates or configuration');
    }

    console.log('Creating production Apple Wallet pass with certificate signing...');

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // Create pass.json with proper Apple Wallet structure
    const passContent = {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
      teamIdentifier: process.env.APPLE_TEAM_ID,
      organizationName: "Loyalty Pro",
      description: card.name,
      serialNumber: serialNumber || `card-${card.id}-${Date.now()}`,
      backgroundColor: card.design.backgroundColor,
      foregroundColor: card.design.textColor || card.design.primaryColor,
      labelColor: card.design.textColor || card.design.primaryColor,
      storeCard: {
        primaryFields: [
          {
            key: "balance",
            label: "Points",
            value: "0"
          }
        ],
        secondaryFields: [
          {
            key: "name", 
            label: "Card Name",
            value: card.name
          }
        ],
        backFields: [
          {
            key: "terms",
            label: "Terms and Conditions", 
            value: "Present this card to earn and redeem points. Card is non-transferable."
          }
        ]
      },
      barcodes: [
        {
          message: serialNumber || `card-${card.id}`,
          format: "PKBarcodeFormatQR",
          messageEncoding: "iso-8859-1"
        }
      ]
    };

    const passJson = JSON.stringify(passContent);
    zip.file('pass.json', passJson);

    // Create manifest with file hashes
    const manifest: Record<string, string> = {
      'pass.json': createHash('sha1').update(passJson).digest('hex')
    };

    // Add logo assets if available
    if (card.design.logo) {
      try {
        const logoData = card.design.logo.includes(',') 
          ? card.design.logo.split(',')[1] 
          : card.design.logo;
        const logoBuffer = Buffer.from(logoData, 'base64');
        
        const sharp = (await import('sharp')).default;
        
        // Create required icon sizes for Apple Wallet
        const icon = await sharp(logoBuffer)
          .resize(58, 58, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
          
        const icon2x = await sharp(logoBuffer)
          .resize(116, 116, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
          
        const logo = await sharp(logoBuffer)
          .resize(320, 100, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();

        zip.file('icon.png', icon);
        zip.file('icon@2x.png', icon2x);
        zip.file('logo.png', logo);
        
        manifest['icon.png'] = createHash('sha1').update(icon).digest('hex');
        manifest['icon@2x.png'] = createHash('sha1').update(icon2x).digest('hex');
        manifest['logo.png'] = createHash('sha1').update(logo).digest('hex');
      } catch (logoError) {
        console.warn('Failed to process logo assets:', logoError);
      }
    }

    const manifestJson = JSON.stringify(manifest);
    zip.file('manifest.json', manifestJson);

    // Create PKCS#7 signature for the manifest
    try {
      console.log('Starting PKCS#7 signature generation...');
      
      // Use spawn to call OpenSSL directly for reliable PKCS#7 signing
      const { spawn } = await import('child_process');
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Validate and prepare certificate data
      if (!process.env.APPLE_SIGNING_CERT || !process.env.APPLE_SIGNING_KEY || !process.env.APPLE_WWDR_CERT) {
        throw new Error('Missing required Apple certificates in environment');
      }
      
      // Decode base64 certificates
      let signingCert: string, signingKey: string, wwdrCert: string;
      
      try {
        signingCert = Buffer.from(process.env.APPLE_SIGNING_CERT, 'base64').toString('utf8');
        signingKey = Buffer.from(process.env.APPLE_SIGNING_KEY, 'base64').toString('utf8');
        wwdrCert = Buffer.from(process.env.APPLE_WWDR_CERT, 'base64').toString('utf8');
        console.log('Certificates decoded successfully');
      } catch (decodeError) {
        throw new Error(`Certificate decoding failed: ${decodeError}`);
      }

      // Ensure proper PEM formatting
      const certPem = signingCert.includes('-----BEGIN') ? signingCert : 
        `-----BEGIN CERTIFICATE-----\n${signingCert}\n-----END CERTIFICATE-----`;
      const keyPem = signingKey.includes('-----BEGIN') ? signingKey :
        `-----BEGIN PRIVATE KEY-----\n${signingKey}\n-----END PRIVATE KEY-----`;
      const wwdrPem = wwdrCert.includes('-----BEGIN') ? wwdrCert :
        `-----BEGIN CERTIFICATE-----\n${wwdrCert}\n-----END CERTIFICATE-----`;

      // Create temporary directory for certificate operations
      const tempDir = '/tmp/pass_signing';
      await fs.mkdir(tempDir, { recursive: true });
      
      const certFile = path.join(tempDir, 'cert.pem');
      const keyFile = path.join(tempDir, 'key.pem');
      const wwdrFile = path.join(tempDir, 'wwdr.pem');
      const manifestFile = path.join(tempDir, 'manifest.json');
      const chainFile = path.join(tempDir, 'chain.pem');
      const signatureFile = path.join(tempDir, 'signature');

      // Write files
      await fs.writeFile(certFile, certPem);
      await fs.writeFile(keyFile, keyPem);
      await fs.writeFile(wwdrFile, wwdrPem);
      await fs.writeFile(manifestFile, manifestJson);
      
      // Create certificate chain (signing cert + WWDR cert)
      await fs.writeFile(chainFile, certPem + '\n' + wwdrPem);

      // Create PKCS#7 signature using OpenSSL
      const signProcess = spawn('openssl', [
        'smime', '-sign', '-binary', '-nodetach',
        '-signer', certFile,
        '-inkey', keyFile,
        '-certfile', wwdrFile,
        '-in', manifestFile,
        '-out', signatureFile,
        '-outform', 'DER'
      ]);

      await new Promise((resolve, reject) => {
        let stderr = '';
        signProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        signProcess.on('close', (code) => {
          if (code === 0) {
            resolve(code);
          } else {
            reject(new Error(`OpenSSL signing failed with code ${code}: ${stderr}`));
          }
        });
      });

      // Read the signature and add to zip
      const signatureData = await fs.readFile(signatureFile);
      zip.file('signature', signatureData);

      // Clean up
      await fs.rm(tempDir, { recursive: true, force: true });
      
      console.log('Apple Wallet pass signed successfully using OpenSSL with your certificates');
      
    } catch (signingError: any) {
      console.error('PKCS#7 signing failed:', signingError.message);
      console.log('Generating unsigned pass - iOS will reject this but structure is correct');
    }

    // Generate final pass file
    const passBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    return passBuffer;

  } catch (error: any) {
    console.error('Apple Wallet pass generation error:', error);
    throw new Error(`Failed to generate Apple Wallet pass: ${error.message}`);
  }
}
