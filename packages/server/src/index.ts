import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db/connection.js";
import { databasePathFromEnv } from "./db/paths.js";

const config = loadConfig();
// Empty values count as unset: an empty HOST must not bind every interface.
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";

// Migrations are not run here: they stay an explicit `npm run db:migrate`.
const { db } = openDatabase(databasePathFromEnv());
const app = createApp({ db, config });

app.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});
