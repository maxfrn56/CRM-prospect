#!/usr/bin/env tsx
/**
 * Script cron local — relances J4/J7/J12
 * Usage: npm run cron:followups
 * En production: cron HTTP vers /api/cron/followups avec Bearer CRON_SECRET
 */

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET ?? "";

async function main() {
  const res = await fetch(`${baseUrl}/api/cron/followups`, {
    method: "POST",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
