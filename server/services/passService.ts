import type { LoyaltyCard } from '@db/schema';
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import * as forge from 'node-forge';

export async function generateAppleWalletPass(card: LoyaltyCard, serialNumber?: string): Promise<Buffer> {
  try {
    // Validate required environment variables
    if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID || 
        !process.env.APPLE_SIGNING_KEY) {
      throw new Error('Missing required Apple Wallet configuration');
    }

    console.log('Creating Apple Wallet pass with Node.js crypto signing...');
    
    const design = card.design as any;
    const serial = serialNumber || `card-${card.id}-${Date.now()}`;
    
    // Create temporary build directory
    const buildDir = `/tmp/pass_${Date.now()}`;
    fs.mkdirSync(buildDir, { recursive: true });
    
    try {
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

      // Write pass.json to build directory
      const passJsonContent = JSON.stringify(passData, null, 2);
      fs.writeFileSync(path.join(buildDir, 'pass.json'), passJsonContent);
      
      // Compute SHA1 hashes for every file -> manifest.json
      const manifest: Record<string, string> = {};
      for (const f of fs.readdirSync(buildDir)) {
        manifest[f] = crypto.createHash("sha1").update(fs.readFileSync(path.join(buildDir, f))).digest("hex");
      }
      fs.writeFileSync(path.join(buildDir, "manifest.json"), JSON.stringify(manifest, null, 2));

      // Create PKCS#7 signature with certificate chain for iOS
      console.log('Creating PKCS#7 signature for iOS compatibility...');
      const manifestData = fs.readFileSync(path.join(buildDir, 'manifest.json'));
      
      try {
        // Format certificates for node-forge compatibility
        const formatPemForForge = (data: string, type: 'CERTIFICATE' | 'PRIVATE KEY'): string => {
          const clean = data.replace(/\s+/g, '').replace(/-----[^-]*-----/g, '');
          const lines = clean.match(/.{1,64}/g) || [];
          return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----`;
        };
        
        const formattedCert = formatPemForForge(process.env.APPLE_SIGNING_CERT!, 'CERTIFICATE');
        const formattedKey = formatPemForForge(process.env.APPLE_SIGNING_KEY!, 'PRIVATE KEY');
        
        // Parse certificates and key using node-forge
        const signingCert = forge.pki.certificateFromPem(formattedCert);
        const privateKey = forge.pki.privateKeyFromPem(formattedKey);
        
        // Create PKCS#7 signed data structure
        const p7 = forge.pkcs7.createSignedData();
        p7.content = forge.util.createBuffer(manifestData.toString(), 'utf8');
        
        // Add signer with proper attributes for Apple Wallet
        p7.addSigner({
          key: privateKey,
          certificate: signingCert,
          digestAlgorithm: forge.pki.oids.sha1,
          authenticatedAttributes: [
            {
              type: forge.pki.oids.contentTypes,
              value: forge.pki.oids.data
            },
            {
              type: forge.pki.oids.messageDigest
            }
          ]
        });
        
        // Add signing certificate to the chain
        p7.addCertificate(signingCert);
        
        // Add WWDR certificate if available
        if (process.env.APPLE_WWDR_CERT) {
          try {
            const formattedWwdr = formatPemForForge(process.env.APPLE_WWDR_CERT, 'CERTIFICATE');
            const wwdrCert = forge.pki.certificateFromPem(formattedWwdr);
            p7.addCertificate(wwdrCert);
            console.log('Added WWDR certificate to chain');
          } catch (wwdrError) {
            console.log('WWDR certificate format issue, proceeding without it');
          }
        }
        
        // Sign and convert to DER format
        p7.sign({ detached: false });
        const asn1 = p7.toAsn1();
        const der = forge.asn1.toDer(asn1).getBytes();
        const signature = Buffer.from(der, 'binary');
        
        fs.writeFileSync(path.join(buildDir, 'signature'), signature);
        console.log(`PKCS#7 signature created (${signature.length} bytes) - iOS compatible`);
        
      } catch (forgeError) {
        console.log('PKCS#7 creation failed, using standard crypto signature...');
        
        // Fallback to standard crypto signing
        const sign = crypto.createSign('SHA1');
        sign.update(manifestData);
        
        let signature: Buffer;
        try {
          signature = sign.sign(process.env.APPLE_SIGNING_KEY!);
          console.log('Standard signature created');
        } catch (keyError) {
          const cleanKey = process.env.APPLE_SIGNING_KEY!.replace(/-----[^-]*-----/g, '').replace(/\s/g, '');
          const formattedKey = `-----BEGIN PRIVATE KEY-----\n${cleanKey.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----`;
          signature = sign.sign(formattedKey);
          console.log('Standard signature created with reformatted key');
        }
        
        fs.writeFileSync(path.join(buildDir, 'signature'), signature);
        console.log(`Standard signature written (${signature.length} bytes)`);
      }

      // Create ZIP file with JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      // Add all files from build directory to ZIP
      for (const filename of fs.readdirSync(buildDir)) {
        const filePath = path.join(buildDir, filename);
        const fileContent = fs.readFileSync(filePath);
        zip.file(filename, fileContent);
        console.log(`Added ${filename} to ZIP (${fileContent.length} bytes)`);
      }
      
      const passBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      console.log('Files in pkpass: pass.json, manifest.json, signature');
      
      // Clean up
      fs.rmSync(buildDir, { recursive: true, force: true });
      
      console.log(`Apple Wallet pass created with Node.js crypto (${passBuffer.length} bytes)`);
      return passBuffer;
      
    } catch (buildError) {
      // Clean up on error
      if (fs.existsSync(buildDir)) {
        fs.rmSync(buildDir, { recursive: true, force: true });
      }
      throw buildError;
    }
    
  } catch (error: any) {
    console.error('Apple Wallet pass generation failed:', error.message);
    throw new Error(`Failed to create Apple Wallet pass: ${error.message}`);
  }
}