"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  const supabase = supabaseBrowser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function handleLogin() {
    setMsg("Logging in...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMsg(error.message);
      return;
    }

setMsg("Logged in! Redirecting...");

const nextParam = new URLSearchParams(window.location.search).get("next");

// prevent loops like next=/login or blank
const safeNext =
  nextParam && nextParam.startsWith("/") && !nextParam.startsWith("/login")
    ? nextParam
    : "/dashboard";

window.location.assign(safeNext);



  }

  return (
    <main style={{ padding: 24, fontFamily: "Arial", maxWidth: 420 }}>
      <h2>Log in</h2>

      <label>Email</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 12 }}
      />

      <label>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 12 }}
      />

      <button onClick={handleLogin} style={{ padding: 10, width: "100%" }}>
        Log in
      </button>

      <p style={{ marginTop: 12 }}>{msg}</p>
    </main>
  );
}
