import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { OperationDto, OperationListResponse, PotWarning } from "@suivi/shared";
import { api, fetchReference, fetchSettings, OPERATIONS_KEY, REFERENCE_KEY, SETTINGS_KEY } from "../../app/api.js";
import { ApiError, unwrap } from "../../lib/api.js";
import { formatListDate, formatMonth, shiftMonth, signedAmount, todayIso } from "../../lib/format.js";
import { apiErrorMessage, potWarningMessage } from "../../lib/messages.js";
import styles from "../../ui/ui.module.css";
import { OperationSheet } from "./OperationSheet.js";

interface Props {
  readonly creating: boolean;
  readonly onCreateClosed: () => void;
  readonly onAdd: () => void;
}

function errorText(error: unknown): string {
  return apiErrorMessage(error instanceof ApiError && error.failure.kind === "error" ? error.failure.code : "network");
}

// Accueil (basic) + F4 subset: operations of a budget month, newest first (docs/app-flow.md).
export function OperationsScreen({ creating, onCreateClosed, onAdd }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(() => todayIso(now).slice(0, 7));
  const [editing, setEditing] = useState<OperationDto | null>(null);
  const [warnings, setWarnings] = useState<readonly PotWarning[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const operations = useQuery({
    queryKey: [...OPERATIONS_KEY, month],
    queryFn: async () => unwrap(await api.get<OperationListResponse>(`/api/operations?month=${month}&limit=500`)).items,
  });
  const reference = useQuery({ queryKey: REFERENCE_KEY, queryFn: fetchReference });
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchSettings });

  const categoryName = (id: number) => reference.data?.categories.find((c) => c.id === id)?.name ?? "Catégorie inactive";

  const closeSheet = () => {
    setEditing(null);
    onCreateClosed();
  };

  const saved = (message: string, newWarnings: readonly PotWarning[]) => {
    setNotice(message);
    setWarnings(newWarnings);
    closeSheet();
  };

  const items = operations.data;
  const sheetOpen = creating || editing !== null;
  const loadError = operations.error ?? reference.error ?? settings.error;

  return (
    <section aria-labelledby="operations-title">
      <div className={styles.spaceBetween}>
        <h1 id="operations-title" className={styles.title}>
          Opérations
        </h1>
        <div className={styles.row}>
          <button type="button" className={styles.button} aria-label="Mois précédent" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <span className={styles.amount}>{formatMonth(month)}</span>
          <button type="button" className={styles.button} aria-label="Mois suivant" onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </button>
        </div>
      </div>

      {notice !== null && (
        <div className={styles.bannerInfo} role="status">
          <span>{notice}</span>
          <button type="button" className={styles.button} onClick={() => setNotice(null)}>
            Fermer
          </button>
        </div>
      )}
      {warnings.map((warning) => (
        <div key={warning.budgetMonth} className={styles.bannerWarning} role="status">
          <span>{potWarningMessage(warning)}</span>
          <button type="button" className={styles.button} onClick={() => setWarnings(warnings.filter((w) => w !== warning))}>
            Fermer
          </button>
        </div>
      ))}

      {loadError !== null ? (
        <div className={styles.bannerDanger} role="alert">
          <span>{errorText(loadError)}</span>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              void operations.refetch();
              void reference.refetch();
              void settings.refetch();
            }}
          >
            Réessayer
          </button>
        </div>
      ) : items === undefined || reference.isPending ? (
        <div aria-busy="true">
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ) : items.length === 0 ? (
        <div className={`${styles.card} ${styles.stack}`}>
          <p>Aucune opération ce mois-ci.</p>
          <button type="button" className={styles.primary} onClick={onAdd}>
            Ajouter une opération
          </button>
        </div>
      ) : (
        <ul className={styles.list}>
          {items.map((operation) => {
            const amount = signedAmount(operation.class, operation.amount, operation.destAccountId !== null);
            const category = categoryName(operation.categoryId);
            return (
              <li key={operation.id}>
                <button type="button" className={styles.listRow} onClick={() => setEditing(operation)}>
                  <span className={styles.muted}>{formatListDate(operation.date, now.getFullYear())}</span>
                  <span>
                    <span>{operation.label ?? category}</span>
                    <br />
                    <span className={styles.muted}>{category}</span>
                  </span>
                  <span className={`${styles.amount} ${styles[amount.tone]}`}>
                    {amount.text}
                    {operation.class === "transfer" ? " ⇄" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {sheetOpen && reference.data !== undefined && settings.data !== undefined && (
        <OperationSheet
          operation={editing}
          reference={reference.data}
          settings={settings.data}
          onClose={closeSheet}
          onSaved={saved}
        />
      )}
    </section>
  );
}
