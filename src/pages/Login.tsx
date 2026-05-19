import {
  Alert,
  Button,
  Group,
  PasswordInput,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { APP_BASE_PATH, PUBLIC_HOME_PATH } from "../app/paths";
import { setStatus } from "../features/auth/authSlice";
import { normalizeDemoLoginError, requestDemoSession } from "../lib/demoLogin";
import { supabase } from "../lib/supabaseClient";

export const Login = () => {
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const demoRequested = searchParams.get("demo") === "1";
  const [mode, setMode] = useState<"signin" | "signup">(requestedMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const authStatus = useAppSelector((state) => state.auth.status);
  const demoAttempted = useRef(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const passwordAutoComplete =
    mode === "signin" ? "current-password" : "new-password";
  const passwordMinLength = mode === "signup" ? 8 : undefined;
  const emailRedirectTo = globalThis.location?.origin;

  useEffect(() => {
    setMode(requestedMode);
  }, [requestedMode]);

  useEffect(() => {
    if (authStatus === "authed") {
      navigate(APP_BASE_PATH, { replace: true });
    }
  }, [authStatus, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    dispatch(setStatus("loading"));

    const action =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: emailRedirectTo ? { emailRedirectTo } : undefined,
          });

    const { error: authError } = await action;

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    navigate(APP_BASE_PATH);
  };

  const handleDemoLogin = async () => {
    setError(null);
    setDemoLoading(true);
    dispatch(setStatus("loading"));

    try {
      const session = await requestDemoSession();
      const { error: authError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (authError) {
        setError(authError.message);
        setDemoLoading(false);
        return;
      }

      setDemoLoading(false);
      navigate(APP_BASE_PATH);
    } catch (demoError) {
      setError(normalizeDemoLoginError(demoError));
      setDemoLoading(false);
    }
  };

  useEffect(() => {
    if (!demoRequested || demoAttempted.current || authStatus !== "unauth") {
      return;
    }

    demoAttempted.current = true;
    void handleDemoLogin();
  }, [authStatus, demoRequested]);

  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <div className="auth-hero">
          <Group justify="space-between" align="center" mb="xl">
            <Button
              component={Link}
              to={PUBLIC_HOME_PATH}
              variant="subtle"
              color="gray"
              size="compact-sm"
            >
              Back to home
            </Button>
            <Text size="xs" c="white" opacity={0.72} fw={600} tt="uppercase">
              Public preview available
            </Text>
          </Group>
          <div className="hero-badge">CashCove</div>
          <Title order={2} c="white" fw={700} lh={1.2}>
            Your finances, distilled.
          </Title>
          <Text c="white" opacity={0.86}>
            Budgets, cashflow, bills, and goals in a clean cockpit you can trust.
          </Text>
          <div className="auth-pillars">
            <div>
              <span>Budgets</span>
              <strong>Soft caps & alerts</strong>
            </div>
            <div>
              <span>Cashflow</span>
              <strong>Imports + tags</strong>
            </div>
            <div>
              <span>Funds</span>
              <strong>Car, land, emergency</strong>
            </div>
          </div>
        </div>
      </div>
      <div className="auth-panel">
        <Paper radius="xl" p="xl" shadow="md" withBorder>
          <Stack gap="xs">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Welcome back
            </Text>
            <Title order={2}>CashCove</Title>
            <Text size="sm" c="dimmed">
              Sign in or create your account to start tracking.
            </Text>
          </Stack>
          <form onSubmit={handleSubmit} autoComplete="on">
            <Stack gap="sm" mt="md">
              <TextInput
                id="email"
                name="email"
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                aria-invalid={Boolean(error)}
                required
              />
              <PasswordInput
                id="password"
                name="password"
                label="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  mode === "signup" ? "Minimum 8 characters" : "Your password"
                }
                autoComplete={passwordAutoComplete}
                minLength={passwordMinLength}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "auth-error" : undefined}
                required
              />
              {error ? (
                <Alert color="red" variant="light" id="auth-error" role="alert">
                  {error}
                </Alert>
              ) : null}
              <Button type="submit" loading={loading} fullWidth>
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
              <Button
                type="button"
                variant="light"
                color="orange"
                onClick={handleDemoLogin}
                loading={demoLoading}
                fullWidth
              >
                Try the demo
              </Button>
              <Text size="xs" c="dimmed" ta="center">
                Opens the read-only demo account without exposing demo credentials in the app.
              </Text>
            </Stack>
          </form>
          <Button
            type="button"
            variant="subtle"
            color="blue"
            onClick={() =>
              setMode((current) => (current === "signin" ? "signup" : "signin"))
            }
            fullWidth
            mt="sm"
          >
            {mode === "signin"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </Button>
        </Paper>
      </div>
    </div>
  );
};
