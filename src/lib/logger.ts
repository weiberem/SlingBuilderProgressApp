import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

export const logger = pino({
  level,
  redact: {
    paths: ["*.password", "*.access_token", "*.refresh_token", "*.token", "req.headers.cookie"],
    censor: "[redacted]",
  },
});

export type Logger = typeof logger;
