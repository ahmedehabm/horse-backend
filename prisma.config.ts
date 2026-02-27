import "dotenv/config";
import { defineConfig } from "prisma/config";

import dotenv from "dotenv";

// dotenv.config({ path: "./config.env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL env var");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    // url: DATABASE_URL + "&connection_limit=50",
    url: DATABASE_URL,
  },
});
