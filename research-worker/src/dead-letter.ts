import * as fs from 'fs';
import * as path from 'path';

const DEAD_LETTER_DIR = path.join(process.cwd(), 'dead-letters');

export function writeDeadLetter(
  userId: string,
  section: string,
  data: unknown,
  error: string,
): void {
  try {
    fs.mkdirSync(DEAD_LETTER_DIR, { recursive: true });
    const filename = `${new Date().toISOString().split('T')[0]}-${section}-${userId.slice(0, 8)}.json`;
    const filepath = path.join(DEAD_LETTER_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify({
      userId,
      section,
      data,
      error,
      timestamp: new Date().toISOString(),
    }, null, 2));
    console.warn(`[dead-letter] Written to ${filepath}`);
  } catch (err) {
    console.error('[dead-letter] Failed to write dead letter:', err);
  }
}
