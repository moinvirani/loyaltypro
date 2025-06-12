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

  // Ensure certificates have proper PEM formatting
  let formattedCert = cert.trim();
  if (!formattedCert.startsWith('-----BEGIN CERTIFICATE-----')) {
    formattedCert = `-----BEGIN CERTIFICATE-----\n${formattedCert}\n-----END CERTIFICATE-----`;
  }

  let formattedKey = key.trim();
  if (!formattedKey.startsWith('-----BEGIN PRIVATE KEY-----') && !formattedKey.startsWith('-----BEGIN RSA PRIVATE KEY-----')) {
    formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
  }

  let formattedWwdr = wwdr.trim();
  if (!formattedWwdr.startsWith('-----BEGIN CERTIFICATE-----')) {
    formattedWwdr = `-----BEGIN CERTIFICATE-----\n${formattedWwdr}\n-----END CERTIFICATE-----`;
  }

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