#!/usr/bin/env node
/**
 * Manually trigger the resume ETL cron route for local testing.
 *
 * Usage:
 *   npm run etl:trigger
 *   npm run etl:trigger -- --url http://localhost:3000
 *
 * Reads CRON_SECRET from .env (via dotenv) and calls
 * GET /api/cron/etl-resumes with the required Authorization header.
 */
require("dotenv").config();

const args = process.argv.slice(2);
const urlFlagIndex = args.indexOf("--url");
const baseUrl =
  (urlFlagIndex !== -1 && args[urlFlagIndex + 1]) ||
  process.env.APP_URL ||
  "http://localhost:3000";

const cronSecret = process.env.CRON_SECRET;

if (!cronSecret) {
  console.error("CRON_SECRET is not set in .env — cannot trigger ETL.");
  process.exit(1);
}

async function main() {
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/cron/etl-resumes`;
  console.log(`Triggering ETL: GET ${endpoint}`);

  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  console.log(`Status: ${res.status}`);
  console.log(JSON.stringify(body, null, 2));

  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error("ETL trigger failed:", err);
  process.exit(1);
});
