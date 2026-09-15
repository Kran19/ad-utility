'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUserProfile } from '@ad-utility/shared';
import { getClientApiUrl } from '../lib/site-config';

export interface SavedCredentials {
  email: string;
  password?: string;
  rememberMe: boolean;
  savedAt: string;
}

export interface AuthModalConfig {
  title?: string;
  message?: string;
  initialTab?: 'login' | 'signup';
  onSuccess?: () => void;
}

interface UserAuthContextType {
  user: AuthUserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalConfig: AuthModalConfig | null;
  savedCredentials: SavedCredentials | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; message?: string }>;
  register: (data: { email: string; password: string; name?: string; termsAccepted?: boolean }) => Promise<{ success: boolean; message?: string; alreadyExists?: boolean }>;
  logout: () => Promise<void>;
  openAuthModal: (config?: AuthModalConfig) => void;
  closeAuthModal: () => void;
  requireAuth: (actionCallback?: () => void, message?: string) => boolean;
}

const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

const CREDENTIALS_KEY = 'utility_user_credentials';
const USER_PROFILE_KEY = 'utility_user_profile';

export function UserAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalConfig, setAuthModalConfig] = useState<AuthModalConfig | null>(null);
  const [savedCredentials, setSavedCredentials] = useState<SavedCredentials | null>(null);

  // Load saved credentials and attempt session restoration / auto-login on mount
  useEffect(() => {
    async function initAuth() {
      // 1. Read cached profile and saved credentials from localStorage
      let storedCreds: SavedCredentials | null = null;
      try {
        const rawCreds = localStorage.getItem(CREDENTIALS_KEY);
        if (rawCreds) {
          storedCreds = JSON.parse(rawCreds);
          setSavedCredentials(storedCreds);
        }
        const rawProfile = localStorage.getItem(USER_PROFILE_KEY);
        if (rawProfile) {
          const cachedUser = JSON.parse(rawProfile);
          if (cachedUser && cachedUser.id) {
            setUser(cachedUser);
          }
        }
      } catch (e) {
        // ignore parse error
      }

      // 2. Validate current session via /auth/me
      try {
        const apiUrl = getClientApiUrl();
        const res = await fetch(`${apiUrl}/auth/me`, {
          credentials: 'include',
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setUser(json.data);
            try {
              localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(json.data));
            } catch (e) {}
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        // network issue or unauthenticated
      }

      // 3. If session cookie expired but user has saved credentials in localhost, auto-login seamlessly!
      if (storedCreds && storedCreds.email && storedCreds.password && storedCreds.rememberMe) {
        try {
          const apiUrl = getClientApiUrl();
          const autoRes = await fetch(`${apiUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              email: storedCreds.email.toLowerCase().trim(),
              password: storedCreds.password,
            }),
          });

          if (autoRes.ok) {
            const autoJson = await autoRes.json();
            if (autoJson.success && autoJson.data && autoJson.data.user) {
              setUser(autoJson.data.user);
              try {
                localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(autoJson.data.user));
              } catch (e) {}
            }
          }
        } catch (e) {
          // silent fallback
        }
      }

      setIsLoading(false);
    }

    initAuth();
  }, []);

  const login = useCallback(
    async (email: string, password: string, rememberMe = true) => {
      setIsLoading(true);
      const cleanEmail = email.toLowerCase().trim();

      try {
        const apiUrl = getClientApiUrl();
        const res = await fetch(`${apiUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: cleanEmail, password }),
        });

        const json = await res.json();

        if (res.ok && json.success && json.data) {
          const loggedUser = json.data.user;
          setUser(loggedUser);

          // Save credentials in localhost so user never needs to login again!
          const credsToSave: SavedCredentials = {
            email: cleanEmail,
            password: rememberMe ? password : '',
            rememberMe,
            savedAt: new Date().toISOString(),
          };

          try {
            localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credsToSave));
            localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(loggedUser));
            setSavedCredentials(credsToSave);
          } catch (e) {}

          setIsLoading(false);
          return { success: true };
        } else {
          setIsLoading(false);
          let msg = json.message || 'The email or password you entered is incorrect.';
          if (res.status === 401) {
            msg = 'Incorrect email or password.';
          } else if (res.status === 403) {
            msg = 'Account is deactivated. Please contact support.';
          }
          return { success: false, message: msg };
        }
      } catch (err) {
        setIsLoading(false);
        return { success: false, message: 'Could not connect to authentication server. Please try again.' };
      }
    },
    [],
  );

  const register = useCallback(
    async (data: { email: string; password: string; name?: string; termsAccepted?: boolean }) => {
      setIsLoading(true);
      const cleanEmail = data.email.toLowerCase().trim();

      try {
        const apiUrl = getClientApiUrl();
        const res = await fetch(`${apiUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: cleanEmail,
            password: data.password,
            name: data.name?.trim() || undefined,
            termsAccepted: data.termsAccepted ?? true,
          }),
        });

        const json = await res.json();

        if (res.ok && json.success && json.data) {
          const newUser = json.data.user;
          setUser(newUser);

          // Save credentials in localhost so new user stays permanently logged in!
          const credsToSave: SavedCredentials = {
            email: cleanEmail,
            password: data.password,
            rememberMe: true,
            savedAt: new Date().toISOString(),
          };

          try {
            localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credsToSave));
            localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(newUser));
            setSavedCredentials(credsToSave);
          } catch (e) {}

          setIsLoading(false);
          return { success: true };
        } else {
          setIsLoading(false);
          const isConflict = res.status === 409 || (json.message && json.message.toLowerCase().includes('already registered'));
          return {
            success: false,
            alreadyExists: isConflict,
            message: isConflict
              ? 'An account with this email already exists. You can sign in directly.'
              : json.message || 'Unable to create account. Please check your information.',
          };
        }
      } catch (err) {
        setIsLoading(false);
        return { success: false, message: 'Connection error. Please try again.' };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      const apiUrl = getClientApiUrl();
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {}

    setUser(null);
    try {
      localStorage.removeItem(USER_PROFILE_KEY);
      // If user had saved credentials, keep remember flag or clear password on explicit logout
      const currentCreds = localStorage.getItem(CREDENTIALS_KEY);
      if (currentCreds) {
        const parsed = JSON.parse(currentCreds);
        localStorage.setItem(
          CREDENTIALS_KEY,
          JSON.stringify({
            ...parsed,
            password: '', // clear password on explicit manual logout for safety
          }),
        );
      }
    } catch (e) {}
  }, []);

  const openAuthModal = useCallback((config?: AuthModalConfig) => {
    setAuthModalConfig(config || {});
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setAuthModalConfig(null);
  }, []);

  const requireAuth = useCallback(
    (actionCallback?: () => void, message?: string): boolean => {
      if (user) {
        if (actionCallback) actionCallback();
        return true;
      }

      openAuthModal({
        message: message || 'Please sign in or create a free account to use this tool and process files.',
        initialTab: savedCredentials?.email ? 'login' : 'signup',
        onSuccess: actionCallback,
      });
      return false;
    },
    [user, savedCredentials, openAuthModal],
  );

  return (
    <UserAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAuthModalOpen,
        authModalConfig,
        savedCredentials,
        login,
        register,
        logout,
        openAuthModal,
        closeAuthModal,
        requireAuth,
      }}
    >
      {children}
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error('useUserAuth must be used within a UserAuthProvider');
  }
  return context;
}
