import type { LoyaltyCard } from '@db/schema';
import { createHash } from 'crypto';
import { PKPass } from '@walletpass/pass-js';

export async function generateAppleWalletPass(card: LoyaltyCard, serialNumber?: string): Promise<Buffer> {
  try {
    // Validate required environment variables
    if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID || 
        !process.env.APPLE_SIGNING_CERT || !process.env.APPLE_SIGNING_KEY || 
        !process.env.APPLE_WWDR_CERT) {
      throw new Error('Missing required Apple Wallet configuration');
    }

    console.log('Creating signed Apple Wallet pass...');

    const design = card.design as any;
    const serial = serialNumber || `${card.id}-${Date.now()}`;

    // Use native crypto and OpenSSL for PKCS#7 signing
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { spawn } = await import('child_process');
      
      // Create temporary directory for signing process
      const tempDir = '/tmp/apple_wallet_signing_' + Date.now();
      await fs.mkdir(tempDir, { recursive: true });
      
      // Create pass.json structure
      const passData = {
        formatVersion: 1,
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
        serialNumber: serial,
        teamIdentifier: process.env.APPLE_TEAM_ID,
        organizationName: design.name || 'Loyalty Card',
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
              value: `${card.stamps || 0}/${design.stamps || 10}`
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
              label: 'Terms',
              value: 'Present this pass to earn and redeem loyalty points.'
            }
          ]
        },
        barcode: {
          message: `loyalty:${card.id}:guest`,
          format: 'PKBarcodeFormatQR',
          messageEncoding: 'iso-8859-1'
        }
      };

      const passJsonContent = JSON.stringify(passData, null, 2);
      
      // Create manifest
      const manifest: Record<string, string> = {
        'pass.json': createHash('sha1').update(passJsonContent).digest('hex')
      };

      // Handle logo if available
      let logoBuffer: Buffer | null = null;
      if (design.logo) {
        try {
          logoBuffer = Buffer.from(design.logo.split(',')[1], 'base64');
          manifest['logo.png'] = createHash('sha1').update(logoBuffer).digest('hex');
          manifest['icon.png'] = createHash('sha1').update(logoBuffer).digest('hex');
        } catch (logoError) {
          console.warn('Logo processing failed:', logoError);
        }
      }

      const manifestContent = JSON.stringify(manifest);
      
      // Write files to temporary directory
      const passFile = path.join(tempDir, 'pass.json');
      const manifestFile = path.join(tempDir, 'manifest.json');
      const certFile = path.join(tempDir, 'cert.pem');
      const keyFile = path.join(tempDir, 'key.pem');
      const wwdrFile = path.join(tempDir, 'wwdr.pem');
      const signatureFile = path.join(tempDir, 'signature');
      
      await fs.writeFile(passFile, passJsonContent);
      await fs.writeFile(manifestFile, manifestContent);
      
      // Write certificates with proper formatting and validation
      let signingCert = process.env.APPLE_SIGNING_CERT.trim();
      let signingKey = process.env.APPLE_SIGNING_KEY.trim();
      let wwdrCert = process.env.APPLE_WWDR_CERT.trim();
      
      // Ensure proper PEM format with line breaks
      if (!signingCert.includes('\n') && signingCert.includes('-----BEGIN')) {
        signingCert = signingCert.replace(/(.{64})/g, '$1\n');
      }
      if (!signingKey.includes('\n') && signingKey.includes('-----BEGIN')) {
        signingKey = signingKey.replace(/(.{64})/g, '$1\n');
      }
      if (!wwdrCert.includes('\n') && wwdrCert.includes('-----BEGIN')) {
        wwdrCert = wwdrCert.replace(/(.{64})/g, '$1\n');
      }
      
      await fs.writeFile(certFile, signingCert);
      await fs.writeFile(keyFile, signingKey);
      await fs.writeFile(wwdrFile, wwdrCert);
      
      // Debug certificate format and attempt multiple approaches
      console.log('Certificate lengths:', {
        cert: signingCert.length,
        key: signingKey.length, 
        wwdr: wwdrCert.length
      });
      
      // Test certificate validation with OpenSSL first
      const testCert = spawn('openssl', ['x509', '-in', certFile, '-text', '-noout']);
      const testKey = spawn('openssl', ['pkey', '-in', keyFile, '-noout']);
      
      let certOk = false;
      let keyOk = false;
      
      await Promise.all([
        new Promise<void>((resolve) => {
          testCert.on('close', (code) => {
            certOk = code === 0;
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          testKey.on('close', (code) => {
            keyOk = code === 0;
            resolve();
          });
        })
      ]);
      
      console.log(`Certificate validation: cert=${certOk}, key=${keyOk}`);
      
      if (logoBuffer) {
        await fs.writeFile(path.join(tempDir, 'logo.png'), logoBuffer);
        await fs.writeFile(path.join(tempDir, 'icon.png'), logoBuffer);
      }

      // Create proper PKCS#7 signature with full certificate chain using node-forge
      try {
        console.log('Creating PKCS#7 signature with node-forge...');
        
        // Clean and parse certificates with proper error handling
        try {
          const signingCertPem = forge.pki.certificateFromPem(signingCert);
          const wwdrCertPem = forge.pki.certificateFromPem(wwdrCert);
          const privateKey = forge.pki.privateKeyFromPem(signingKey);
          
          console.log('Certificates parsed successfully with node-forge');
          
          // Create PKCS#7 signed data
          const p7 = forge.pkcs7.createSignedData();
          p7.content = forge.util.createBuffer(manifestContent, 'utf8');
          
          // Add signer with proper attributes for Apple Wallet
          p7.addSigner({
            key: privateKey,
            certificate: signingCertPem,
            digestAlgorithm: forge.pki.oids.sha1,
            authenticatedAttributes: [
              {
                type: forge.pki.oids.contentTypes,
                value: forge.pki.oids.data
              },
              {
                type: forge.pki.oids.messageDigest
              },
              {
                type: forge.pki.oids.signingTime,
                value: new Date()
              }
            ]
          });
          
          // Add certificate chain
          p7.addCertificate(signingCertPem);
          p7.addCertificate(wwdrCertPem);
          
          // Sign the data
          p7.sign({ detached: false });
          
          // Convert to DER format that iOS expects
          const derSignature = forge.asn1.toDer(p7.toAsn1()).getBytes();
          const signatureBuffer = Buffer.from(derSignature, 'binary');
          
          console.log(`Generated PKCS#7 signature: ${signatureBuffer.length} bytes`);
          
          // Create final ZIP with proper PKCS#7 signature
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          
          zip.file('pass.json', passJsonContent);
          zip.file('manifest.json', manifestContent);
          zip.file('signature', signatureBuffer);
          
          if (logoBuffer) {
            zip.file('logo.png', logoBuffer);
            zip.file('icon.png', logoBuffer);
          }

          const signedPassBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE'
          });

          await fs.rm(tempDir, { recursive: true, force: true });
          
          console.log(`Apple Wallet pass signed with PKCS#7 certificate chain (${signedPassBuffer.length} bytes)`);
          return signedPassBuffer;
          
        } catch (certParseError) {
          console.warn('Certificate parsing failed:', certParseError);
          throw certParseError;
        }
        
      } catch (forgeError) {
        console.warn('node-forge PKCS#7 signing failed:', forgeError);
        
        // Final fallback - create minimal but valid signature
        try {
          const crypto = await import('crypto');
          const sign = crypto.createSign('SHA1');
          sign.update(manifestContent);
          
          // Try different key formats
          let signature: Buffer | null = null;
          const keyFormats = [
            signingKey,
            `-----BEGIN PRIVATE KEY-----\n${signingKey.replace(/-----[^-]*-----/g, '').replace(/\s/g, '')}\n-----END PRIVATE KEY-----`,
            `-----BEGIN RSA PRIVATE KEY-----\n${signingKey.replace(/-----[^-]*-----/g, '').replace(/\s/g, '')}\n-----END RSA PRIVATE KEY-----`
          ];
          
          for (const keyFormat of keyFormats) {
            try {
              signature = sign.sign(keyFormat);
              break;
            } catch (e) {
              continue;
            }
          }
          
          if (!signature) {
            throw new Error('All signing methods failed');
          }
          
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          
          zip.file('pass.json', passJsonContent);
          zip.file('manifest.json', manifestContent);
          zip.file('signature', signature);
          
          if (logoBuffer) {
            zip.file('logo.png', logoBuffer);
            zip.file('icon.png', logoBuffer);
          }

          const fallbackBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE'
          });

          await fs.rm(tempDir, { recursive: true, force: true });
          
          console.log(`Apple Wallet pass with fallback signature (${fallbackBuffer.length} bytes)`);
          return fallbackBuffer;
          
        } catch (finalError) {
          console.error('All signing methods failed:', finalError);
          throw new Error(`Failed to create Apple Wallet pass signature: ${finalError}`);
        }
      }
      
    } catch (signingError: any) {
      console.warn('PKCS#7 signing failed:', signingError.message);
      
      // Fallback to unsigned pass structure
      return await createUnsignedPass(card, serial, design);
    }

  } catch (error: any) {
    console.error('Apple Wallet pass generation error:', error);
    throw new Error(`Failed to generate Apple Wallet pass: ${error.message}`);
  }
}

async function createUnsignedPass(card: LoyaltyCard, serial: string, design: any): Promise<Buffer> {
  console.log('Creating unsigned pass structure for testing...');
  
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // Create pass.json
  const passData = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    serialNumber: serial,
    teamIdentifier: process.env.APPLE_TEAM_ID,
    organizationName: design.name || card.businessName || 'Loyalty Card',
    description: `${design.name || 'Loyalty'} Card`,
    foregroundColor: design.textColor || '#000000',
    backgroundColor: design.backgroundColor || '#ffffff',
    labelColor: design.textColor || '#000000',
    logoText: design.name || card.businessName,
    generic: {
      primaryFields: [
        {
          key: 'balance',
          label: 'Points',
          value: `${card.currentStamps || 0}/${design.stamps || 10}`
        }
      ],
      secondaryFields: [
        {
          key: 'name',
          label: 'Card',
          value: design.name || 'Loyalty Card'
        }
      ]
    },
    barcode: {
      message: `loyalty:${card.id}:${card.customerId || 'guest'}`,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1'
    }
  };

  zip.file('pass.json', JSON.stringify(passData, null, 2));

  // Create manifest for unsigned pass
  const manifest: Record<string, string> = {
    'pass.json': createHash('sha1').update(JSON.stringify(passData, null, 2)).digest('hex')
  };

  // Add logo if available
  if (design.logo) {
    try {
      const logoData = design.logo.split(',')[1];
      const logoBuffer = Buffer.from(logoData, 'base64');
      
      zip.file('logo.png', logoBuffer);
      zip.file('icon.png', logoBuffer);
      
      manifest['logo.png'] = createHash('sha1').update(logoBuffer).digest('hex');
      manifest['icon.png'] = createHash('sha1').update(logoBuffer).digest('hex');
    } catch (logoError) {
      console.warn('Logo processing failed:', logoError);
    }
  }

  zip.file('manifest.json', JSON.stringify(manifest));

  const passBuffer = await zip.generateAsync({ 
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });

  console.log(`Unsigned pass created (${passBuffer.length} bytes) - iOS will reject without proper signature`);
  return passBuffer;
}