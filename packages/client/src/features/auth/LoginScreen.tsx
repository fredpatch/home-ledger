import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import type { LoginRequest, SessionInfo } from "@suivi/shared";
import { api, signedIn } from "../../app/api.js";
import type { ApiResult } from "../../lib/api.js";
import { apiErrorMessage } from "../../lib/messages.js";
import styles from "../../ui/ui.module.css";

// docs/app-flow.md F1. P1.6 plan Q7: "Rester connecté" chooses the long (phone) session; checked by default on small screens.
function defaultLongSession(): boolean {
  return window.matchMedia("(max-width: 1023px)").matches;
}

export function LoginScreen() {
  const [password, setPassword] = useState("");
  const [longSession, setLongSession] = useState(defaultLongSession);
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: (request: LoginRequest): Promise<ApiResult<SessionInfo>> => api.send<SessionInfo>("POST", "/api/auth/login", request),
    onSuccess: (result) => {
      if (result.ok) {
        signedIn(result.data);
        return;
      }
      setPassword("");
      setError(apiErrorMessage(result.failure.kind === "error" ? result.failure.code : "invalid_request"));
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password === "" || login.isPending) return;
    setError(null);
    login.mutate({ password, longSession });
  };

  return (
    <div className={styles.center}>
      <form className={`${styles.card} ${styles.narrow} ${styles.stack}`} onSubmit={submit} noValidate>
        <h1 className={styles.title}>Suivi financier</h1>
        {error !== null && (
          <div className={styles.bannerDanger} role="alert">
            {error}
          </div>
        )}
        <label className={styles.field}>
          <span className={styles.label}>Mot de passe</span>
          <input
            className={styles.input}
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label className={styles.row}>
          <input type="checkbox" checked={longSession} onChange={(event) => setLongSession(event.target.checked)} />
          <span>Rester connecté</span>
        </label>
        <button type="submit" className={styles.primary} disabled={password === "" || login.isPending}>
          {login.isPending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
