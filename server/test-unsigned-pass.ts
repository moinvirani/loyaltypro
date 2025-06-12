import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Create a test unsigned pass to verify structure
export async function createTestPass(req: Request, res: Response) {
  const buildDir = `/tmp/test_pass_${Date.now()}`;
  fs.mkdirSync(buildDir, { recursive: true });

  try {
    // Create minimal valid pass.json
    const passData = {
      formatVersion: 1,
      passTypeIdentifier: "pass.com.yourcompany.test",
      serialNumber: "TEST-123",
      teamIdentifier: "YOUR_TEAM_ID",
      organizationName: "Test Company",
      description: "Test Pass",
      foregroundColor: "rgb(0, 0, 0)",
      backgroundColor: "rgb(255, 255, 255)",
      generic: {
        primaryFields: [
          {
            key: "balance",
            label: "Test",
            value: "UNSIGNED"
          }
        ]
      },
      barcodes: [
        {
          message: "TEST-QR",
          format: "PKBarcodeFormatQR",
          messageEncoding: "iso-8859-1"
        }
      ]
    };

    const passJsonContent = JSON.stringify(passData, null, 2);
    fs.writeFileSync(path.join(buildDir, 'pass.json'), passJsonContent);

    // Create manifest
    const manifest = {
      'pass.json': crypto.createHash('sha1').update(passJsonContent).digest('hex')
    };
    fs.writeFileSync(path.join(buildDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // Create empty signature file (this will make iOS show a specific error)
    fs.writeFileSync(path.join(buildDir, 'signature'), Buffer.alloc(0));

    // Create ZIP
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    for (const filename of fs.readdirSync(buildDir)) {
      const fileContent = fs.readFileSync(path.join(buildDir, filename));
      zip.file(filename, fileContent);
    }
    
    const passBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });

    // Clean up
    fs.rmSync(buildDir, { recursive: true, force: true });

    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-disposition", "attachment; filename=test-unsigned.pkpass");
    res.send(passBuffer);

  } catch (error: any) {
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
    res.status(500).json({ error: error.message });
  }
}