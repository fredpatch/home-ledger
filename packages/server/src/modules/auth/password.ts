import { hash, verify } from "@node-rs/argon2";
import { PASSWORD_MAX_LENGTH } from "@suivi/shared";

export const PASSWORD_MIN_LENGTH = 12;

// argon2id is the library default (PROJECT.md §Security); explicit OWASP baseline costs.
// The parameters are stored in the encoded hash, so verify needs no options.
const HASH_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

// A malformed stored hash counts as a mismatch, never as a success.
export async function verifyPassword(encodedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(encodedHash, password);
  } catch {
    return false;
  }
}

export type NewPasswordIssue = "too_short" | "too_long" | "mismatch";

export function checkNewPassword(password: string, confirmation: string): NewPasswordIssue | null {
  if ([...password].length < PASSWORD_MIN_LENGTH) {
    return "too_short";
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return "too_long";
  }
  if (password !== confirmation) {
    return "mismatch";
  }
  return null;
}
