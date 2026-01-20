"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSignup() {
    setMsg("Creating account...");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }, // this matches your trigger
      },
    });

    if (error) setMsg(error.message);
    else setMsg("Signup submitted! Check your email to confirm (if email confirmation is ON).");
  }

  return (
    <main style={{ padding: 24, fontFamily: "Arial", maxWidth: 420 }}>
      <h2>Create account</h2>

      <label>Full name</label>
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 12 }} />

      <label>Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 12 }} />

      <label>Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 12 }} />

      <button onClick={handleSignup} style={{ padding: 10, width: "100%" }}>Sign up</button>

      <p style={{ marginTop: 12 }}>{msg}</p>

      <p style={{ marginTop: 12 }}>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </main>
  );
}
