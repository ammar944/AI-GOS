import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { shareTokenExists } from "@/lib/research-v2/share-token-exists";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/shared/(.*)",
  "/api/journey/(.*)", // Route handlers do their own auth; avoid Clerk HTML rewrites on stream/prefill failures
  "/api/blueprints/(.*)",
  "/api/webhooks/(.*)", // Clerk webhooks - verified via svix signature
  "/api/chat/(.*)", // Chat routes handle their own auth
  "/api/profiles(.*)", // Profile routes handle their own auth
  "/api/share/(.*)", // Share token lookup is public
]);

// Matches a single-segment share page like `/shared/<token>` (not nested paths).
const SHARE_PAGE_PATH = /^\/shared\/([^/]+)\/?$/;

// The `/shared/[token]` page can only soft-404 (HTTP 200) because the root
// app/loading.tsx Suspense boundary streams a 200 shell before its notFound()
// runs. Emit a real 404 from middleware — the only place the status is ours.
const SHARE_NOT_FOUND_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shared session not found | AIGOS</title><style>html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0a0a;color:#ededed}main{text-align:center;padding:24px}h1{font-size:18px;font-weight:600;margin:0 0 8px}p{margin:0 0 20px;color:#a1a1a1;font-size:14px}a{color:#ededed;font-size:14px;text-decoration:none;border:1px solid #2a2a2a;border-radius:8px;padding:8px 16px;display:inline-block}</style></head><body><main><h1>Shared session not found</h1><p>This share link is invalid or has been revoked.</p><a href="/">Go home</a></main></body></html>`;

export default clerkMiddleware(async (auth, request) => {
  // Hard-404 for unknown public share tokens (see SHARE_NOT_FOUND_HTML note).
  const sharePage = request.nextUrl.pathname.match(SHARE_PAGE_PATH);
  if (sharePage) {
    const token = sharePage[1];
    if (!(await shareTokenExists(token))) {
      return new NextResponse(SHARE_NOT_FOUND_HTML, {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    return; // known token (or degraded env) → public route, render normally
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
