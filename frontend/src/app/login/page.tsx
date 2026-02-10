// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/app/login/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

type Mode = "signin" | "signup" | "reset" | "update-password";

export default function LoginPage() {
  const router = useRouter();
  const {
    user,
    loading,
    isPasswordRecovery,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    initialize,
  } = useAuthStore();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isPasswordRecovery) {
      setMode("update-password");
      return;
    }
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router, isPasswordRecovery]);

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    if (
      (mode === "signup" || mode === "update-password") &&
      password !== confirmPassword
    ) {
      setError("Passwords do not match");
      setSubmitting(false);
      return;
    }

    if (mode === "signin") {
      const result = await signIn(email, password);
      setSubmitting(false);
      if (result.error) {
        setError(result.error);
      } else {
        router.replace("/");
      }
    } else if (mode === "signup") {
      const result = await signUp(email, password);
      setSubmitting(false);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(
          "Account created! Check your email to confirm your account."
        );
        setPassword("");
        setConfirmPassword("");
        setTimeout(() => switchMode("signin"), 3000);
      }
    } else if (mode === "update-password") {
      const result = await updatePassword(password);
      setSubmitting(false);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("Password updated successfully!");
        setPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          router.replace("/");
        }, 2000);
      }
    } else {
      const result = await resetPassword(email);
      setSubmitting(false);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("Password reset link sent! Check your email.");
        setTimeout(() => switchMode("signin"), 3000);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user && !isPasswordRecovery) return null;

  const title =
    mode === "signin"
      ? "Sign In"
      : mode === "signup"
        ? "Create Account"
        : mode === "update-password"
          ? "Set New Password"
          : "Reset Password";

  const buttonLabel =
    mode === "signin"
      ? "Sign In"
      : mode === "signup"
        ? "Create Account"
        : mode === "update-password"
          ? "Update Password"
          : "Send Reset Link";

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-foreground">MFA</h1>
          <p className="text-sm text-zinc-500">My Flight Assistant</p>
        </div>

        {/* Mode Title */}
        <h2 className="text-lg font-semibold text-foreground text-center">
          {title}
        </h2>

        {/* Success Banner */}
        {success && (
          <div className="bg-green-900/30 border border-green-800 rounded-xl p-4 text-center">
            <p className="text-sm text-green-400">{success}</p>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {mode !== "update-password" && (
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-zinc-600 outline-none focus:border-blue-600 transition-colors"
              />
            )}
            {mode !== "reset" && (
              <input
                type="password"
                placeholder={
                  mode === "update-password" ? "New Password" : "Password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-zinc-600 outline-none focus:border-blue-600 transition-colors"
              />
            )}
            {(mode === "signup" || mode === "update-password") && (
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-zinc-600 outline-none focus:border-blue-600 transition-colors"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium py-3 rounded-xl transition-colors"
          >
            {submitting ? "..." : buttonLabel}
          </button>
        </form>

        {/* Links */}
        <div className="text-center space-y-2">
          {mode === "signin" && (
            <>
              <button
                onClick={() => switchMode("reset")}
                className="block w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Forgot Password?
              </button>
              <button
                onClick={() => switchMode("signup")}
                className="block w-full text-sm text-blue-500 hover:text-blue-400 transition-colors"
              >
                Create Account
              </button>
            </>
          )}
          {(mode === "signup" || mode === "reset") && (
            <button
              onClick={() => switchMode("signin")}
              className="block w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
