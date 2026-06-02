import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  outputFileTracingRoot: projectRoot,
  outputFileTracingIncludes: {
    // The SKILL.md files are readFile'd by loadLabSkill inside the after()
    // callbacks of the run-lab-section and rerun-section lambdas, so those
    // are the bundles that must trace them. (The orchestrate route only
    // fans out fetches and never reads a skill; its include is harmless.)
    '/api/research-v2/orchestrate': ['./src/lib/lab-engine/skills/**/*'],
    '/api/research-v2/run-lab-section': ['./src/lib/lab-engine/skills/**/SKILL.md'],
    '/api/research-v2/rerun-section': ['./src/lib/lab-engine/skills/**/SKILL.md'],
  },
  turbopack: {
    root: projectRoot,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tpc.googlesyndication.com',
        pathname: '/archive/**',
      },
      {
        protocol: 'https',
        hostname: '*.googlesyndication.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.licdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'scontent.*.fbcdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.fbcdn.net',
        pathname: '/**',
      },
      // Foreplay CDNs
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.foreplay.co',
        pathname: '/**',
      },
      // Clerk user avatars
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
