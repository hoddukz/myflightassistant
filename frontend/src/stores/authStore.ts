// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/stores/authStore.ts

import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { useSettingsStore } from "@/stores/settingsStore";
import { registerSession, logoutSession, setSessionExpiredHandler } from "@/lib/api";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  session: null,
  loading: true,
  isPasswordRecovery: false,

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };
    set({ user: data.user, session: data.session });

    // 로그인 성공 후 세션 등록
    try {
      await registerSession();
    } catch {
      // 세션 등록 실패해도 로그인은 유지
    }

    return { error: null };
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) return { error: error.message };
    if (data.user && data.user.identities?.length === 0) {
      return { error: "This email is already registered" };
    }
    return { error: null };
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) return { error: error.message };
    set({ isPasswordRecovery: false });
    return { error: null };
  },

  signOut: async () => {
    // 세션 삭제 후 Supabase signOut
    try {
      await logoutSession();
    } catch {
      // 세션 삭제 실패해도 로그아웃 진행
    }
    await supabase.auth.signOut();
    set({ user: null, session: null });
    useSettingsStore.getState().setDisclaimerAccepted(false);
  },

  initialize: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // 기존 세션이 있으면 세션 등록 (타임아웃 3초, 실패해도 진행)
    if (session?.user) {
      try {
        await Promise.race([
          registerSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
        ]);
      } catch {
        // 타임아웃 또는 실패 시 무시 — 로딩은 계속 진행
      }
    }

    set({ user: session?.user ?? null, session, loading: false });

    // session_expired 시 자동 로그아웃 핸들러 등록
    setSessionExpiredHandler(() => {
      const { signOut } = get();
      signOut();
    });

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        set({ user: session?.user ?? null, session, isPasswordRecovery: true });
        return;
      }
      set({ user: session?.user ?? null, session });
    });
  },
}));
