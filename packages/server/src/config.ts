export interface AppConfig {
  // Exact origin allowed on mutations, e.g. https://suivi.example.ts.net (PROJECT.md §Security).
  readonly appOrigin: string;
}

export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

// Fails fast: the server must not start without an origin to check against.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const appOrigin = env.APP_ORIGIN;
  if (appOrigin === undefined || !isOrigin(appOrigin)) {
    throw new Error("APP_ORIGIN must be set to an origin such as https://host.example.ts.net (no path, no trailing slash)");
  }
  return { appOrigin };
}

function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value;
  } catch {
    return false;
  }
}
