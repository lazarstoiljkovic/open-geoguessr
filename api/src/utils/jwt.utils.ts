import jwt from 'jsonwebtoken';
import { JwtPayload } from 'src/types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
