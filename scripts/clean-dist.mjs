import { rmSync } from "node:fs";
import { resolve } from "node:path";

// Run from a package directory (npm workspace scripts): removes its dist/ so stale output never runs.
rmSync(resolve(process.cwd(), "dist"), { recursive: true, force: true });
