import crypto from 'crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

export function generate6DigitCode() {
  
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
}

export async function hashCode(code: string) {
  return await bcrypt.hash(code, 10)
}

export async function compareCode(code: string, codeHash: string) {
  return await bcrypt.compare(code, codeHash)
}


export function signResetJWT(resetId: number) {
  const secret = process.env.JWT_SECRET || 'dev-secret' 
  return jwt.sign(
    { sub: String(resetId), type: 'pwd_reset' },
    secret,
    { expiresIn: '15m' } 
  )
}

export function verifyResetJWT(token: string) {
  const secret = process.env.JWT_SECRET || 'dev-secret'
  return jwt.verify(token, secret) as { sub: string, type: string, iat: number, exp: number }
}
