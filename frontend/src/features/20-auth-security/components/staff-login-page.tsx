"use client";

import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent } from "react";

import { safeReturnPath } from "@/config/route-rules";
import { AuthVisual } from "@/components/auth/auth-visual";
import { useAuth, type StaffRole } from "@/features/20-auth-security/auth-context";

export function StaffLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInStaff } = useAuth();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    signInStaff((form.get("role") as StaffRole) || "ADMIN");
    router.replace(safeReturnPath(searchParams.get("returnTo"), "/admin"));
  }

  return (
    <main className="auth-page auth-page--staff">
      <Link className="auth-page__back" href="/"><ArrowLeft size={16} /> Storefront</Link>
      <AuthVisual staff />
      <section className="auth-card">
        <span className="auth-card__icon"><ShieldCheck size={24} /></span>
        <p className="eyebrow">Iced_out operations</p>
        <h1>Staff access.</h1>
        <p>Customer and staff sessions remain separate. Choose a seeded role to review its permission-shaped workspace.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>Work email<input name="email" type="email" autoComplete="username" defaultValue="admin@iced-out.example" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" defaultValue="preview1" minLength={6} required /></label>
          <label>Preview role<select name="role" defaultValue="ADMIN"><option>ADMIN</option><option>MANAGER</option><option>WAREHOUSE</option><option>SUPPORT</option></select></label>
          <button className="button button--primary button--wide" type="submit">Open permitted workspace<ArrowRight size={17} /></button>
        </form>
        <small>Frontend fixture. Production staff authentication and MFA remain API-authoritative.</small>
      </section>
    </main>
  );
}
