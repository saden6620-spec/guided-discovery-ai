const endpoints = [
  ["api-gateway", "http://127.0.0.1:3000/health"],
  ["auth-service", "http://127.0.0.1:3001/health"],
  ["user-service", "http://127.0.0.1:3002/health"],
  ["permission-service", "http://127.0.0.1:3003/health"],
  ["memory-service", "http://127.0.0.1:3004/health"],
  ["navigation-service", "http://127.0.0.1:3005/health"],
  ["recommendation-service", "http://127.0.0.1:3006/health"],
  ["learning-service", "http://127.0.0.1:3007/health"],
  ["documentation-service", "http://127.0.0.1:3008/health"],
  ["translation-service", "http://127.0.0.1:3009/health"],
  ["community-service", "http://127.0.0.1:3010/health"],
  ["notification-service", "http://127.0.0.1:3011/health"],
  ["media-service", "http://127.0.0.1:3012/health"],
  ["analytics-service", "http://127.0.0.1:3013/health"],
  ["search-service", "http://127.0.0.1:3014/health"],
  ["planning-service", "http://127.0.0.1:3015/health"],
  ["ai-orchestrator", "http://127.0.0.1:8000/health"],
  ["mobile-metro", "http://127.0.0.1:8081/status"],
];

const failures = [];

for (const [name, url] of endpoints) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      failures.push(`${name}: HTTP ${response.status}`);
    }
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  throw new Error(`Skeleton verification failed:\n${failures.join("\n")}`);
}
