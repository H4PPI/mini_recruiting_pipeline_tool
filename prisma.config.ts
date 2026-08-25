import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL = non-pooled Neon connection string.
    // Used only by the Prisma CLI (migrate, generate, studio).
    // Runtime queries use DATABASE_URL (pooled) via the PrismaPg adapter in lib/db.ts.
    url: process.env.DIRECT_URL ?? "",
  },
});
