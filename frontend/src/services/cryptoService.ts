import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

export async function hashString(data: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
}

export async function hashPDF(pdfPath: string): Promise<string> {
  const file = new File(pdfPath);
  const fileContent = await file.base64();
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, fileContent);
}

export function generateUUID(): string {
  return Crypto.randomUUID();
}
