import "dotenv/config";

const intervalMs = 1000 * 60 * 10;

console.log("Worker online. Polling schedule configured.");

setInterval(() => {
  const now = new Date().toISOString();
  console.log(`[${now}] Worker heartbeat: ingestion/classification jobs placeholder.`);
}, intervalMs);
