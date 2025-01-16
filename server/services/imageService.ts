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
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Convert back to base64
    const processedBase64 = `data:image/jpeg;base64,${processed.toString('base64')}`;

    return {
      data: processedBase64,
      format: 'jpeg',
      size: processed.length
    };
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error('Failed to process image');
  }
}

export function validateImage(base64Image: string): boolean {
  if (!base64Image) return false;

  // Check if it's a valid base64 image string
  const regex = /^data:image\/(jpeg|png|gif|webp);base64,/;
  if (!regex.test(base64Image)) return false;

  // Check size (max 5MB)
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const size = Buffer.from(base64Data, 'base64').length;
  if (size > 5 * 1024 * 1024) return false;

  return true;
}
