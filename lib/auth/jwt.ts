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

// Note: JWT_SECRET validation happens in getSecret() when actually signing/verifying.
// This allows the module to be imported without throwing, enabling graceful error handling
// in contexts where JWT functionality is optional (e.g., demo signup without write access).

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

/** Session JWT for UI write access: backend verifies and checks email in WRITE_ALLOWED_EMAILS. */
const SESSION_JWT_EXPIRY = '7d';

export async function signSessionToken(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('email is required for session token');
  return new SignJWT({ email: normalized })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_JWT_EXPIRY)
    .sign(getCachedSecret());
}
