// Prisma 7 configuration file
// Connection URLs are managed here instead of schema.prisma
// See: https://pris.ly/d/config-datasource
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? (() => { throw new Error("DATABASE_URL env var is not set") })(),
    directUrl: process.env["DIRECT_URL"],
  },
});
