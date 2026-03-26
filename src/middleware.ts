import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/shared/(.*)",
  "/test/(.*)", // Test pages for development
  "/blueprint-preview(.*)", // Design preview page
  "/api/journey/(.*)", // Route handlers do their own auth; avoid Clerk HTML rewrites on stream/prefill failures
  "/api/blueprints/(.*)",
  "/api/webhooks/(.*)", // Clerk webhooks - verified via svix signature
  "/api/chat/(.*)", // Chat routes handle their own auth
  "/api/profiles(.*)", // Profile routes handle their own auth
  "/api/share/(.*)", // Share token lookup is public
]);

// Allowed emails / domains — add entries here to grant access
const ALLOWED_EMAILS: string[] = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isEmailAllowed(email: string | undefined): boolean {
  if (!email) return false;
  if (ALLOWED_EMAILS.length === 0) return true; // no allowlist = open access
  const lower = email.toLowerCase();
  return ALLOWED_EMAILS.some(
    (entry) =>
      entry === lower || // exact match
      (entry.startsWith("@") && lower.endsWith(entry)), // domain match
  );
}

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;

  const session = await auth.protect();

  // Allowlist gate — only checked on protected routes
  if (ALLOWED_EMAILS.length > 0) {
    const email = session.sessionClaims?.email as string | undefined;
    if (!isEmailAllowed(email)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
