import fs from "fs";

export default function writeCerts() {
  // Read certificates from environment variables
  const cert = process.env.APPLE_SIGNING_CERT;
  const key = process.env.APPLE_SIGNING_KEY;
  const wwdr = process.env.APPLE_WWDR_CERT;

  if (!cert || !key || !wwdr) {
    throw new Error('Missing required Apple certificates in environment variables');
  }

  // Write certificates to temporary files with proper formatting
  const certPath = '/tmp/pass-cert.pem';
  const keyPath = '/tmp/pass-key.pem';
  const wwdrPath = '/tmp/AppleWWDRCA.pem';

  // Advanced certificate formatting with proper line breaks
  function formatCertificate(certData: string, type: 'CERTIFICATE' | 'PRIVATE KEY'): string {
    // Remove all whitespace and line breaks
    let clean = certData.replace(/\s+/g, '');
    
    // Remove existing headers/footers
    clean = clean.replace(/-----BEGIN[^-]*-----/g, '').replace(/-----END[^-]*-----/g, '');
    
    // Add proper line breaks every 64 characters
    const lines = [];
    for (let i = 0; i < clean.length; i += 64) {
      lines.push(clean.substring(i, i + 64));
    }
    
    const formattedContent = lines.join('\n');
    return `-----BEGIN ${type}-----\n${formattedContent}\n-----END ${type}-----`;
  }

  let formattedCert = formatCertificate(cert, 'CERTIFICATE');
  let formattedKey = formatCertificate(key, 'PRIVATE KEY');
  let formattedWwdr = formatCertificate(wwdr, 'CERTIFICATE');

  fs.writeFileSync(certPath, formattedCert);
  fs.writeFileSync(keyPath, formattedKey);
  fs.writeFileSync(wwdrPath, formattedWwdr);

  console.log('Certificates written to temporary files:');
  console.log('- Signing cert:', certPath, '(' + fs.statSync(certPath).size + ' bytes)');
  console.log('- Private key:', keyPath, '(' + fs.statSync(keyPath).size + ' bytes)');
  console.log('- WWDR cert:', wwdrPath, '(' + fs.statSync(wwdrPath).size + ' bytes)');

  return {
    cert: certPath,
    key: keyPath,
    wwdr: wwdrPath
  };
}