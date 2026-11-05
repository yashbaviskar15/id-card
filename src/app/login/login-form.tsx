"use client";

import { FormEvent, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const origin = window.location.origin;
    const { error } = await getBrowserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` }
    });
    setMessage(error ? "Unable to send the sign-in link." : "Check your email for the sign-in link.");
    setPending(false);
  }

  return (
    <form className="code-form" onSubmit={submit}>
      <label htmlFor="owner-email">Owner email</label>
      <input className="code-input" id="owner-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
      <button className="code-button" type="submit" disabled={pending}>{pending ? "Sending..." : "Send sign-in link"}</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}