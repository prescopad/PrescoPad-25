/**
 * Unsigned Cloudinary upload — used for doctor signature images.
 *
 * Uses the public unsigned upload preset; no API key on the client. The cloud
 * name and preset come from Expo extra config (or constants if you prefer to
 * hardcode for now). If either is missing, upload fails clearly.
 */
const CLOUD_NAME = 'dkyby5fyw';
const UPLOAD_PRESET = 'itzjvzjx';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
}

export async function uploadImageToCloudinary(
  fileUri: string,
  options: { folder?: string; filename?: string } = {},
): Promise<CloudinaryUploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured');
  }

  const form = new FormData();
  // React Native / Expo FormData accepts { uri, name, type }.
  form.append('file', {
    uri: fileUri,
    name: options.filename || 'upload.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('upload_preset', UPLOAD_PRESET);
  if (options.folder) form.append('folder', options.folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    let detail = '';
    try {
      const j = await response.json();
      detail = j?.error?.message || JSON.stringify(j);
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(`Cloudinary upload failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  return (await response.json()) as CloudinaryUploadResult;
}
