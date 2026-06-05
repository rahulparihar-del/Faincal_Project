"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

/**
 * ⚠️ CLIENT-SIDE GATE ONLY.
 * This keeps the UI behind a login, but it is NOT real data security:
 * the credentials and the Supabase publishable key both ship in the browser
 * bundle, so a determined person can still read the database directly.
 * For real protection, move to Supabase Auth and restrict RLS to
 * `authenticated` users (see README / the note from setup).
 */
const AUTH_KEY = "biztrack_auth";
const VALID_EMAIL = "kiddieka.store";
const VALID_PASSWORD = "Rahul@2001";

interface AuthContextType {
  isAuthed: boolean;
  ready: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setIsAuthed(window.localStorage.getItem(AUTH_KEY) === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const login = useCallback((email: string, password: string) => {
    const ok = email.trim().toLowerCase() === VALID_EMAIL && password === VALID_PASSWORD;
    if (ok) {
      try { window.localStorage.setItem(AUTH_KEY, "1"); } catch { /* ignore */ }
      setIsAuthed(true);
    }
    return ok;
  }, []);

  const logout = useCallback(() => {
    try { window.localStorage.removeItem(AUTH_KEY); } catch { /* ignore */ }
    setIsAuthed(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthed, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
