"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
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
    <div className="rounded-2xl border bg-white p-6 shadow-sm max-w-md">
      <h2 className="text-lg font-semibold">Giriş</h2>
      <p className="mt-1 text-sm text-neutral-600">Admin şifresini gir.</p>

      <input
        className="mt-4 w-full rounded-lg border px-3 py-2"
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
