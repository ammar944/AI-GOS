import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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
  "/api/landing-events", // Public tracker ingest; route enforces origin and event registry
  "/api/research-v2/review-section", // Internal x-internal-key auth (detached review kickoff) — Clerk 404s it otherwise
  "/api/research-v2/executive-brief", // Internal x-internal-key auth (W3 brief kickoff) — Clerk 404s it otherwise
]);

export default clerkMiddleware(async (auth, request) => {
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
