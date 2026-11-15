import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  OPERATION_CLASSES,
  type AppSettings,
  type Id,
  type OperationDeleteResponse,
  type OperationDto,
  type OperationWriteResponse,
  type PotWarning,
  type ReferenceData,
  type ValidationIssue,
} from "@suivi/shared";
import { api, OPERATIONS_KEY, queryClient, REFERENCE_KEY } from "../../app/api.js";
import type { ApiFailure, ApiResult } from "../../lib/api.js";
import { formatAmount, parseAmountInput, todayIso } from "../../lib/format.js";
import { apiErrorMessage, CLASS_LABELS, FIELD_LABELS, issuesByField } from "../../lib/messages.js";
import {
  buildCreateRequest,
  buildUpdateRequest,
  derivedLine,
  emptyForm,
  formFromOperation,
  shownFieldNames,
  visibleFields,
  withCategory,
  type OperationFormState,
} from "../../lib/operation-form.js";
import styles from "../../ui/ui.module.css";

interface Props {
  /** null = new operation. */
  readonly operation: OperationDto | null;
  readonly reference: ReferenceData;
  readonly settings: AppSettings;
  readonly onClose: () => void;
  readonly onSaved: (message: string, warnings: readonly PotWarning[]) => void;
}

type Outcome = ApiResult<OperationWriteResponse | OperationDeleteResponse>;

// docs/app-flow.md F2/F3 (create) and F4 subset (edit, delete). Server answers stay authoritative.
export function OperationSheet({ operation, reference, settings, onClose, onSaved }: Props) {
  const isEdit = operation !== null;
  const initialLoanPerson = useMemo(() => {
    if (operation?.class !== "loan") return "";
    return reference.openLoans.find((loan) => loan.id === operation.loanId)?.person ?? "";
  }, [operation, reference.openLoans]);
  const [form, setForm] = useState<OperationFormState>(() =>
    operation === null ? emptyForm(todayIso(new Date())) : formFromOperation(operation, initialLoanPerson),
  );
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const category = reference.categories.find((c) => c.id === form.categoryId);
  // docs/decisions.md P1.5: the class cannot change on edit, so only same-class categories are offered.
  const categories = isEdit ? reference.categories.filter((c) => c.class === operation.class) : reference.categories;
  const visible = category === undefined ? null : visibleFields(category.class);
  const previousCategory = isEdit ? reference.categories.find((c) => c.id === operation.categoryId) : undefined;
  const derived = derivedLine(
    form,
    category,
    reference.envelopes,
    settings.budgetRolloverDay,
    isEdit && previousCategory !== undefined
      ? { date: operation.date, rollsOver: previousCategory.rollsOver, budgetMonth: operation.budgetMonth }
      : undefined,
  );
  const amount = parseAmountInput(form.amountText);
  const errors = issuesByField(issues, shownFieldNames(category?.class ?? null));

  const finish = (outcome: Outcome, message: string) => {
    if (outcome.ok) {
      void queryClient.invalidateQueries({ queryKey: OPERATIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: REFERENCE_KEY });
      onSaved(message, outcome.data.warnings);
      return;
    }
    if (outcome.failure.kind === "validation") {
      setIssues(outcome.failure.issues);
      setFailure(null);
    } else {
      setFailure(outcome.failure);
    }
  };

  const save = useMutation({
    mutationFn: async (): Promise<Outcome> => {
      if (category === undefined) {
        return { ok: false, failure: { kind: "validation", issues: [{ field: "categoryId", code: "required" }] } };
      }
      const built = isEdit ? buildUpdateRequest(form, category, operation) : buildCreateRequest(form, category);
      if (!built.ok) return { ok: false, failure: { kind: "validation", issues: built.issues } };
      return isEdit
        ? api.send<OperationWriteResponse>("PATCH", `/api/operations/${operation.id}`, built.value)
        : api.send<OperationWriteResponse>("POST", "/api/operations", built.value);
    },
    onSuccess: (outcome) => finish(outcome, isEdit ? "Modification enregistrée." : "Opération enregistrée."),
  });

  const remove = useMutation({
    mutationFn: async (): Promise<Outcome> =>
      operation === null
        ? { ok: false, failure: { kind: "not_found" } }
        : api.send<OperationDeleteResponse>("DELETE", `/api/operations/${operation.id}`, { expectedUpdatedAt: operation.updatedAt }),
    onSuccess: (outcome) => finish(outcome, "Opération supprimée."),
  });

  const pending = save.isPending || remove.isPending;
  const update = (patch: Partial<OperationFormState>) => setForm((current) => ({ ...current, ...patch }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Double submit (TASKS note): one request at a time.
    if (pending) return;
    setIssues([]);
    setFailure(null);
    save.mutate();
  };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: OPERATIONS_KEY });
    void queryClient.invalidateQueries({ queryKey: REFERENCE_KEY });
    onClose();
  };

  const fieldErrors = (field: string) =>
    (errors[field] ?? []).map((message) => (
      <span key={message} className={styles.fieldError}>
        {message}
      </span>
    ));

  const accountSelect = (field: "sourceAccountId" | "destAccountId", mode: string) => (
    <label className={styles.field}>
      <span className={styles.label}>
        {FIELD_LABELS[field]}
        {mode === "optional" ? " (facultatif)" : ""}
      </span>
      <select
        className={styles.input}
        value={form[field] ?? ""}
        onChange={(event) => update({ [field]: event.target.value === "" ? null : Number(event.target.value) })}
      >
        <option value="">—</option>
        {withCurrent(reference.accounts, form[field], (id) => ({ id, name: `Compte n° ${id}` })).map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
      {fieldErrors(field)}
    </label>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <form
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
        noValidate
      >
        <div className={styles.spaceBetween}>
          <h2 id="sheet-title" className={styles.title}>
            {isEdit ? "Modifier l'opération" : "Nouvelle opération"}
          </h2>
          <button type="button" className={styles.button} onClick={onClose}>
            Fermer
          </button>
        </div>

        {failure !== null && (
          <div className={styles.bannerDanger} role="alert">
            <span>{failureMessage(failure)}</span>
            {(failure.kind === "conflict" || failure.kind === "not_found") && (
              <button type="button" className={styles.button} onClick={reload}>
                Recharger
              </button>
            )}
          </div>
        )}
        {(errors.form ?? []).length > 0 && (
          <div className={styles.bannerDanger} role="alert">
            {(errors.form ?? []).join(" ")}
          </div>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Montant (XAF)</span>
          <span className={styles.hero} aria-live="polite">
            {amount === null ? "0" : formatAmount(amount)} <span className={styles.muted}>XAF</span>
          </span>
          <input
            className={styles.input}
            inputMode="numeric"
            autoComplete="off"
            autoFocus={!isEdit}
            value={form.amountText}
            onChange={(event) => update({ amountText: event.target.value })}
          />
          {/* Never strip "," or ".": 1500,50 must not become 150 050. */}
          {form.amountText.trim() !== "" && amount === null && (
            <span className={styles.fieldError}>Montant invalide : chiffres uniquement, sans décimales.</span>
          )}
          {fieldErrors("amount")}
        </label>

        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>Catégorie</legend>
          {isEdit && category === undefined && (
            <div className={styles.bannerWarning} role="status">
              La catégorie de cette opération n'est plus active : choisis-en une autre de la même classe pour enregistrer.
            </div>
          )}
          {OPERATION_CLASSES.map((operationClass) => {
            const inClass = categories.filter((c) => c.class === operationClass);
            if (inClass.length === 0) return null;
            return (
              <div key={operationClass} className={styles.group}>
                <div className={styles.muted}>{CLASS_LABELS[operationClass]}</div>
                <div className={styles.chips}>
                  {inClass.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={c.id === form.categoryId ? styles.chipSelected : styles.chip}
                      aria-pressed={c.id === form.categoryId}
                      onClick={() => setForm((current) => withCategory(current, c))}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {fieldErrors("categoryId")}
        </fieldset>

        <p className={styles.muted} aria-live="polite">
          {derived.text}
        </p>

        {visible !== null && (
          <>
            {visible.exactlyOneAccount && <p className={styles.muted}>Un seul compte : départ pour un écart négatif, arrivée pour un écart positif.</p>}
            {visible.sourceAccountId !== "hidden" && accountSelect("sourceAccountId", visible.sourceAccountId)}
            {visible.destAccountId !== "hidden" && accountSelect("destAccountId", visible.destAccountId)}
            {visible.projectId !== "hidden" && (
              <label className={styles.field}>
                <span className={styles.label}>
                  {FIELD_LABELS.projectId}
                  {visible.projectId === "optional" ? " (facultatif)" : ""}
                </span>
                <select
                  className={styles.input}
                  value={form.projectId ?? ""}
                  onChange={(event) => update({ projectId: event.target.value === "" ? null : Number(event.target.value) })}
                >
                  <option value="">—</option>
                  {withCurrent(reference.projects, form.projectId, (id) => ({ id, name: `Projet n° ${id}` })).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {fieldErrors("projectId")}
              </label>
            )}
            {visible.loan === "person" && (
              <label className={styles.field}>
                <span className={styles.label}>{FIELD_LABELS.loanPerson}</span>
                <input
                  className={styles.input}
                  value={form.loanPerson}
                  placeholder={isEdit ? "Inchangé" : ""}
                  onChange={(event) => update({ loanPerson: event.target.value })}
                />
                {fieldErrors("loanPerson")}
              </label>
            )}
            {visible.loan === "select" && (
              <label className={styles.field}>
                <span className={styles.label}>{FIELD_LABELS.loanId}</span>
                <select
                  className={styles.input}
                  value={form.loanId ?? ""}
                  onChange={(event) => update({ loanId: event.target.value === "" ? null : Number(event.target.value) })}
                >
                  <option value="">—</option>
                  {withCurrent(
                    reference.openLoans.map((loan) => ({ id: loan.id, name: `${loan.person} · reste ${formatAmount(loan.remaining)} XAF` })),
                    form.loanId,
                    (id) => ({ id, name: `Prêt n° ${id}` }),
                  ).map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.name}
                    </option>
                  ))}
                </select>
                {fieldErrors("loanId")}
              </label>
            )}
          </>
        )}

        <label className={styles.field}>
          <span className={styles.label}>{FIELD_LABELS.date}</span>
          <input className={styles.input} type="date" value={form.date} onChange={(event) => update({ date: event.target.value })} />
          {fieldErrors("date")}
        </label>

        <details className={styles.group}>
          <summary className={styles.label}>Plus d'options</summary>
          <label className={styles.field}>
            <span className={styles.label}>{FIELD_LABELS.label}</span>
            <input className={styles.input} maxLength={200} value={form.label} onChange={(event) => update({ label: event.target.value })} />
            {fieldErrors("label")}
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{FIELD_LABELS.note}</span>
            <textarea className={styles.input} maxLength={1000} value={form.note} onChange={(event) => update({ note: event.target.value })} />
            {fieldErrors("note")}
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Mois budgétaire (forcer)</span>
            <input
              className={styles.input}
              type="month"
              value={form.budgetMonthOverride ?? ""}
              onChange={(event) => update({ budgetMonthOverride: event.target.value === "" ? null : event.target.value, clearOverride: false })}
            />
            {fieldErrors("budgetMonth")}
          </label>
          {isEdit && (
            <label className={styles.row}>
              <input
                type="checkbox"
                checked={form.clearOverride}
                onChange={(event) => update({ clearOverride: event.target.checked, budgetMonthOverride: null })}
              />
              <span>Mois automatique</span>
            </label>
          )}
        </details>

        <button type="submit" className={styles.primary} disabled={pending || amount === null || category === undefined}>
          {save.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>

        {isEdit && (
          <div className={`${styles.row} ${styles.spacedTop}`}>
            {confirmDelete ? (
              <>
                <span>Supprimer cette opération ?</span>
                <button type="button" className={styles.button} onClick={() => setConfirmDelete(false)} disabled={pending}>
                  Annuler
                </button>
                <button type="button" className={styles.danger} onClick={() => remove.mutate()} disabled={pending}>
                  {remove.isPending ? "Suppression…" : "Supprimer"}
                </button>
              </>
            ) : (
              <button type="button" className={styles.danger} onClick={() => setConfirmDelete(true)} disabled={pending}>
                Supprimer
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

function failureMessage(failure: ApiFailure): string {
  switch (failure.kind) {
    case "conflict":
      return apiErrorMessage("conflict");
    case "not_found":
      return apiErrorMessage("not_found");
    case "unauthorized":
      return apiErrorMessage("auth_required");
    case "validation":
      return apiErrorMessage("validation_failed");
    case "error":
      return apiErrorMessage(failure.code);
  }
}

// A stored value that is no longer listed (inactive account, settled loan) stays selectable on edit.
function withCurrent<T extends { readonly id: Id; readonly name: string }>(
  items: readonly T[],
  current: Id | null,
  fallback: (id: Id) => { id: Id; name: string },
): { id: Id; name: string }[] {
  const list: { id: Id; name: string }[] = [...items];
  if (current !== null && !list.some((item) => item.id === current)) list.push(fallback(current));
  return list;
}
