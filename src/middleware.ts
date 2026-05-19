import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/journey", // Public intake shell; route handlers still enforce auth for user data and research writes
  "/shared/(.*)",
  "/test/(.*)", // Test pages for development
  "/dev/(.*)", // Dev-only preview routes for typed-artifact UI fixtures (no auth)
  "/research-v2/managed-agents-prototype", // Local Managed Agents replay; page returns 404 in production
  "/blueprint-preview(.*)", // Design preview page
  "/api/journey/(.*)", // Route handlers do their own auth; avoid Clerk HTML rewrites on stream/prefill failures
  "/api/blueprints/(.*)",
  "/api/webhooks/(.*)", // Clerk webhooks - verified via svix signature
  "/api/chat/(.*)", // Chat routes handle their own auth
  "/api/profiles(.*)", // Profile routes handle their own auth
  "/api/share/(.*)", // Share token lookup is public
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
