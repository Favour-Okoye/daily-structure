import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, supabaseConfigured } from "../lib/supabase";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supabaseConfigured) {
    return (
      <div className="mx-auto max-w-sm rounded-3xl bg-white p-6 text-center shadow-md ring-1 ring-sky-100">
        <div className="text-5xl">🔌</div>
        <h1 className="mt-3 text-lg font-black text-sky-900">Not connected yet</h1>
        <p className="mt-2 text-sm text-stone-500">
          Fill in <code className="font-bold">frontend/.env.local</code> — full steps in{" "}
          <code className="font-bold">SETUP.md</code>.
        </p>
      </div>
    );
  }

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setStage("code");
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase!.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) setError(error.message);
    else navigate("/");
  };

  return (
    <div className="mx-auto max-w-sm rounded-3xl bg-white p-6 shadow-md ring-1 ring-sky-100">
      <div className="text-center text-5xl">👒</div>
      <h1 className="mt-2 text-center text-lg font-black text-sky-900">
        {stage === "email" ? "Sign in to Daily Structure" : "Check your inbox"}
      </h1>
      {stage === "email" ? (
        <form onSubmit={sendCode} className="mt-4">
          <p className="mb-3 text-center text-xs font-bold text-stone-400">
            Same email code as MoneyTree — one account, two apps.
          </p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl bg-stone-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-3 w-full rounded-full bg-sky-900 py-2.5 text-sm font-black text-white shadow transition enabled:hover:bg-sky-800 disabled:opacity-40"
          >
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-4">
          <p className="mb-3 text-center text-sm text-stone-500">
            We sent a 6-digit code to <b>{email}</b>
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="w-full rounded-2xl bg-stone-50 px-4 py-2.5 text-center text-xl font-black tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-3 w-full rounded-full bg-sky-900 py-2.5 text-sm font-black text-white shadow transition enabled:hover:bg-sky-800 disabled:opacity-40"
          >
            {busy ? "Checking…" : "Set sail ⚓"}
          </button>
          <button
            type="button"
            onClick={() => setStage("email")}
            className="mt-2 w-full text-center text-xs font-bold text-stone-400"
          >
            Different email
          </button>
        </form>
      )}
      {error && <p className="mt-3 text-center text-sm font-bold text-rose-600">{error}</p>}
    </div>
  );
}
