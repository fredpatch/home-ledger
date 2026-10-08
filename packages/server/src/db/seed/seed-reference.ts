import { eq } from "drizzle-orm";
import type { AppDatabase } from "../connection.js";
import { accounts, budgets, categories, envelopes, settings } from "../schema.js";
import {
  ACCOUNT_SEEDS,
  BUDGET_SEEDS,
  CATEGORY_SEEDS,
  ENVELOPE_SEEDS,
  SEED_BUDGET_MONTH,
  SETTING_SEEDS,
} from "./reference-data.js";

export interface SeedReport {
  readonly accounts: number;
  readonly envelopes: number;
  readonly categories: number;
  readonly budgets: number;
  readonly settings: number;
}

// Insert-only and idempotent: rows are matched by natural key and never updated or deleted.
export function seedReference(db: AppDatabase): SeedReport {
  return db.transaction((tx) => {
    let accountCount = 0;
    ACCOUNT_SEEDS.forEach((seed, index) => {
      accountCount += tx
        .insert(accounts)
        .values({ ...seed, sortOrder: index + 1 })
        .onConflictDoNothing({ target: accounts.name })
        .run().changes;
    });

    let envelopeCount = 0;
    for (const seed of ENVELOPE_SEEDS) {
      envelopeCount += tx.insert(envelopes).values(seed).onConflictDoNothing({ target: envelopes.name }).run().changes;
    }

    const envelopeIds = new Map(tx.select().from(envelopes).all().map((row) => [row.name, row.id]));
    let categoryCount = 0;
    for (const seed of CATEGORY_SEEDS) {
      const envelopeId = seed.envelope === null ? null : envelopeIds.get(seed.envelope);
      if (envelopeId === undefined) {
        throw new Error(`Unknown envelope for category ${seed.name}`);
      }
      categoryCount += tx
        .insert(categories)
        .values({ name: seed.name, class: seed.class, envelopeId, rollsOver: seed.rollsOver })
        .onConflictDoNothing({ target: categories.name })
        .run().changes;
    }

    let budgetCount = 0;
    for (const seed of BUDGET_SEEDS) {
      const category = tx.select().from(categories).where(eq(categories.name, seed.category)).get();
      if (!category) {
        throw new Error(`Unknown category for budget ${seed.category}`);
      }
      budgetCount += tx
        .insert(budgets)
        .values({ budgetMonth: SEED_BUDGET_MONTH, categoryId: category.id, amount: seed.amount })
        .onConflictDoNothing()
        .run().changes;
    }

    let settingCount = 0;
    for (const seed of SETTING_SEEDS) {
      settingCount += tx.insert(settings).values(seed).onConflictDoNothing({ target: settings.key }).run().changes;
    }

    return {
      accounts: accountCount,
      envelopes: envelopeCount,
      categories: categoryCount,
      budgets: budgetCount,
      settings: settingCount,
    };
  });
}
