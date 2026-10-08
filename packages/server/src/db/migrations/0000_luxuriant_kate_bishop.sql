CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`reconciliation_frequency` text NOT NULL,
	`funds_projects` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer NOT NULL,
	CONSTRAINT "accounts_type_check" CHECK("type" IN ('bank', 'mobile', 'cash', 'savings', 'card')),
	CONSTRAINT "accounts_frequency_check" CHECK("reconciliation_frequency" IN ('weekly', 'monthly')),
	CONSTRAINT "accounts_opening_balance_check" CHECK(typeof("opening_balance") = 'integer'),
	CONSTRAINT "accounts_funds_projects_check" CHECK("funds_projects" IN (0, 1)),
	CONSTRAINT "accounts_active_check" CHECK("active" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_name_unique` ON `accounts` (`name`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`budget_month` text NOT NULL,
	`category_id` integer NOT NULL,
	`amount` integer NOT NULL,
	PRIMARY KEY(`budget_month`, `category_id`),
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "budgets_month_check" CHECK(date("budget_month" || '-01') IS "budget_month" || '-01'),
	CONSTRAINT "budgets_amount_check" CHECK(typeof("amount") = 'integer' AND "amount" >= 0 AND "amount" <= 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`class` text NOT NULL,
	`envelope_id` integer,
	`rolls_over` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`envelope_id`) REFERENCES `envelopes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "categories_class_check" CHECK("class" IN ('revenue', 'expense', 'transfer', 'savings', 'project', 'loan', 'repayment', 'adjustment')),
	CONSTRAINT "categories_envelope_check" CHECK(("class" = 'expense' AND "envelope_id" IS NOT NULL) OR ("class" <> 'expense' AND "envelope_id" IS NULL)),
	CONSTRAINT "categories_rolls_over_check" CHECK("rolls_over" IN (0, 1)),
	CONSTRAINT "categories_active_check" CHECK("active" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `change_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_name` text NOT NULL,
	`row_id` integer NOT NULL,
	`before_json` text,
	`after_json` text,
	`changed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `envelopes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	CONSTRAINT "envelopes_source_check" CHECK("source" IN ('pot', 'current_card'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `envelopes_name_unique` ON `envelopes` (`name`);--> statement-breakpoint
CREATE TABLE `loans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	CONSTRAINT "loans_amount_check" CHECK(typeof("amount") = 'integer' AND "amount" > 0 AND "amount" <= 9007199254740991),
	CONSTRAINT "loans_date_check" CHECK(date("date") IS "date"),
	CONSTRAINT "loans_status_check" CHECK("status" IN ('open', 'settled'))
);
--> statement-breakpoint
CREATE TABLE `operations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`budget_month` text NOT NULL,
	`label` text,
	`amount` integer NOT NULL,
	`category_id` integer NOT NULL,
	`class` text NOT NULL,
	`source_account_id` integer,
	`dest_account_id` integer,
	`project_id` integer,
	`client` text,
	`usage` text,
	`loan_id` integer,
	`status` text DEFAULT 'validated' NOT NULL,
	`note` text,
	`source_ref` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dest_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "operations_date_check" CHECK(date("date") IS "date"),
	CONSTRAINT "operations_budget_month_check" CHECK(date("budget_month" || '-01') IS "budget_month" || '-01'),
	CONSTRAINT "operations_amount_check" CHECK(typeof("amount") = 'integer' AND "amount" > 0 AND "amount" <= 9007199254740991),
	CONSTRAINT "operations_class_check" CHECK("class" IN ('revenue', 'expense', 'transfer', 'savings', 'project', 'loan', 'repayment', 'adjustment')),
	CONSTRAINT "operations_usage_check" CHECK("usage" IS NULL OR "usage" IN ('personal', 'activity', 'mixed')),
	CONSTRAINT "operations_status_check" CHECK("status" IN ('draft', 'validated')),
	CONSTRAINT "operations_field_matrix_check" CHECK(("class" = 'revenue' AND "dest_account_id" IS NOT NULL AND "source_account_id" IS NULL AND "project_id" IS NULL AND "loan_id" IS NULL) OR ("class" = 'expense' AND "source_account_id" IS NOT NULL AND "dest_account_id" IS NULL AND "project_id" IS NULL AND "loan_id" IS NULL) OR ("class" = 'transfer' AND "source_account_id" IS NOT NULL AND "dest_account_id" IS NOT NULL AND "source_account_id" <> "dest_account_id" AND "loan_id" IS NULL) OR ("class" = 'savings' AND "source_account_id" IS NOT NULL AND "dest_account_id" IS NOT NULL AND "source_account_id" <> "dest_account_id" AND "project_id" IS NULL AND "loan_id" IS NULL) OR ("class" = 'project' AND "source_account_id" IS NOT NULL AND "project_id" IS NOT NULL AND "dest_account_id" IS NULL AND "loan_id" IS NULL) OR ("class" = 'loan' AND "source_account_id" IS NOT NULL AND "loan_id" IS NOT NULL AND "dest_account_id" IS NULL AND "project_id" IS NULL) OR ("class" = 'repayment' AND "dest_account_id" IS NOT NULL AND "loan_id" IS NOT NULL AND "source_account_id" IS NULL AND "project_id" IS NULL) OR ("class" = 'adjustment' AND ("source_account_id" IS NOT NULL) <> ("dest_account_id" IS NOT NULL) AND "project_id" IS NULL AND "loan_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operations_source_ref_unique` ON `operations` (`source_ref`);--> statement-breakpoint
CREATE INDEX `operations_date_idx` ON `operations` (`date`);--> statement-breakpoint
CREATE INDEX `operations_budget_month_idx` ON `operations` (`budget_month`);--> statement-breakpoint
CREATE INDEX `operations_category_idx` ON `operations` (`category_id`);--> statement-breakpoint
CREATE INDEX `operations_source_account_idx` ON `operations` (`source_account_id`);--> statement-breakpoint
CREATE INDEX `operations_dest_account_idx` ON `operations` (`dest_account_id`);--> statement-breakpoint
CREATE INDEX `operations_project_idx` ON `operations` (`project_id`);--> statement-breakpoint
CREATE INDEX `operations_loan_idx` ON `operations` (`loan_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`ceiling` integer,
	`due_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`note` text,
	CONSTRAINT "projects_status_check" CHECK("status" IN ('active', 'closed')),
	CONSTRAINT "projects_ceiling_check" CHECK("ceiling" IS NULL OR (typeof("ceiling") = 'integer' AND "ceiling" > 0 AND "ceiling" <= 9007199254740991)),
	CONSTRAINT "projects_due_date_check" CHECK("due_date" IS NULL OR date("due_date") IS "due_date")
);
--> statement-breakpoint
CREATE TABLE `reconciliations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`date` text NOT NULL,
	`actual_balance` integer NOT NULL,
	`theoretical_balance` integer NOT NULL,
	`gap` integer NOT NULL,
	`adjustment_operation_id` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`adjustment_operation_id`) REFERENCES `operations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reconciliations_date_check" CHECK(date("date") IS "date"),
	CONSTRAINT "reconciliations_integers_check" CHECK(typeof("actual_balance") = 'integer' AND typeof("theoretical_balance") = 'integer' AND typeof("gap") = 'integer'),
	CONSTRAINT "reconciliations_gap_check" CHECK("gap" = "actual_balance" - "theoretical_balance")
);
--> statement-breakpoint
CREATE INDEX `reconciliations_account_date_idx` ON `reconciliations` (`account_id`,`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
