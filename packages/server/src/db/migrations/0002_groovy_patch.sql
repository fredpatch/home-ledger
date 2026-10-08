CREATE TABLE `auth_throttle` (
	`id` integer PRIMARY KEY NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`window_started_at` text,
	`locked_until` text,
	CONSTRAINT "auth_throttle_single_row_check" CHECK("id" = 1),
	CONSTRAINT "auth_throttle_failed_count_check" CHECK(typeof("failed_count") = 'integer' AND "failed_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`csrf_token` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`absolute_expires_at` text NOT NULL,
	CONSTRAINT "sessions_kind_check" CHECK("kind" IN ('short', 'long')),
	CONSTRAINT "sessions_id_hash_check" CHECK(length("id_hash") = 64)
);
