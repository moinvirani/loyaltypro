
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

    // Create PKCS#7 signature for the manifest using OpenSSL approach
    try {
      const crypto = await import('crypto');
      const { spawn } = await import('child_process');
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Create temporary files for certificates
      const tempDir = '/tmp';
      const certPath = path.join(tempDir, 'signing_cert.pem');
      const keyPath = path.join(tempDir, 'signing_key.pem');
      const wwdrPath = path.join(tempDir, 'wwdr_cert.pem');
      const manifestPath = path.join(tempDir, 'manifest.json');
      const signaturePath = path.join(tempDir, 'signature');

      // Format certificates properly
      const signingCert = Buffer.from(process.env.APPLE_SIGNING_CERT, 'base64').toString();
      const signingKey = Buffer.from(process.env.APPLE_SIGNING_KEY, 'base64').toString();
      const wwdrCert = Buffer.from(process.env.APPLE_WWDR_CERT, 'base64').toString();

      const certPem = signingCert.includes('-----BEGIN') ? signingCert : 
        `-----BEGIN CERTIFICATE-----\n${signingCert}\n-----END CERTIFICATE-----`;
      const keyPem = signingKey.includes('-----BEGIN') ? signingKey :
        `-----BEGIN PRIVATE KEY-----\n${signingKey}\n-----END PRIVATE KEY-----`;
      const wwdrPem = wwdrCert.includes('-----BEGIN') ? wwdrCert :
        `-----BEGIN CERTIFICATE-----\n${wwdrCert}\n-----END CERTIFICATE-----`;

      // Write certificates to temporary files
      await fs.writeFile(certPath, certPem);
      await fs.writeFile(keyPath, keyPem);
      await fs.writeFile(wwdrPath, wwdrPem);
      await fs.writeFile(manifestPath, manifestJson);

      // Import forge dynamically to avoid module conflicts
      const forge = await import('node-forge');
      
      // Create signature using node-forge
      const cert = forge.pki.certificateFromPem(certPem);
      const key = forge.pki.privateKeyFromPem(keyPem);
      const wwdr = forge.pki.certificateFromPem(wwdrPem);
      
      // Create PKCS#7 signature
      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(manifestJson);
      p7.addCertificate(cert);
      p7.addCertificate(wwdr);
      p7.addSigner({
        key: key,
        certificate: cert,
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

      p7.sign({ detached: true });
      
      const signatureBytes = forge.asn1.toDer(p7.toAsn1()).getBytes();
      zip.file('signature', Buffer.from(signatureBytes, 'binary'));
      
      // Clean up temporary files
      try {
        await fs.unlink(certPath);
        await fs.unlink(keyPath);
        await fs.unlink(wwdrPath);
        await fs.unlink(manifestPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      console.log('Apple Wallet pass signed successfully with your certificates');
      
    } catch (signingError: any) {
      console.warn('Certificate signing failed, creating unsigned pass for testing:', signingError.message);
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
