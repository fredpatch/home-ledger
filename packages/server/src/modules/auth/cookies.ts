// __Host- prefix: the browser only accepts it with Secure, Path=/ and no Domain (PROJECT.md §Security).
export const SESSION_COOKIE = "__Host-sid";

const ATTRIBUTES = "Path=/; HttpOnly; Secure; SameSite=Strict";

// Returns the first cookie with that name, or null. Values are not decoded: ours are base64url.
export function readCookie(header: string | undefined, name: string): string | null {
  if (header === undefined) {
    return null;
  }
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator !== -1 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

export function sessionCookie(value: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${value}; ${ATTRIBUTES}; Max-Age=${maxAgeSeconds}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; ${ATTRIBUTES}; Max-Age=0`;
}
