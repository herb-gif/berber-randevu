"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", { credentials: "include", method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || "Şifre yanlış");

      location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md rounded-2xl border border-white/10 bg-neutral-950/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <h2 className="text-lg font-semibold text-neutral-100">Giriş</h2>
      <p className="mt-1 text-sm text-white/60">Admin şifresini gir.</p>

      <input
        className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-neutral-100 placeholder:text-white/35 outline-none focus:border-mc-bronze focus:ring-2 focus:ring-mc-bronze/30"
        type="password"
        placeholder="Şifre"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60"
        onClick={submit}
        disabled={loading}
      >
        {loading ? "Giriş..." : "Giriş"}
      </button>
    </div>
  );
}
