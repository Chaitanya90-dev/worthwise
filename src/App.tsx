import { Suspense, type ElementType, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import {
  APP_PAGE_ROUTES,
  LANDING_ROUTE,
  LOGIN_ROUTE,
  PUBLIC_NOT_FOUND_ROUTE,
} from "./app/routes";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { setSession, setStatus } from "./features/auth/authSlice";
import { seedDefaults } from "./lib/seedDefaults";
import { supabase } from "./lib/supabaseClient";
import { AppMonthProvider } from "./context/AppMonthContext";
import { useOfflineTransactionQueueSync } from "./hooks/useOfflineTransactionQueueSync";
import { APP_BASE_PATH } from "./app/paths";
import { MoneyConfigSync } from "./components/settings/MoneyConfigSync";

const RouteLoadingFallback = () => (
  <div
    style={{
      padding: "2rem",
      color: "var(--text-muted)",
      fontSize: "0.95rem",
    }}
  >
    Loading...
  </div>
);

const SuspendedRoute = ({ component: Component }: { component: ElementType }) => (
  <Suspense fallback={<RouteLoadingFallback />}>
    <Component />
  </Suspense>
);

const App = () => {
  const dispatch = useAppDispatch();
  const authStatus = useAppSelector((state) => state.auth.status);
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);

  useOfflineTransactionQueueSync();

  useEffect(() => {
    dispatch(setStatus("loading"));

    supabase.auth
      .getSession()
      .then(({ data }) => {
        dispatch(setSession(data.session));
      })
      .catch(() => {
        dispatch(setSession(null));
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        dispatch(setSession(session));
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [dispatch]);

  useEffect(() => {
    if (authStatus === "authed" && userId) {
      seedDefaults();
    }
  }, [authStatus, userId]);

  return (
    <>
      <MoneyConfigSync />
      <Routes>
        <Route
          path={LANDING_ROUTE.path}
          element={<SuspendedRoute component={LANDING_ROUTE.Component} />}
        />
        <Route
          path={LOGIN_ROUTE.path}
          element={<SuspendedRoute component={LOGIN_ROUTE.Component} />}
        />
        <Route
          path={APP_BASE_PATH}
          element={
            <ProtectedRoute>
              <AppMonthProvider>
                <AppLayout />
              </AppMonthProvider>
            </ProtectedRoute>
          }
        >
          {APP_PAGE_ROUTES.map(({ key, path, Component }) =>
            path === "" ? (
              <Route
                key={key}
                index
                element={<SuspendedRoute component={Component} />}
              />
            ) : (
              <Route
                key={key}
                path={path}
                element={<SuspendedRoute component={Component} />}
              />
            )
          )}
        </Route>
        <Route
          path={PUBLIC_NOT_FOUND_ROUTE.path}
          element={<SuspendedRoute component={PUBLIC_NOT_FOUND_ROUTE.Component} />}
        />
      </Routes>
    </>
  );
};

export default App;
