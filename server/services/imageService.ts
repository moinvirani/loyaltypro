import sharp from 'sharp';

export type ProcessedImage = {
  data: string;
  format: string;
  size: number;
};

export async function processImage(base64Image: string): Promise<ProcessedImage> {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Process image with Sharp
    const processed = await sharp(buffer)
      .resize(200, 200, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toFormat('png')
      .toBuffer();

    // Convert back to base64
    const processedBase64 = `data:image/png;base64,${processed.toString('base64')}`;

    return {
      data: processedBase64,
      format: 'png',
      size: processed.length
    };
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error('Failed to process image');
  }
}

export function validateImage(base64Image: string): boolean {
  if (!base64Image) return false;

  // Basic validation for base64 image string
  if (!base64Image.startsWith('data:image/')) return false;

  try {
    // Remove data URL prefix
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Check size (max 5MB)
    if (buffer.length > 5 * 1024 * 1024) return false;

    return true;
  } catch (error) {
    console.error('Image validation error:', error);
    return false;
  }
}