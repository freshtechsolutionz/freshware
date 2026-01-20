"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function handleLogin() {
    setMsg("Logging in...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else setMsg("Logged in! (Next step: redirect to dashboard)");
  }

  return (
    <main style={{ padding: 24, fontFamily: "Arial", maxWidth: 420 }}>
      <h2>Log in</h2>

      <label>Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 12 }} />

      <label>Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 12 }} />

      <button onClick={handleLogin} style={{ padding: 10, width: "100%" }}>Log in</button>

      <p style={{ marginTop: 12 }}>{msg}</p>
    </main>
  );
}
