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
    try {
      const origin = window.location.origin;
      const { error } = await getBrowserClient().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}/auth/callback` }
      });
      if (!error) {
        setMessage("Check your email for the sign-in link.");
      } else if (error.message.toLowerCase().includes("email provider")) {
        setMessage("Email sign-in is disabled in Supabase. Enable the Email provider first.");
      } else if (error.message.toLowerCase().includes("redirect")) {
        setMessage("Add this callback URL in Supabase Auth: /auth/callback.");
      } else if (error.message.toLowerCase().includes("apikey") || error.message.toLowerCase().includes("api key")) {
        setMessage("The Supabase public URL or publishable key is missing in Vercel.");
      } else {
        setMessage("Supabase could not send the sign-in link. Check the Supabase Auth email settings.");
      }
    } catch {
      setMessage("Supabase configuration is missing in this deployment.");
    }
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