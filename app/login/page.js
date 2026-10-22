"use client";
import { useEffect, useState } from "react";
import { authClient, useSession } from "../../lib/client";
import Nav from "../../components/Nav";
export default function Login() {
  const { session } = useSession();
  const [mode, setMode] = useState("login"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get("mode") === "signup") setMode("signup");
    if (p.get("mode") === "reset") setMode("reset");
    let subscription;
    try {
      subscription = authClient().auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") setMode("reset");
      }).data.subscription;
    } catch {}
    return () => subscription?.unsubscribe();
  }, []);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      const c = authClient();
      let r;
      if (mode === "signup") {
        r = await c.auth.signUp({
          email: f.get("email"),
          password: f.get("password"),
          options: { emailRedirectTo: `${location.origin}/login` },
        });
        if (r.error) throw r.error;
        setMessage(
          "Check your email to confirm your account, then sign in. If you already have an account, use Sign in or reset your password.",
        );
      } else if (mode === "forgot") {
        r = await c.auth.resetPasswordForEmail(f.get("email"), {
          redirectTo: `${location.origin}/login?mode=reset`,
        });
        if (r.error) throw r.error;
        setMessage(
          "If this account exists, a password-reset link will arrive by email.",
        );
      } else if (mode === "reset") {
        r = await c.auth.updateUser({ password: f.get("password") });
        if (r.error) throw r.error;
        setMessage("Password updated. You can now open your dashboard.");
        setMode("login");
      } else {
        r = await c.auth.signInWithPassword({
          email: f.get("email"),
          password: f.get("password"),
        });
        if (r.error) throw r.error;
        const params = new URLSearchParams(location.search);
        window.location.href =
          params.get("next") === "admin"
            ? "/admin" +
              (params.get("ticket")
                ? "?ticket=" + encodeURIComponent(params.get("ticket"))
                : "")
            : "/dashboard";
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Nav />
      <main className="auth-shell">
        <section>
          <div className="eyebrow">YOUR NEXT ADVENTURE</div>
          <h1>
            One account.
            <br />
            The whole trip<span>.</span>
          </h1>
          <p className="intro">
            Your registration, trail pass, trip updates and a way to reach your
            organizers — all in one place.
          </p>
          <div className="auth-points">
            <p>01 &nbsp; Create and verify your account</p>
            <p>02 &nbsp; Register and upload payment proof</p>
            <p>03 &nbsp; Keep your trip dashboard close</p>
          </div>
        </section>
        <section className="card">
          <h2>
            {mode === "signup"
              ? "Join the adventure"
              : mode === "forgot"
                ? "Reset your password"
                : mode === "reset"
                  ? "Choose a new password"
                  : "Welcome back"}
          </h2>
          <p className="muted">
            Students and organizers use the same secure sign-in.
          </p>
          {session && mode !== "reset" && (
            <p className="notice-inline">
              You’re signed in. <a href="/dashboard">Open my dashboard →</a>
            </p>
          )}
          <form onSubmit={submit}>
            {mode !== "reset" && (
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label>
                {mode === "reset" ? "New password" : "Password"}
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                />
              </label>
            )}
            <button className="full" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signup"
                  ? "Create account →"
                  : mode === "forgot"
                    ? "Send reset link"
                    : mode === "reset"
                      ? "Save password"
                      : "Sign in →"}
            </button>
          </form>
          <div className="auth-links">
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setMessage("");
              }}
            >
              {mode === "signup"
                ? "Already registered? Sign in"
                : "Create an account"}
            </button>
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === "forgot" ? "login" : "forgot");
                setMessage("");
              }}
            >
              {mode === "forgot" ? "Back to sign in" : "Forgot password?"}
            </button>
          </div>
          {message && (
            <p role="status" className="notice-inline">
              {message}
            </p>
          )}
        </section>
      </main>
    </>
  );
}
