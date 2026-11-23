"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { error?: string; redirectTo?: string; message?: string };
  return { ok: res.ok, ...json };
}

/** Sign in. "code": e-mail → 6-digit code (decided 21 Nov 2026). "password": e-mail + password. */
export function LoginForm({ showDemoHint, mode, demoPasswords }: { showDemoHint: boolean; mode: "code" | "password"; demoPasswords: boolean }) {
  const router = useRouter();
  const [usePassword, setUsePassword] = useState(mode === "password");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setPending(true);
    try {
      await fn();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }
  const done = (to: string) => {
    router.replace(to);
    router.refresh();
  };

  function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    return run(async () => {
      const r = await post("/api/auth/login", { email: form.get("email"), password: form.get("password") });
      if (!r.ok || !r.redirectTo) return setError(r.error ?? "Sign-in failed. Please try again.");
      done(r.redirectTo);
    });
  }
  function sendCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    return run(async () => {
      const r = await post("/api/auth/request-code", { email });
      if (!r.ok) return setError(r.error ?? "Could not send the code. Please try again.");
      setSentTo(email.trim().toLowerCase());
      setInfo(r.message ?? "Check your e-mail for the code.");
    });
  }
  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    return run(async () => {
      const r = await post("/api/auth/verify-code", { email: sentTo, code });
      if (!r.ok || !r.redirectTo) return setError(r.error ?? "Sign-in failed. Please try again.");
      done(r.redirectTo);
    });
  }

  const errorBox = error && (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  if (usePassword) {
    return (
      <form onSubmit={onPassword} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="username" required className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11" />
        </div>
        {errorBox}
        <Button type="submit" disabled={pending} className="h-11 w-full">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        {mode === "code" && (
          <button type="button" className="w-full text-center text-sm text-muted-foreground underline" onClick={() => setUsePassword(false)}>
            Sign in with an e-mail code instead
          </button>
        )}
        {showDemoHint && <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">Development build: demo accounts are listed in the README (“Demo accounts”).</p>}
      </form>
    );
  }

  if (!sentTo) {
    return (
      <form onSubmit={sendCode} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work e-mail</Label>
          <Input id="email" type="email" autoComplete="username" required className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {errorBox}
        <Button type="submit" disabled={pending || !email.includes("@")} className="h-11 w-full">
          {pending && <Loader2 className="size-4 animate-spin" />} Send me a sign-in code
        </Button>
        {demoPasswords && (
          <button type="button" className="w-full text-center text-sm text-muted-foreground underline" onClick={() => setUsePassword(true)}>
            Demo account? Sign in with the demo password
          </button>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4" noValidate>
      {info && <p className="rounded-md bg-muted px-3 py-2 text-sm">{info}</p>}
      <div className="space-y-1.5">
        <Label htmlFor="code">6-digit code</Label>
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus className="h-11 text-center text-lg tracking-[0.4em]" />
      </div>
      {errorBox}
      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending && <Loader2 className="size-4 animate-spin" />} Sign in
      </Button>
      <div className="flex justify-between text-sm text-muted-foreground">
        <button type="button" className="underline" onClick={() => (setSentTo(null), setInfo(null), setError(null))}>
          Use a different e-mail
        </button>
        <button type="button" className="underline" disabled={pending} onClick={() => sendCode()}>
          Send a new code
        </button>
      </div>
    </form>
  );
}
