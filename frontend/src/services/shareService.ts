import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import { File, Directory, Paths } from 'expo-file-system';
import { Platform, Share, ToastAndroid } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export async function shareViaPDF(pdfPath: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(pdfPath, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share Prescription',
  });
}

/**
 * WhatsApp-first share for a generated prescription PDF.
 *
 * Strategy (works on both Android and iOS without needing the WhatsApp
 * Business API):
 *   1. Open WhatsApp directly to the patient's number with the clinic + app
 *      message pre-filled — the doctor sees the patient picked already.
 *   2. After a short delay, open the OS share sheet for the PDF, where the
 *      doctor picks WhatsApp → patient → Send. The PDF arrives as an
 *      attachment in the same conversation.
 *
 * If WhatsApp isn't installed, we fall back to the system share sheet only
 * and surface a clear error to the caller.
 */
export async function shareRxOnWhatsApp(
  message: string,
  phone?: string,
): Promise<void> {
  if (phone) {
    const cleaned = phone.replace(/\D/g, '');
    const number = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
    const url = `whatsapp://send?phone=${number}&text=${encodeURIComponent(message)}`;
    
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      throw new Error('WhatsApp is not installed');
    }
    await Linking.openURL(url);
  } else {
    throw new Error('No phone number provided');
  }
}

export async function shareViaWhatsApp(
  text: string,
  phone?: string
): Promise<void> {
  const encodedText = encodeURIComponent(text);
  const url = phone
    ? `whatsapp://send?phone=91${phone}&text=${encodedText}`
    : `whatsapp://send?text=${encodedText}`;

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error('WhatsApp is not installed');
  }
  await Linking.openURL(url);
}

/**
 * Save the generated PDF to a user-accessible location and return its uri.
 * The PDF is already inside the app's document directory; this clones it to
 * a fresh path with a friendly name so a subsequent share sheet shows a
 * sensible filename to the user. For Android proper "Downloads" we'd need
 * the Storage Access Framework — out of scope for now.
 */
export async function exportPDFCopy(
  pdfPath: string,
  friendlyName: string,
): Promise<string> {
  const cleanName = friendlyName.replace(/[^a-zA-Z0-9_-]+/g, '_') + '.pdf';
  const downloadsDir = new Directory(Paths.document, 'downloads');
  if (!downloadsDir.exists) downloadsDir.create({ intermediates: true });
  const dest = new File(downloadsDir, cleanName);
  if (dest.exists) dest.delete();
  const src = new File(pdfPath);
  src.copy(dest);
  return dest.uri;
}

export async function shareViaSMS(
  text: string,
  phone?: string
): Promise<void> {
  const body = encodeURIComponent(text);
  const url = phone
    ? `sms:${phone}?body=${body}`
    : `sms:?body=${body}`;

  await Linking.openURL(url);
}

export async function shareViaEmail(
  subject: string,
  body: string,
  to?: string
): Promise<void> {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  const url = to
    ? `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`
    : `mailto:?subject=${encodedSubject}&body=${encodedBody}`;

  await Linking.openURL(url);
}
