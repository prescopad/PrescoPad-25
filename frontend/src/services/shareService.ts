import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';

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
