// Prisma 7 configuration file
// Connection URLs are managed here instead of schema.prisma
// See: https://pris.ly/d/config-datasource
import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datasource: {
    url: process.env["DATABASE_URL"] ?? (() => { throw new Error("DATABASE_URL env var is not set") })(),
    directUrl: process.env["DIRECT_URL"],
  } as any,
});
