const buckets = new Map();

function now() {
  return Date.now();
}

function cleanup(time) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= time) buckets.delete(key);
  }
}

export function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim();
}

export function rateLimit(key, { limit = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const time = now();
  cleanup(time);
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= time) {
    buckets.set(key, { count: 1, resetAt: time + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfter: Math.ceil(windowMs / 1000) };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((existing.resetAt - time) / 1000) };
  }

  return { allowed: true, remaining: Math.max(0, limit - existing.count), retryAfter: Math.ceil((existing.resetAt - time) / 1000) };
}
