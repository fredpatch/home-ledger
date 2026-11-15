import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { OperationWriteResponse, ReferenceData } from "@suivi/shared";
import { startApi, type ApiHarness } from "./helpers.js";

async function withApi(t: TestContext): Promise<ApiHarness> {
  const api = await startApi();
  t.after(() => api.close());
  return api;
}

async function reference(api: ApiHarness): Promise<ReferenceData> {
  const response = await api.call<ReferenceData>("GET", "/api/reference");
  assert.equal(response.status, 200);
  return response.body;
}

test("reference: needs a session; read-only", async (t) => {
  const api = await withApi(t);
  assert.equal((await fetch(`${api.base}/api/reference`)).status, 401);
  assert.equal((await api.call("POST", "/api/reference", {})).status, 404);
});

test("reference: seeded accounts in order, envelopes, categories with class and rollover", async (t) => {
  const api = await withApi(t);
  const data = await reference(api);
  assert.deepEqual(
    data.accounts.map((a) => a.name),
    ["BGFI courant", "BGFI mobile", "Espèces", "BGFI épargne", "UGB épargne", "Carte prépayée"],
  );
  assert.deepEqual(data.accounts.filter((a) => a.fundsProjects).map((a) => a.name), ["BGFI épargne"]);
  assert.equal(data.envelopes.length, 8);
  assert.equal(data.categories.length, 29);
  const pot = data.categories.find((c) => c.name === "Chargement du pot");
  assert.deepEqual(pot && { class: pot.class, envelopeId: pot.envelopeId, rollsOver: pot.rollsOver }, {
    class: "transfer",
    envelopeId: null,
    rollsOver: true,
  });
  const groceries = data.categories.find((c) => c.name === "Courses");
  assert.ok(groceries?.envelopeId !== null && data.envelopes.some((e) => e.id === groceries?.envelopeId));
  assert.deepEqual(data.projects, []);
  assert.deepEqual(data.openLoans, []);
  const text = JSON.stringify(data);
  assert.equal(/auth|argon2/.test(text), false);
});

test("reference: inactive accounts and categories, closed projects are left out", async (t) => {
  const api = await withApi(t);
  const sqlite = api.testDb.sqlite;
  sqlite.prepare(`UPDATE accounts SET active = 0 WHERE name = 'UGB épargne'`).run();
  sqlite.prepare(`UPDATE categories SET active = 0 WHERE name = 'Courses'`).run();
  sqlite.prepare(`INSERT INTO projects (name) VALUES ('PC Tower')`).run();
  sqlite.prepare(`INSERT INTO projects (name, status) VALUES ('Ancien projet', 'closed')`).run();
  const data = await reference(api);
  assert.equal(data.accounts.some((a) => a.name === "UGB épargne"), false);
  assert.equal(data.categories.some((c) => c.name === "Courses"), false);
  assert.deepEqual(data.projects.map((p) => p.name), ["PC Tower"]);
});

test("reference: open loans are live, not settled, with their remaining amount", async (t) => {
  const api = await withApi(t);
  const account = (name: string) => api.idOf("accounts", name);
  const category = (name: string) => api.idOf("categories", name);
  const lend = async (person: string, amount: number, date = "2026-10-05") => {
    const response = await api.call<OperationWriteResponse>("POST", "/api/operations", {
      date,
      amount,
      categoryId: category("Prêt / avance"),
      sourceAccountId: account("Espèces"),
      loanPerson: person,
    });
    assert.equal(response.status, 201);
    return response.body.operation;
  };
  const repay = async (loanId: number | null, amount: number) => {
    const response = await api.call<OperationWriteResponse>("POST", "/api/operations", {
      date: "2026-10-20",
      amount,
      categoryId: category("Remboursement"),
      destAccountId: account("BGFI courant"),
      loanId,
    });
    assert.equal(response.status, 201);
    return response.body.operation;
  };

  const partial = await lend("Ami A", 100000);
  await repay(partial.loanId, 40000);
  const settled = await lend("Ami B", 50000);
  await repay(settled.loanId, 50000);
  const deleted = await lend("Ami C", 30000);
  assert.equal(
    (await api.call("DELETE", `/api/operations/${deleted.id}`, { expectedUpdatedAt: deleted.updatedAt })).status,
    200,
  );

  const data = await reference(api);
  assert.deepEqual(data.openLoans, [
    { id: partial.loanId, person: "Ami A", amount: 100000, date: "2026-10-05", remaining: 60000 },
  ]);
});

test("reference: open loans are ordered by date then id; no repayment means remaining = amount", async (t) => {
  const api = await withApi(t);
  const lend = async (person: string, date: string) => {
    const response = await api.call<OperationWriteResponse>("POST", "/api/operations", {
      date,
      amount: 20000,
      categoryId: api.idOf("categories", "Prêt / avance"),
      sourceAccountId: api.idOf("accounts", "Espèces"),
      loanPerson: person,
    });
    assert.equal(response.status, 201);
    return response.body.operation.loanId;
  };
  const late = await lend("Ami tard", "2026-10-09");
  const firstSameDay = await lend("Ami 1", "2026-10-02");
  const secondSameDay = await lend("Ami 2", "2026-10-02");
  const data = await reference(api);
  assert.deepEqual(
    data.openLoans.map((loan) => [loan.id, loan.remaining]),
    [
      [firstSameDay, 20000],
      [secondSameDay, 20000],
      [late, 20000],
    ],
  );
});

test("reference: a settled loan reappears when its settling repayment is deleted", async (t) => {
  const api = await withApi(t);
  const loan = await api.call<OperationWriteResponse>("POST", "/api/operations", {
    date: "2026-10-05",
    amount: 50000,
    categoryId: api.idOf("categories", "Prêt / avance"),
    sourceAccountId: api.idOf("accounts", "Espèces"),
    loanPerson: "Ami",
  });
  const repayment = await api.call<OperationWriteResponse>("POST", "/api/operations", {
    date: "2026-10-20",
    amount: 50000,
    categoryId: api.idOf("categories", "Remboursement"),
    destAccountId: api.idOf("accounts", "BGFI courant"),
    loanId: loan.body.operation.loanId,
  });
  assert.deepEqual((await reference(api)).openLoans, []);
  const deleted = await api.call("DELETE", `/api/operations/${repayment.body.operation.id}`, {
    expectedUpdatedAt: repayment.body.operation.updatedAt,
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(
    (await reference(api)).openLoans.map((open) => [open.id, open.remaining]),
    [[loan.body.operation.loanId, 50000]],
  );
});
