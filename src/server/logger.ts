import pino from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    service: "studio-mcleod",
    environment: config.nodeEnv,
  },
});
