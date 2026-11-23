import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/auth/dal";
import { loginMode } from "@/lib/auth/login-code";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));
  const isDev = process.env.NODE_ENV !== "production";
  const mode = loginMode();

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-md bg-primary font-bold text-primary-foreground">S</span>
          <span className="font-semibold text-white">Sangeetha Mobiles</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight text-white">Every new store, from location to launch.</h2>
          <p className="mt-3 text-sidebar-foreground/80">
            Store owners update progress from site; HQ sees status, delays and costs for every store across India on one dashboard.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Internal tool · Store Launch Tracker</p>
      </section>
      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <p className="text-sm font-medium text-primary">Sangeetha Mobiles</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">{mode === "code" ? "We e-mail you a 6-digit code. No password needed." : "Use your e-mail and password."}</p>
          <LoginForm showDemoHint={isDev} mode={mode} demoPasswords={mode === "code" && process.env.DEMO_PASSWORD_LOGIN === "1"} />
        </div>
      </section>
    </main>
  );
}
