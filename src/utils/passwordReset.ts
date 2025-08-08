import crypto from 'crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

export function generate6DigitCode() {
  // Gera um código numérico de 6 dígitos (000000–999999)
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
}

export async function hashCode(code: string) {
  return await bcrypt.hash(code, 10)
}

export async function compareCode(code: string, codeHash: string) {
  return await bcrypt.compare(code, codeHash)
}

// Gera um JWT curto para a etapa final (reset)
export function signResetJWT(resetId: number) {
  const secret = process.env.JWT_SECRET || 'dev-secret' // defina no .env em prod
  return jwt.sign(
    { sub: String(resetId), type: 'pwd_reset' },
    secret,
    { expiresIn: '15m' } // token curto
  )
}

export function verifyResetJWT(token: string) {
  const secret = process.env.JWT_SECRET || 'dev-secret'
  return jwt.verify(token, secret) as { sub: string, type: string, iat: number, exp: number }
}
