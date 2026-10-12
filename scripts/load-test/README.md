# Load Testing — Zeal Platform

## Prerequisites

Install [k6](https://k6.io/docs/getting-started/installation/):

```bash
# macOS
brew install k6

# Linux (apt)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows (scoop)
scoop install k6
```

## Configuration

Set environment variables before running tests:

```bash
export BASE_URL=http://localhost:3000        # or your staging URL
export AUTH_TOKEN=eyJhbGciOi...              # test user JWT (optional, for authenticated endpoints)
```

Or create a `.env` file in `scripts/load-test/`:

```
BASE_URL=http://localhost:3000
AUTH_TOKEN=eyJhbGciOi...
```

## Running Tests

### Individual scenarios

```bash
# Homepage — 100 VUs, 5 min
k6 run scripts/load-test/scenarios/homepage.js

# Explore — 50 VUs, 5 min
k6 run scripts/load-test/scenarios/explore.js

# AI Chat — 20 VUs, 10 min
k6 run scripts/load-test/scenarios/chat.js

# Astrology — 30 VUs, 5 min
k6 run scripts/load-test/scenarios/astrology.js

# Mixed workload — 100 VUs, 15 min
k6 run scripts/load-test/scenarios/mixed.js
```

### With custom load

```bash
k6 run --vus 50 --duration 5m scripts/load-test/scenarios/homepage.js
```

### With output to file

```bash
k6 run --out json=results.json scripts/load-test/scenarios/mixed.js
```

### With cloud output (requires k6 Cloud account)

```bash
k6 run --out cloud scripts/load-test/scenarios/mixed.js
```

## Interpreting Results

### Key metrics

| Metric | What it means | Target |
|--------|--------------|--------|
| `http_req_duration p(95)` | 95th percentile response time | < 2s |
| `http_req_duration p(99)` | 99th percentile response time | < 5s |
| `http_req_failed` | Error rate | < 5% |
| `http_reqs` | Requests per second | > 500 (homepage) |
| `vus` | Active virtual users | As configured |
| `iterations` | Total scenario iterations | - |

### Thresholds

Each scenario defines thresholds that must pass. If a threshold fails, k6 exits with code 99:

```
✓ http_req_duration..............: p(95)=1.2s p(99)=3.1s
  ✓ p(95)<2000
  ✗ p(99)<5000  ← FAILED
```

### Common failure modes

1. **High p(95) latency** → DB slow queries, cold starts, or API rate limits
2. **High error rate** → Server crashes, OOM, or connection pool exhaustion
3. **Low throughput** → Single-threaded bottleneck, DB connection limits

## Load Test Targets

| Endpoint | Target RPS | VUs | Notes |
|----------|-----------|-----|-------|
| Homepage `/` | 1000 | 100 | Mostly cached, should be fast |
| Explore `/explore` | 500 | 50 | DB queries for search |
| AI Chat `/api/chat/ai/*` | 100 concurrent | 20 | LLM latency dominates |
| Astrology `/api/astrology/*` | 300 | 30 | Cloudflare Worker compute |
| Mixed | 200+ | 100 | Realistic user distribution |

## Pre-launch Checklist

- [ ] Run `mixed.js` against staging
- [ ] Verify p(95) < 3s for all endpoints
- [ ] Verify error rate < 1%
- [ ] Check DB connection pool isn't exhausted (monitor `X-Pool-Active` headers)
- [ ] Check Supabase Realtime handles concurrent WebSocket connections
- [ ] Verify AI chat rate limiting kicks in at expected thresholds
- [ ] Run for at least 15 minutes to catch memory leaks
