import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AppSettings, SettingsPatch, ValidationIssue } from "@suivi/shared";
import { api, fetchSettings, queryClient, SETTINGS_KEY, signedOut } from "../../app/api.js";
import { ApiError, type ApiFailure, type ApiResult } from "../../lib/api.js";
import { apiErrorMessage, FIELD_LABELS, issuesByField } from "../../lib/messages.js";
import styles from "../../ui/ui.module.css";

// Réglages: the allowlisted settings only (docs/decisions.md P1.4); openingDate is read-only (P1.5 Q10).
const EDITABLE = ["savingsTargetPercent", "budgetRolloverDay", "cashTolerance", "potBudgetTolerance"] as const;
type Editable = (typeof EDITABLE)[number];
type Draft = Record<Editable, string>;

function toDraft(settings: AppSettings): Draft {
  return {
    savingsTargetPercent: String(settings.savingsTargetPercent),
    budgetRolloverDay: String(settings.budgetRolloverDay),
    cashTolerance: String(settings.cashTolerance),
    potBudgetTolerance: String(settings.potBudgetTolerance),
  };
}

// Non-integers are sent as text so the server answers with its own field issue.
function toPatch(draft: Draft): Record<Editable, number | string> {
  const patch = {} as Record<Editable, number | string>;
  for (const name of EDITABLE) {
    const text = draft[name].trim();
    patch[name] = /^\d+$/.test(text) ? Number(text) : text;
  }
  return patch;
}

export function SettingsScreen() {
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchSettings });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings.data !== undefined && draft === null) setDraft(toDraft(settings.data));
  }, [settings.data, draft]);

  const save = useMutation({
    mutationFn: (patch: SettingsPatch | Record<Editable, number | string>): Promise<ApiResult<AppSettings>> =>
      api.send<AppSettings>("PATCH", "/api/settings", patch),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData(SETTINGS_KEY, result.data);
        setDraft(toDraft(result.data));
        setSaved(true);
      } else if (result.failure.kind === "validation") {
        setIssues(result.failure.issues);
      } else {
        setFailure(result.failure);
      }
    },
  });

  const logout = useMutation({
    mutationFn: () => api.send<null>("POST", "/api/auth/logout"),
    // Signed out locally whatever the answer: the session is gone or unusable.
    onSettled: () => signedOut(),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (draft === null || save.isPending) return;
    setIssues([]);
    setFailure(null);
    setSaved(false);
    save.mutate(toPatch(draft));
  };

  const errors = issuesByField(issues, [...EDITABLE]);

  return (
    <section aria-labelledby="settings-title">
      <h1 id="settings-title" className={styles.title}>
        Réglages
      </h1>
      {settings.isError ? (
        <div className={styles.bannerDanger} role="alert">
          <span>
            {apiErrorMessage(
              settings.error instanceof ApiError && settings.error.failure.kind === "error" ? settings.error.failure.code : "network",
            )}
          </span>
          <button type="button" className={styles.button} onClick={() => void settings.refetch()}>
            Réessayer
          </button>
        </div>
      ) : draft === null || settings.data === undefined ? (
        <div aria-busy="true">
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ) : (
        <form className={`${styles.card} ${styles.stack}`} onSubmit={submit} noValidate>
          {saved && (
            <div className={styles.bannerInfo} role="status">
              Réglages enregistrés.
            </div>
          )}
          {failure !== null && (
            <div className={styles.bannerDanger} role="alert">
              {apiErrorMessage(failure.kind === "error" ? failure.code : "invalid_request")}
            </div>
          )}
          {(errors.form ?? []).length > 0 && (
            <div className={styles.bannerDanger} role="alert">
              {(errors.form ?? []).join(" ")}
            </div>
          )}
          {EDITABLE.map((name) => (
            <label key={name} className={styles.field}>
              <span className={styles.label}>{FIELD_LABELS[name]}</span>
              <input
                className={styles.input}
                inputMode="numeric"
                value={draft[name]}
                onChange={(event) => setDraft({ ...draft, [name]: event.target.value })}
              />
              {(errors[name] ?? []).map((message) => (
                <span key={message} className={styles.fieldError}>
                  {message}
                </span>
              ))}
            </label>
          ))}
          <div className={styles.field}>
            <span className={styles.label}>{FIELD_LABELS.openingDate}</span>
            <span>{settings.data.openingDate ?? "Non définie"}</span>
          </div>
          <button type="submit" className={styles.primary} disabled={save.isPending}>
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      )}
      <div className={`${styles.card} ${styles.spacedTop}`}>
        <button type="button" className={styles.button} onClick={() => logout.mutate()} disabled={logout.isPending}>
          Se déconnecter
        </button>
      </div>
    </section>
  );
}
