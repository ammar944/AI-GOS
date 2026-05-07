import path from 'node:path';
import { config } from 'dotenv';

function loadEnvFile(relativePath: string): void {
  config({
    path: path.resolve(process.cwd(), relativePath),
    override: false,
  });
}

export function loadWorkerEnv(): void {
  loadEnvFile('../.env.local');
  loadEnvFile('.env');

  if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
}

loadWorkerEnv();
