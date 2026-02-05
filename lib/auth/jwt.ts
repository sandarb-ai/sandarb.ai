import { SignJWT, jwtVerify } from 'jose';

const DEV_SECRET = 'dev-secret-do-not-use-in-prod';

function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!raw || raw === DEV_SECRET) {
      throw new Error(
        'JWT_SECRET must be set to a strong secret in production. Do not use dev-secret-do-not-use-in-prod.'
      );
    }
  }
  return new TextEncoder().encode(raw || DEV_SECRET);
}

// Fail fast in production if JWT_SECRET is missing or weak (when this module is first loaded)
if (process.env.NODE_ENV === 'production') {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw === DEV_SECRET) {
    throw new Error(
      'JWT_SECRET must be set to a strong secret in production. Do not use dev-secret-do-not-use-in-prod.'
    );
  }
}

let _cachedSecret: Uint8Array | null = null;

function getCachedSecret(): Uint8Array {
  if (!_cachedSecret) _cachedSecret = getSecret();
  return _cachedSecret;
}

export async function signToken(agentId: string) {
  return new SignJWT({ agentId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(getCachedSecret());
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getCachedSecret());
    return payload as { agentId: string };
  } catch (err) {
    return null; // Invalid or expired
  }
}
