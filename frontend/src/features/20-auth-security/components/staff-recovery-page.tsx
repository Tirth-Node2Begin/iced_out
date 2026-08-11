"use client";

import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { AuthVisual } from "@/components/auth/auth-visual";

export function StaffRecoveryPage({ mode }: { mode: "forgot" | "reset" }) {
  const [complete, setComplete] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setComplete(true); }
  return <main className="auth-page auth-page--staff"><Link className="auth-page__back" href="/admin/login"><ArrowLeft size={16} /> Staff sign in</Link><AuthVisual staff /><section className="auth-card"><span className="auth-card__icon">{complete ? <Check size={24} /> : <ShieldCheck size={24} />}</span><p className="eyebrow">Staff account recovery</p><h1>{complete ? "Request prepared." : mode === "forgot" ? "Recover access." : "Choose a new password."}</h1><p>{complete ? "This frontend preview sent nothing. Production returns the same neutral response for every eligible recovery request." : "Recovery never reveals whether a staff identity exists and always requires the staff-only audience."}</p>{!complete && <form className="auth-form" onSubmit={submit}><label>Work email<input type="email" autoComplete="email" required /></label>{mode === "reset" && <><label>Recovery token<input autoComplete="one-time-code" required /></label><label>New password<input type="password" minLength={12} autoComplete="new-password" required /></label></>}<button className="button button--primary button--wide" type="submit">{mode === "forgot" ? "Prepare recovery request" : "Prepare password update"}<ArrowRight size={17} /></button></form>}<small>Frontend fixture. No credential or recovery request leaves this browser.</small></section></main>;
}
