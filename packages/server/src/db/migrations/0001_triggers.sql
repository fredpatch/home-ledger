-- Custom migration: database-level guards that CHECK constraints cannot express.
CREATE TRIGGER `operations_class_matches_category_insert`
BEFORE INSERT ON `operations`
FOR EACH ROW
WHEN NEW.`class` IS NOT (SELECT `class` FROM `categories` WHERE `id` = NEW.`category_id`)
BEGIN
  SELECT RAISE(ABORT, 'operations.class must equal categories.class');
END;--> statement-breakpoint
CREATE TRIGGER `operations_class_matches_category_update`
BEFORE UPDATE ON `operations`
FOR EACH ROW
WHEN NEW.`class` IS NOT (SELECT `class` FROM `categories` WHERE `id` = NEW.`category_id`)
BEGIN
  SELECT RAISE(ABORT, 'operations.class must equal categories.class');
END;--> statement-breakpoint
CREATE TRIGGER `operations_no_hard_delete`
BEFORE DELETE ON `operations`
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'operations are soft-deleted (deleted_at), never removed');
END;--> statement-breakpoint
CREATE TRIGGER `categories_class_locked_when_used`
BEFORE UPDATE OF `class` ON `categories`
FOR EACH ROW
WHEN NEW.`class` IS NOT OLD.`class` AND EXISTS (SELECT 1 FROM `operations` WHERE `category_id` = OLD.`id`)
BEGIN
  SELECT RAISE(ABORT, 'category class cannot change once operations use it');
END;--> statement-breakpoint
CREATE TRIGGER `change_log_no_update`
BEFORE UPDATE ON `change_log`
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'change_log is append-only');
END;--> statement-breakpoint
CREATE TRIGGER `change_log_no_delete`
BEFORE DELETE ON `change_log`
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'change_log is append-only');
END;