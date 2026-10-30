import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { authApi, impersonationApi, setAuthToken } from "../services/api";
import type {
  AuthResponse,
  ResetPasswordPayload,
  SignInPayload,
  SignUpPayload,
  SignUpResponse,
  SocialSignInInput,
  User,
} from "../types/authentication";
import type { SocialProvider } from "../types/api";
import type { ImpersonationResponse } from "../types/user";
import { errorStatus } from "../utils/errors";

interface AuthContextValue {
  user: User | null;
  realUser: User | null;
  token: string | null;
  session: { token: string } | null;
  isAuthenticated: boolean;
  isImpersonating: boolean;
  loading: boolean;
  signIn: (payload: SignInPayload) => Promise<User>;
  /**
   * Returns the signed-in `User`, or the whole `SignUpResponse` when the
   * backend created the account but issued no session pending email
   * verification — `Login` inspects `email_verification` to show the
   * "check your inbox" banner.
   */
  signUp: (payload: SignUpPayload) => Promise<User | SignUpResponse>;
  socialSignIn: (
    provider: SocialProvider,
    payload?: SocialSignInInput,
  ) => Promise<User>;
  resetPassword: (payload: ResetPasswordPayload) => Promise<unknown>;
  refreshSession: () => Promise<User | null>;
  signOut: () => Promise<void>;
  startImpersonation: (userId: number) => Promise<ImpersonationResponse>;
  stopImpersonation: () => Promise<ImpersonationResponse>;
  refreshImpersonationStatus: () => Promise<
    ImpersonationResponse | { impersonating: boolean }
  >;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_TOKEN_KEY = "wine_words_token";

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(readStoredToken()));
  const [realUser, setRealUser] = useState<User | null>(null);

  // Restore the session on mount when a token is stored.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const result = await authApi.me();
        if (!cancelled) setUser(result.user ?? null);
        // If the token carries an impersonation claim, restore realUser too.
        if (!cancelled) {
          try {
            const status = await impersonationApi.status();
            if (status.impersonating && status.real_user) {
              setRealUser(status.real_user);
            }
          } catch {
            // Ignore — impersonation status is best-effort on restore.
          }
        }
      } catch (error) {
        // Only discard the stored token when the API explicitly says it is
        // invalid (401). A 500 / network / DB failure is transient — wiping it
        // here silently signs the admin out and strips the Authorization header
        // from the API-health checks even though the session is still valid.
        if (errorStatus(error) === 401) {
          window.localStorage.removeItem(STORAGE_TOKEN_KEY);
          setToken(null);
        }
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (token) {
      restore();
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistToken = useCallback((nextToken: string | null): void => {
    setToken(nextToken);
    if (nextToken) {
      window.localStorage.setItem(STORAGE_TOKEN_KEY, nextToken);
    } else {
      window.localStorage.removeItem(STORAGE_TOKEN_KEY);
    }
    setAuthToken(nextToken);
  }, []);

  const signIn = useCallback(
    async ({ email, password }: SignInPayload): Promise<User> => {
      const result = await authApi.signIn({ email, password });
      const nextToken = extractToken(result);
      persistToken(nextToken);
      setUser(result.user ?? null);
      return result.user;
    },
    [persistToken],
  );

  const signUp = useCallback(
    async ({
      email,
      password,
      password_confirmation,
      first_name,
      last_name,
    }: SignUpPayload): Promise<User | SignUpResponse> => {
      const result = await authApi.signUp({
        email,
        password,
        password_confirmation,
        first_name,
        last_name,
      });
      // Email verification required: the backend created the account but
      // issued NO session. Do not set auth state - Login shows the
      // "check your inbox" banner using the full result returned here.
      if (isEmailVerificationPending(result)) return result;
      const nextToken = extractToken(result);
      persistToken(nextToken);
      setUser(result.user ?? null);
      return result.user;
    },
    [persistToken],
  );

  const resetPassword = useCallback(
    async ({
      reset_password_token,
      password,
      password_confirmation,
    }: ResetPasswordPayload): Promise<unknown> => {
      const result = await authApi.resetPassword({
        reset_password_token,
        password,
        password_confirmation,
      });
      const nextToken = extractToken(result);
      persistToken(nextToken);
      setUser(result.user ?? null);
      return result.user;
    },
    [persistToken],
  );

  // Social sign-in (Google/Apple/Microsoft/Facebook).
  //
  // The provider SDK hands back a credential in the browser; the API verifies
  // it with the provider and returns the same { user: {...} } payload plus the
  // same JWT as email/password sign-in. Nothing else in the app needs to know
  // which method was used.
  const socialSignIn = useCallback(
    async (
      provider: SocialProvider,
      { credential, nonce }: SocialSignInInput = { credential: "" },
    ): Promise<User> => {
      const result = await authApi.socialSignIn(provider, {
        credential,
        nonce,
      });
      const nextToken = extractToken(result);
      persistToken(nextToken);
      setUser(result.user ?? null);
      return result.user;
    },
    [persistToken],
  );

  const refreshSession = useCallback(async () => {
    try {
      const result = await authApi.me();
      setUser(result.user ?? null);
      return result.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.signOut();
    } catch {
      // Ignore network errors on sign out; clear locally regardless.
    }
    persistToken(null);
    setUser(null);
    setRealUser(null);
  }, [persistToken]);

  // Start impersonating a user. Persists the new token (with the
  // impersonated_user_id claim) and updates user/realUser state.
  const startImpersonation = useCallback(
    async (userId: number): Promise<ImpersonationResponse> => {
      const result = await impersonationApi.start(userId);
      const nextToken = extractToken(result);
      if (nextToken) persistToken(nextToken);
      setUser(result.effective_user ?? null);
      setRealUser(result.real_user ?? null);
      return result;
    },
    [persistToken],
  );

  // Stop impersonating. Persists the fresh token (without the claim) and
  // restores the admin user.
  const stopImpersonation = useCallback(async () => {
    const result = await impersonationApi.stop();
    const nextToken = extractToken(result);
    if (nextToken) persistToken(nextToken);
    setUser(result.effective_user ?? null);
    setRealUser(null);
    return result;
  }, [persistToken]);

  // Check impersonation status (e.g., on mount or after token refresh).
  const refreshImpersonationStatus = useCallback(async () => {
    try {
      const result = await impersonationApi.status();
      if (result.impersonating) {
        setRealUser(result.real_user ?? null);
      } else {
        setRealUser(null);
      }
      return result;
    } catch {
      setRealUser(null);
      return { impersonating: false };
    }
  }, []);

  const isImpersonating = Boolean(realUser);

  const value = useMemo(
    () => ({
      user,
      realUser,
      token,
      session: token ? { token } : null,
      isAuthenticated: Boolean(token),
      isImpersonating,
      loading,
      signIn,
      signUp,
      socialSignIn,
      resetPassword,
      refreshSession,
      signOut,
      startImpersonation,
      stopImpersonation,
      refreshImpersonationStatus,
    }),
    [
      user,
      realUser,
      token,
      isImpersonating,
      loading,
      signIn,
      signUp,
      socialSignIn,
      resetPassword,
      refreshSession,
      signOut,
      startImpersonation,
      stopImpersonation,
      refreshImpersonationStatus,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * True when the API created the account but withheld the session pending email
 * verification. Typed rather than probing `unknown` — the response shape is
 * `SignUpResponse`, and `email_verification_pending` is the documented flag.
 */
function isEmailVerificationPending(response: SignUpResponse): boolean {
  return response.email_verification?.email_verification_pending === true;
}

function extractToken(
  response: AuthResponse | ImpersonationResponse,
): string | null {
  return response.token ?? null;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
