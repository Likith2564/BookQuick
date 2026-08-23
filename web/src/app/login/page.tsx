"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <div className="glass rounded-2xl p-8">
        <h1 className="font-display text-5xl tracking-wide text-accent">
          BOOKQUICK
        </h1>
        <p className="mt-2 mb-8 text-sm text-muted">
          Know the instant booking opens. Sign in with a magic link — no
          password needed.
        </p>

        {status === "sent" ? (
          <p className="rounded-lg border border-success/30 bg-success-bg px-4 py-3 text-sm text-success">
            Check <strong className="text-text">{email}</strong> for a
            sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input rounded-lg px-4 py-3 text-sm text-text placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {status === "error" && (
              <p className="text-sm text-danger">{error}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
