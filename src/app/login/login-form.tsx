"use client";

import { FormEvent, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const { error } = await getBrowserClient().auth.signInWithPassword({ email, password });
      setMessage(error ? "Email or password is incorrect." : "Signed in. Opening dashboard...");
      if (!error) window.location.assign("/dashboard");
    } catch {
      setMessage("Supabase configuration is missing in this deployment.");
    }
    setPending(false);
  }

  return (
    <form className="code-form" onSubmit={submit}>
      <label htmlFor="owner-email">Owner email</label>
      <input className="code-input" id="owner-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
      <label htmlFor="owner-password">Password</label>
      <input className="code-input" id="owner-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
      <button className="code-button" type="submit" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}