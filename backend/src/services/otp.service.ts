import { ENV } from '../config/env';
import { query, queryOne } from '../config/database';
import { hashOTP, compareOTP } from '../utils/hash';

async function sendSMSviaFast2SMS(phone: string, otp: string): Promise<void> {
  const apiKey = ENV.fast2sms.apiKey;
  if (!apiKey) {
    console.warn('[OTP] FAST2SMS_API_KEY not set. OTP not sent via SMS.');
    return;
  }

  const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      'authorization': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'otp',
      variables_values: otp,
      flash: 0,
      numbers: phone,
    }),
  });

  const data = await response.json() as { return: boolean; message: string };

  if (!data.return) {
    console.error('[OTP] Fast2SMS error:', data.message);
    throw new Error(`SMS delivery failed: ${data.message}`);
  }

  console.log(`[OTP] SMS sent to ${phone}`);
}

export async function generateOTP(phone: string): Promise<string> {
  // In demo mode, always return the demo OTP
  if (ENV.otp.demoMode) {
    const otpHash = await hashOTP(ENV.otp.demoCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await query(
      `UPDATE users SET otp_hash = $1, otp_expires_at = $2 WHERE phone = $3`,
      [otpHash, expiresAt.toISOString(), phone]
    );

    return ENV.otp.demoCode;
  }

  // Production: Generate random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await hashOTP(otp);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await query(
    `UPDATE users SET otp_hash = $1, otp_expires_at = $2 WHERE phone = $3`,
    [otpHash, expiresAt.toISOString(), phone]
  );

  // Send OTP via Fast2SMS
  await sendSMSviaFast2SMS(phone, otp);

  return otp;
}

export async function verifyOTP(phone: string, otp: string): Promise<boolean> {
  const user = await queryOne<{
    otp_hash: string;
    otp_expires_at: string;
  }>(
    `SELECT otp_hash, otp_expires_at FROM users WHERE phone = $1`,
    [phone]
  );

  if (!user || !user.otp_hash) return false;

  // Check expiry
  const expiresAt = new Date(user.otp_expires_at);
  if (expiresAt < new Date()) return false;

  // Compare OTP
  const isValid = await compareOTP(otp, user.otp_hash);

  if (isValid) {
    // Clear OTP after successful verification
    await query(
      `UPDATE users SET otp_hash = NULL, otp_expires_at = NULL WHERE phone = $1`,
      [phone]
    );
  }

  return isValid;
}
