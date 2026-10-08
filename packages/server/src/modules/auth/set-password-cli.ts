import { existsSync } from "node:fs";
import { openDatabase } from "../../db/connection.js";
import { databasePathFromEnv } from "../../db/paths.js";
import { setPasswordHash } from "./auth.service.js";
import { checkNewPassword, hashPassword, PASSWORD_MIN_LENGTH, type NewPasswordIssue } from "./password.js";

// Never prints the password or its hash.
const ISSUE_MESSAGES: Record<NewPasswordIssue, string> = {
  too_short: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  too_long: "Password is too long.",
  mismatch: "The two entries do not match.",
};

// Reads a line from the terminal in raw mode without echoing it.
function promptHidden(label: string): Promise<string> {
  const stdin = process.stdin;
  process.stdout.write(label);
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();
  return new Promise((resolve, reject) => {
    let chars: string[] = [];
    const finish = (error: Error | null) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      if (error === null) {
        resolve(chars.join(""));
      } else {
        reject(error);
      }
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish(null);
          return;
        }
        if (char === "\u0003") {
          finish(new Error("Cancelled."));
          return;
        }
        // Arrow/Delete/function keys send ESC sequences whose tail would silently join the password.
        if (char === "\u001b") {
          finish(new Error("Unsupported key (arrows, Delete, function keys). Run the command again."));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          chars = chars.slice(0, -1);
        } else if (char >= " ") {
          chars.push(char);
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function main(): Promise<number> {
  if (!process.stdin.isTTY) {
    console.error("auth:set-password needs an interactive terminal.");
    return 1;
  }
  const path = databasePathFromEnv();
  if (!existsSync(path)) {
    console.error(`Database not found at ${path}. Run npm run db:migrate first.`);
    return 1;
  }
  const password = await promptHidden("New password: ");
  const confirmation = await promptHidden("Repeat password: ");
  const issue = checkNewPassword(password, confirmation);
  if (issue !== null) {
    console.error(ISSUE_MESSAGES[issue]);
    return 1;
  }
  const encodedHash = await hashPassword(password);
  const { sqlite, db } = openDatabase(path);
  try {
    setPasswordHash(db, encodedHash);
  } finally {
    sqlite.close();
  }
  console.log(`Password updated in ${path}. All sessions were revoked.`);
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "auth:set-password failed.");
  process.exitCode = 1;
}
