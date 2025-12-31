import { nanoid } from "nanoid";

/**
 * Generate a URL-safe, unique share token.
 * Uses nanoid with 21 characters (126 bits of entropy).
 * Collision-resistant and unguessable.
 */
export function generateShareToken(): string {
  return nanoid(21);
}
