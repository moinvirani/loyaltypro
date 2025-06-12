import fs from "fs";

export default function writeCerts() {
  // Read certificates from environment variables
  const cert = process.env.APPLE_SIGNING_CERT;
  const key = process.env.APPLE_SIGNING_KEY;
  const wwdr = process.env.APPLE_WWDR_CERT;

  if (!cert || !key || !wwdr) {
    throw new Error('Missing required Apple certificates in environment variables');
  }

  // Write certificates to temporary files
  const certPath = '/tmp/pass-cert.pem';
  const keyPath = '/tmp/pass-key.pem';
  const wwdrPath = '/tmp/AppleWWDRCA.pem';

  fs.writeFileSync(certPath, cert);
  fs.writeFileSync(keyPath, key);
  fs.writeFileSync(wwdrPath, wwdr);

  return {
    cert: certPath,
    key: keyPath,
    wwdr: wwdrPath
  };
}