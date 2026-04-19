import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

interface TokenPayload {
  userId: string;
  role: string;
  phone: string;
  clinicId?: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ENV.jwt.secret, {
    expiresIn: ENV.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, ENV.jwt.refreshSecret, {
    expiresIn: ENV.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ENV.jwt.secret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, ENV.jwt.refreshSecret) as TokenPayload;
}
