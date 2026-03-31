import "dotenv/config";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
const intervalMs = 1000 * 60 * 60 * 6;
const runOnce = process.env.WORKER_RUN_ONCE === "true";

async function triggerDiscovery() {
  const startedAt = new Date().toISOString();
  console.log(`[${startedAt}] Triggering curated problem discovery refresh...`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(`${apiBaseUrl}/api/problems/discover/refresh`, {
      method: "POST",
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Refresh failed (${response.status})`);
    }

    const payload = (await response.json()) as { discoveredCount: number };
    console.log(`[${new Date().toISOString()}] Discovery refresh complete. Problems indexed: ${payload.discoveredCount}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    console.error(`[${new Date().toISOString()}] Discovery refresh failed: ${message}`);
  }
}

void triggerDiscovery();

if (!runOnce) {
  console.log(`Curated discovery worker online. Refreshing every ${intervalMs / (1000 * 60 * 60)} hours.`);
  setInterval(() => {
    void triggerDiscovery();
  }, intervalMs);
}
