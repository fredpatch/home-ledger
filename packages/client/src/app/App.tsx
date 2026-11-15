import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoginScreen } from "../features/auth/LoginScreen.js";
import { OperationsScreen } from "../features/operations/OperationsScreen.js";
import { SettingsScreen } from "../features/settings/SettingsScreen.js";
import { ApiError } from "../lib/api.js";
import { apiErrorMessage } from "../lib/messages.js";
import styles from "../ui/ui.module.css";
import { fetchSession, SESSION_KEY } from "./api.js";
import { useHashRoute } from "./useHashRoute.js";

export function App() {
  const session = useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession });

  if (session.isPending) {
    return (
      <div className={styles.center}>
        <p className={styles.muted}>Chargement…</p>
      </div>
    );
  }
  if (session.isError) {
    const code = session.error instanceof ApiError && session.error.failure.kind === "error" ? session.error.failure.code : "network";
    return (
      <div className={styles.center}>
        <div className={styles.bannerDanger} role="alert">
          <span>{apiErrorMessage(code)}</span>
          <button type="button" className={styles.button} onClick={() => void session.refetch()}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }
  return session.data === null ? <LoginScreen /> : <Shell />;
}

// Phone: bottom bar Opérations · + · Réglages. Desktop: sidebar. Undelivered sections stay hidden (docs/app-flow.md).
function Shell() {
  const [route, navigate] = useHashRoute();
  const [creating, setCreating] = useState(false);

  const openCreate = () => {
    navigate("operations");
    setCreating(true);
  };

  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Navigation principale">
        <button
          type="button"
          className={route === "operations" ? styles.navItemActive : styles.navItem}
          aria-current={route === "operations" ? "page" : undefined}
          onClick={() => navigate("operations")}
        >
          Opérations
        </button>
        <button type="button" className={styles.navAdd} aria-label="Ajouter une opération" onClick={openCreate}>
          +
        </button>
        <button
          type="button"
          className={route === "reglages" ? styles.navItemActive : styles.navItem}
          aria-current={route === "reglages" ? "page" : undefined}
          onClick={() => navigate("reglages")}
        >
          Réglages
        </button>
      </nav>
      <main className={styles.main}>
        {route === "operations" ? (
          <OperationsScreen creating={creating} onCreateClosed={() => setCreating(false)} onAdd={openCreate} />
        ) : (
          <SettingsScreen />
        )}
      </main>
    </div>
  );
}
