import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(54,94,255,0.10) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
        aria-hidden="true"
      />

      {/* Logo */}
      <div className="relative z-10 mb-8">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Logo size="md" />
        </Link>
      </div>

      {/* Clerk SignIn */}
      <div className="relative z-10">
        <SignIn
          forceRedirectUrl="/journey"
          signUpUrl="/sign-up"
        />
      </div>
    </div>
  );
}
