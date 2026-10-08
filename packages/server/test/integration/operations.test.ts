import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type {
  ApiErrorBody,
  OperationDeleteResponse,
  OperationDto,
  OperationListResponse,
  OperationWriteResponse,
} from "@suivi/shared";
import { startApi, type ApiHarness } from "./helpers.js";

// Synthetic amounts only. Seed: October 2026 pot-funded budgets = 435 500.

async function withApi(t: TestContext): Promise<ApiHarness> {
  const api = await startApi();
  t.after(() => api.close());
  return api;
}

function ids(api: ApiHarness) {
  const account = (name: string) => api.idOf("accounts", name);
  const category = (name: string) => api.idOf("categories", name);
  return {
    current: account("BGFI courant"),
    mobile: account("BGFI mobile"),
    cash: account("Espèces"),
    savings: account("BGFI épargne"),
    salary: category("Salaire"),
    groceries: category("Courses"),
    pot: category("Chargement du pot"),
    reinforcement: category("Renfort"),
    saving: category("Épargne"),
    projectPurchase: category("Achat projet"),
    loan: category("Prêt / avance"),
    repayment: category("Remboursement"),
    adjustment: category("Ajustement"),
  };
}

function issues(response: { body: unknown }): string[] {
  return ((response.body as ApiErrorBody).issues ?? []).map((issue) => `${issue.field}:${issue.code}`);
}

async function create(api: ApiHarness, body: Record<string, unknown>): Promise<OperationWriteResponse> {
  const response = await api.call<OperationWriteResponse>("POST", "/api/operations", body);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
}

function insertProject(api: ApiHarness): number {
  return Number(api.testDb.sqlite.prepare(`INSERT INTO projects (name) VALUES ('Projet test')`).run().lastInsertRowid);
}

function changeLogRows(api: ApiHarness, table: string) {
  return api.testDb.sqlite
    .prepare(`SELECT row_id AS rowId, before_json AS beforeJson, after_json AS afterJson FROM change_log WHERE table_name = ? ORDER BY id`)
    .all(table) as { rowId: number; beforeJson: string; afterJson: string }[];
}

test("auth: every operations route needs a session, every mutation needs the CSRF token", async (t) => {
  const api = await withApi(t);
  for (const path of ["/api/operations", "/api/operations/1", "/api/settings"]) {
    assert.equal((await fetch(`${api.base}${path}`)).status, 401, path);
  }
  for (const [method, path] of [
    ["POST", "/api/operations"],
    ["PATCH", "/api/operations/1"],
    ["DELETE", "/api/operations/1"],
  ] as const) {
    const response = await api.call<ApiErrorBody>(method, path, { expectedUpdatedAt: "x" }, { csrf: false });
    assert.equal(response.status, 403, `${method} ${path}`);
    assert.deepEqual(response.body, { error: "csrf_invalid" });
  }
  assert.equal(api.count("operations"), 0);
});

test("create: one operation per class; class and envelope come from the category (R2)", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  const projectId = insertProject(api);
  const cases: [string, Record<string, unknown>][] = [
    ["revenue", { categoryId: id.salary, destAccountId: id.current }],
    ["expense", { categoryId: id.groceries, sourceAccountId: id.mobile, usage: "personal", label: "Marché" }],
    ["transfer", { categoryId: id.reinforcement, sourceAccountId: id.current, destAccountId: id.mobile }],
    ["savings", { categoryId: id.saving, sourceAccountId: id.current, destAccountId: id.savings }],
    ["project", { categoryId: id.projectPurchase, sourceAccountId: id.savings, projectId }],
    ["transfer", { categoryId: id.reinforcement, sourceAccountId: id.savings, destAccountId: id.mobile, projectId }],
    ["loan", { categoryId: id.loan, sourceAccountId: id.cash, loanPerson: "Ami" }],
    ["adjustment", { categoryId: id.adjustment, destAccountId: id.cash }],
  ];
  for (const [expectedClass, fields] of cases) {
    const { operation, warnings } = await create(api, { date: "2026-10-10", amount: 1000, ...fields });
    assert.equal(operation.class, expectedClass);
    assert.equal(operation.status, "validated");
    assert.equal(operation.budgetMonth, "2026-10");
    assert.deepEqual(warnings, []);
  }
  const list = await api.call<OperationListResponse>("GET", "/api/operations");
  assert.equal(list.body.items.length, cases.length);
});

test("create: R2 and shape rejections write nothing", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  const rejected: [Record<string, unknown>, string[]][] = [
    [{ categoryId: id.groceries, sourceAccountId: id.mobile, class: "revenue" }, ["class:unknown_field"]],
    [{ categoryId: id.salary, sourceAccountId: id.current }, ["destAccountId:field_required", "sourceAccountId:field_forbidden"]],
    [{ categoryId: id.groceries }, ["sourceAccountId:field_required"]],
    [{ categoryId: id.reinforcement, sourceAccountId: id.mobile, destAccountId: id.mobile }, ["accounts:same_account"]],
    [{ categoryId: 9999, sourceAccountId: id.mobile }, ["categoryId:not_found"]],
    [{ categoryId: id.groceries, sourceAccountId: 9999 }, ["sourceAccountId:not_found"]],
    [{ categoryId: id.groceries, sourceAccountId: id.mobile, amount: 0 }, ["amount:invalid_amount"]],
    [{ categoryId: id.groceries, sourceAccountId: id.mobile, date: "2026-02-30" }, ["date:invalid_date"]],
    [{ categoryId: id.groceries, sourceAccountId: id.mobile, loanPerson: "Ami" }, ["loanPerson:field_forbidden"]],
  ];
  for (const [fields, expected] of rejected) {
    const response = await api.call<ApiErrorBody>("POST", "/api/operations", { date: "2026-10-10", amount: 1000, ...fields });
    assert.equal(response.status, 422, JSON.stringify(fields));
    assert.equal(response.body.error, "validation_failed");
    assert.deepEqual(issues(response).sort(), [...expected].sort(), JSON.stringify(fields));
  }
  assert.equal(api.count("operations"), 0);
  assert.equal(api.count("change_log"), 0);
});

test("create: an inactive category or account is rejected", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  api.testDb.sqlite.prepare(`UPDATE categories SET active = 0 WHERE id = ?`).run(id.groceries);
  api.testDb.sqlite.prepare(`UPDATE accounts SET active = 0 WHERE id = ?`).run(id.cash);
  const response = await api.call("POST", "/api/operations", {
    date: "2026-10-10",
    amount: 1000,
    categoryId: id.groceries,
    sourceAccountId: id.cash,
  });
  assert.equal(response.status, 422);
  assert.deepEqual(issues(response).sort(), ["categoryId:inactive", "sourceAccountId:inactive"]);
});

test("R3: salary and pot roll over from the configured day; manual budgetMonth wins", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  const salary = (date: string, extra: Record<string, unknown> = {}) =>
    create(api, { date, amount: 1000, categoryId: id.salary, destAccountId: id.current, ...extra });
  assert.equal((await salary("2026-09-29")).operation.budgetMonth, "2026-10");
  assert.equal((await salary("2026-10-24")).operation.budgetMonth, "2026-10");
  assert.equal((await salary("2026-10-25")).operation.budgetMonth, "2026-11");
  const groceries = await create(api, { date: "2026-10-29", amount: 1000, categoryId: id.groceries, sourceAccountId: id.mobile });
  assert.equal(groceries.operation.budgetMonth, "2026-10");
  assert.equal((await salary("2026-10-29", { budgetMonth: "2026-10" })).operation.budgetMonth, "2026-10");

  assert.equal((await api.call("PATCH", "/api/settings", { budgetRolloverDay: 20 })).status, 200);
  assert.equal((await salary("2026-10-21")).operation.budgetMonth, "2026-11");
});

test("R7: a project purchase or project-linked transfer must leave BGFI épargne", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  const projectId = insertProject(api);
  for (const fields of [
    { categoryId: id.projectPurchase, sourceAccountId: id.current, projectId },
    { categoryId: id.reinforcement, sourceAccountId: id.current, destAccountId: id.mobile, projectId },
  ]) {
    const response = await api.call("POST", "/api/operations", { date: "2026-10-10", amount: 1000, ...fields });
    assert.equal(response.status, 422);
    assert.deepEqual(issues(response), ["sourceAccountId:not_project_funding"]);
  }
  const unknownProject = await api.call("POST", "/api/operations", {
    date: "2026-10-10",
    amount: 1000,
    categoryId: id.projectPurchase,
    sourceAccountId: id.savings,
    projectId: 9999,
  });
  assert.deepEqual(issues(unknownProject), ["projectId:not_found"]);
});

test("R10: a loan creates its receivable; repayments settle it and cannot exceed it (Q6)", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  const loanStatus = (loanId: number) =>
    api.testDb.sqlite.prepare(`SELECT person, amount, status FROM loans WHERE id = ?`).get(loanId) as {
      person: string;
      amount: number;
      status: string;
    };

  const noPerson = await api.call("POST", "/api/operations", { date: "2026-10-05", amount: 150000, categoryId: id.loan, sourceAccountId: id.cash });
  assert.deepEqual(issues(noPerson), ["loanPerson:required"]);
  const withLoanId = await api.call("POST", "/api/operations", {
    date: "2026-10-05",
    amount: 150000,
    categoryId: id.loan,
    sourceAccountId: id.cash,
    loanPerson: "Ami",
    loanId: 1,
  });
  assert.deepEqual(issues(withLoanId), ["loanId:field_forbidden"]);
  assert.equal(api.count("loans"), 0);

  const loan = (await create(api, { date: "2026-10-05", amount: 150000, categoryId: id.loan, sourceAccountId: id.cash, loanPerson: "Ami" }))
    .operation;
  assert.ok(loan.loanId !== null);
  assert.deepEqual(loanStatus(loan.loanId), { person: "Ami", amount: 150000, status: "open" });

  const repay = (amount: number) => ({ date: "2026-10-20", amount, categoryId: id.repayment, destAccountId: id.current, loanId: loan.loanId });
  const first = (await create(api, repay(100000))).operation;
  assert.equal(loanStatus(loan.loanId).status, "open");
  const tooMuch = await api.call("POST", "/api/operations", repay(50001));
  assert.equal(tooMuch.status, 422);
  assert.deepEqual(issues(tooMuch), ["amount:exceeds_remaining"]);
  await create(api, repay(50000));
  assert.equal(loanStatus(loan.loanId).status, "settled");

  // Editing a repayment counts the others, not itself.
  const edit = await api.call("PATCH", `/api/operations/${first.id}`, { expectedUpdatedAt: first.updatedAt, amount: 100001 });
  assert.deepEqual(issues(edit), ["amount:exceeds_remaining"]);

  // A loan with live repayments cannot be deleted; deleting a repayment reopens the loan.
  const deleteLoan = await api.call("DELETE", `/api/operations/${loan.id}`, { expectedUpdatedAt: loan.updatedAt });
  assert.deepEqual(issues(deleteLoan), ["id:has_repayments"]);
  assert.equal((await api.call("DELETE", `/api/operations/${first.id}`, { expectedUpdatedAt: first.updatedAt })).status, 200);
  assert.equal(loanStatus(loan.loanId).status, "open");
  assert.ok(changeLogRows(api, "loans").length >= 2);

  const unknownLoan = await api.call("POST", "/api/operations", { ...repay(1000), loanId: 9999 });
  assert.deepEqual(issues(unknownLoan), ["loanId:not_found"]);
});

function loanRow(api: ApiHarness, loanId: number | null) {
  return api.testDb.sqlite.prepare(`SELECT person, amount, status FROM loans WHERE id = ?`).get(loanId) as {
    person: string;
    amount: number;
    status: string;
  };
}

async function patchOk(api: ApiHarness, operation: OperationDto, body: Record<string, unknown>): Promise<OperationDto> {
  const response = await api.call<OperationWriteResponse>("PATCH", `/api/operations/${operation.id}`, {
    expectedUpdatedAt: operation.updatedAt,
    ...body,
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.operation;
}

test("R10 edit: the receivable follows its loan operation; never below what was repaid", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  let loan = (await create(api, { date: "2026-10-05", amount: 100000, categoryId: id.loan, sourceAccountId: id.cash, loanPerson: "Ami" }))
    .operation;
  await create(api, { date: "2026-10-20", amount: 60000, categoryId: id.repayment, destAccountId: id.current, loanId: loan.loanId });

  loan = await patchOk(api, loan, { amount: 80000, date: "2026-10-06", loanPerson: "Ami B" });
  assert.deepEqual(loanRow(api, loan.loanId), { person: "Ami B", amount: 80000, status: "open" });

  const below = await api.call("PATCH", `/api/operations/${loan.id}`, { expectedUpdatedAt: loan.updatedAt, amount: 59999 });
  assert.equal(below.status, 422);
  assert.deepEqual(issues(below), ["amount:exceeds_remaining"]);
  assert.equal(loanRow(api, loan.loanId).amount, 80000);

  loan = await patchOk(api, loan, { amount: 60000 });
  assert.deepEqual(loanRow(api, loan.loanId), { person: "Ami B", amount: 60000, status: "settled" });
  loan = await patchOk(api, loan, { amount: 70000 });
  assert.equal(loanRow(api, loan.loanId).status, "open");

  const relink = await api.call("PATCH", `/api/operations/${loan.id}`, { expectedUpdatedAt: loan.updatedAt, loanId: null });
  assert.deepEqual(issues(relink).sort(), ["loanId:field_forbidden", "loanId:field_required"]);
});

test("R10 edit: moving a repayment to another loan re-syncs both loans", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  const newLoan = async (amount: number, person: string) =>
    (await create(api, { date: "2026-10-05", amount, categoryId: id.loan, sourceAccountId: id.cash, loanPerson: person })).operation.loanId;
  const loanA = await newLoan(100000, "Ami A");
  const loanB = await newLoan(50000, "Ami B");
  const repay = async (loanId: number | null, amount: number) =>
    (await create(api, { date: "2026-10-20", amount, categoryId: id.repayment, destAccountId: id.current, loanId })).operation;

  const first = await repay(loanA, 50000);
  let second = await repay(loanA, 50000);
  assert.equal(loanRow(api, loanA).status, "settled");
  assert.equal(loanRow(api, loanB).status, "open");

  second = await patchOk(api, second, { loanId: loanB });
  assert.equal(loanRow(api, loanA).status, "open");
  assert.equal(loanRow(api, loanB).status, "settled");

  // B is fully repaid: nothing more can move onto it.
  const overpay = await api.call("PATCH", `/api/operations/${first.id}`, { expectedUpdatedAt: first.updatedAt, loanId: loanB });
  assert.deepEqual(issues(overpay), ["amount:exceeds_remaining"]);
  assert.equal(loanRow(api, loanA).status, "open");

  await patchOk(api, second, { loanId: loanA });
  assert.equal(loanRow(api, loanA).status, "settled");
  assert.equal(loanRow(api, loanB).status, "open");
});

test("edit: optimistic lock, change_log, class change forbidden", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  const { operation } = await create(api, { date: "2026-10-10", amount: 1000, categoryId: id.groceries, sourceAccountId: id.mobile });

  const edited = await api.call<OperationWriteResponse>("PATCH", `/api/operations/${operation.id}`, {
    expectedUpdatedAt: operation.updatedAt,
    amount: 2500,
    label: "Marché",
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.operation.amount, 2500);
  assert.notEqual(edited.body.operation.updatedAt, operation.updatedAt);
  const [log] = changeLogRows(api, "operations");
  assert.equal(log?.rowId, operation.id);
  assert.equal((JSON.parse(log?.beforeJson ?? "{}") as { amount: number }).amount, 1000);
  assert.equal((JSON.parse(log?.afterJson ?? "{}") as { amount: number }).amount, 2500);

  const stale = await api.call<ApiErrorBody>("PATCH", `/api/operations/${operation.id}`, { expectedUpdatedAt: operation.updatedAt, amount: 3000 });
  assert.equal(stale.status, 409);
  assert.deepEqual(stale.body, { error: "conflict" });

  const fresh = edited.body.operation.updatedAt;
  const toRevenue = await api.call("PATCH", `/api/operations/${operation.id}`, { expectedUpdatedAt: fresh, categoryId: id.salary });
  assert.deepEqual(issues(toRevenue), ["categoryId:class_change_forbidden"]);
  const missingLock = await api.call("PATCH", `/api/operations/${operation.id}`, { amount: 3000 });
  assert.deepEqual(issues(missingLock), ["expectedUpdatedAt:required"]);
  assert.equal(changeLogRows(api, "operations").length, 1);
  assert.equal((await api.call<OperationDto>("GET", `/api/operations/${operation.id}`)).body.amount, 2500);
});

test("edit (Q9): the budget month follows the date unless it was set by hand", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  const patch = async (operation: OperationDto, body: Record<string, unknown>) => {
    const response = await api.call<OperationWriteResponse>("PATCH", `/api/operations/${operation.id}`, { expectedUpdatedAt: operation.updatedAt, ...body });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.operation;
  };
  let computed = (await create(api, { date: "2026-10-20", amount: 1000, categoryId: id.salary, destAccountId: id.current })).operation;
  computed = await patch(computed, { date: "2026-10-29" });
  assert.equal(computed.budgetMonth, "2026-11");

  let manual = (await create(api, { date: "2026-10-20", amount: 1000, categoryId: id.salary, destAccountId: id.current, budgetMonth: "2026-09" }))
    .operation;
  manual = await patch(manual, { date: "2026-10-29" });
  assert.equal(manual.budgetMonth, "2026-09");
  manual = await patch(manual, { budgetMonth: null });
  assert.equal(manual.budgetMonth, "2026-11");
});

test("delete: soft delete, journaled, hidden; a second delete is 404", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  const { operation } = await create(api, { date: "2026-10-10", amount: 1000, categoryId: id.groceries, sourceAccountId: id.mobile });
  const stale = await api.call("DELETE", `/api/operations/${operation.id}`, { expectedUpdatedAt: "2000-01-01T00:00:00.000Z" });
  assert.equal(stale.status, 409);

  const deleted = await api.call<OperationDeleteResponse>("DELETE", `/api/operations/${operation.id}`, { expectedUpdatedAt: operation.updatedAt });
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.body, { warnings: [] });
  const row = api.testDb.sqlite.prepare(`SELECT deleted_at AS deletedAt FROM operations WHERE id = ?`).get(operation.id) as { deletedAt: string | null };
  assert.ok(row.deletedAt);
  assert.equal(changeLogRows(api, "operations").length, 1);
  assert.equal((await api.call("GET", `/api/operations/${operation.id}`)).status, 404);
  assert.equal((await api.call<OperationListResponse>("GET", "/api/operations")).body.items.length, 0);
  assert.equal((await api.call("DELETE", `/api/operations/${operation.id}`, { expectedUpdatedAt: operation.updatedAt })).status, 404);
  assert.equal((await api.call("PATCH", `/api/operations/${operation.id}`, { expectedUpdatedAt: operation.updatedAt, amount: 5 })).status, 404);
  assert.equal((await api.call("GET", "/api/operations/abc")).status, 404);
});

test("list: filters, order and paging", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  await create(api, { date: "2026-10-03", amount: 1000, categoryId: id.groceries, sourceAccountId: id.mobile });
  await create(api, { date: "2026-10-12", amount: 2000, categoryId: id.groceries, sourceAccountId: id.cash });
  await create(api, { date: "2026-09-29", amount: 3000, categoryId: id.salary, destAccountId: id.current });
  await create(api, { date: "2026-11-02", amount: 4000, categoryId: id.groceries, sourceAccountId: id.mobile });
  const amounts = async (query: string) =>
    (await api.call<OperationListResponse>("GET", `/api/operations${query}`)).body.items.map((item) => item.amount);

  assert.deepEqual(await amounts(""), [4000, 2000, 1000, 3000]);
  assert.deepEqual(await amounts("?month=2026-10"), [2000, 1000, 3000]);
  assert.deepEqual(await amounts("?from=2026-10-01&to=2026-10-31"), [2000, 1000]);
  assert.deepEqual(await amounts(`?accountId=${id.mobile}`), [4000, 1000]);
  assert.deepEqual(await amounts(`?categoryId=${id.salary}`), [3000]);
  assert.deepEqual(await amounts("?class=revenue"), [3000]);
  assert.deepEqual(await amounts("?limit=2&offset=1"), [2000, 1000]);
  const bad = await api.call("GET", "/api/operations?month=octobre&sort=date");
  assert.equal(bad.status, 422);
  assert.deepEqual(issues(bad), ["month:invalid", "sort:unknown_field"]);
});

test("pot: writes to Chargement du pot warn when pot budgets exceed the pot, never block", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  const pot = await create(api, { date: "2026-09-29", amount: 400000, categoryId: id.pot, sourceAccountId: id.current, destAccountId: id.mobile });
  assert.equal(pot.operation.budgetMonth, "2026-10");
  assert.deepEqual(pot.warnings, [{ code: "budget_exceeds_pot", budgetMonth: "2026-10", potBudgets: 435500, pot: 400000, tolerance: 0 }]);

  // Other categories never carry the warning.
  const groceries = await create(api, { date: "2026-10-10", amount: 1000, categoryId: id.groceries, sourceAccountId: id.mobile });
  assert.deepEqual(groceries.warnings, []);

  assert.equal((await api.call("PATCH", "/api/settings", { potBudgetTolerance: 35500 })).status, 200);
  const raised = await api.call<OperationWriteResponse>("PATCH", `/api/operations/${pot.operation.id}`, {
    expectedUpdatedAt: pot.operation.updatedAt,
    label: "Pot octobre",
  });
  assert.deepEqual(raised.body.warnings, []);

  const removed = await api.call<OperationDeleteResponse>("DELETE", `/api/operations/${pot.operation.id}`, {
    expectedUpdatedAt: raised.body.operation.updatedAt,
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.warnings[0]?.pot, 0);
});

test("logs: operation writes log no amounts", async (t) => {
  const api = await withApi(t);
  const id = ids(api);
  const lines: string[] = [];
  for (const method of ["log", "info", "warn", "error"] as const) {
    t.mock.method(console, method, (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
  }
  const { operation } = await create(api, { date: "2026-10-10", amount: 987654, categoryId: id.groceries, sourceAccountId: id.mobile });
  await api.call("PATCH", `/api/operations/${operation.id}`, { expectedUpdatedAt: operation.updatedAt, amount: 876543 });
  await api.call("POST", "/api/operations", { date: "2026-10-10", amount: 765432, categoryId: id.salary, sourceAccountId: id.mobile });
  assert.equal(lines.join("\n").match(/987654|876543|765432/), null);
});
