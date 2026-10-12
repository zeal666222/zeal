# Astro Worker (zeal-astro)

Cloudflare Worker providing REST API endpoints for astrology calculations. Deployable with `npx wrangler deploy`.

## Deployment

```bash
cd apps/astro-worker
npx wrangler deploy
```

The worker will be available at `https://zeal-astro.<your-subdomain>.workers.dev`.

## API Reference

### Health Check
```
GET /api/health
```
Returns service status and available capabilities.

### Vedic Chart
```
POST /api/chart/vedic
Content-Type: application/json

{
  "birthDate": "1869-10-02",
  "birthTime": "19:00",
  "birthPlace": { "lat": 21.6417, "lng": 69.6033 },
  "chartType": "rashi" | "navamsa" | "divisional",
  "divisionalNumber": 9  // only for chartType: "divisional"
}
```
Returns: Rashi/Navamsa/Divisional chart + Shadbala + Ashtakavarga + Panchanga.

### Western Chart
```
POST /api/chart/western
Content-Type: application/json

{
  "birthDate": "1869-10-02",
  "birthTime": "19:00",
  "birthPlace": { "lat": 21.6417, "lng": 69.6033 },
  "houseSystem": "placidus" | "whole-sign" | "koch" | "equal"
}
```
Returns: Western natal chart with planets, houses, and aspects.

### Chinese BaZi
```
POST /api/chart/chinese
Content-Type: application/json

{
  "birthDate": "1869-10-02",
  "birthTime": "19:00"
}
```
Returns: Four Pillars with Day Master, Ten Gods, and Luck Pillars.

### Vimshottari Dasha
```
POST /api/dasha
Content-Type: application/json

{
  "birthDate": "1869-10-02",
  "birthTime": "19:00",
  "birthPlace": { "lat": 21.6417, "lng": 69.6033 }
}
```
Returns: All 9 Mahardashas with Antardashas, plus current Dasha period.

### Transits
```
POST /api/transit
Content-Type: application/json

{
  "birthDate": "1869-10-02",
  "birthTime": "19:00",
  "birthPlace": { "lat": 21.6417, "lng": 69.6033 },
  "transitDate": "2024-01-01"
}
```
Returns: Both Vedic and Western transit data with aspects to natal chart.

## Error Handling

All endpoints return:
```json
{
  "success": true | false,
  "data": { ... },      // on success
  "error": "message"    // on failure
}
```

- **400**: Invalid input data (missing fields, bad format)
- **404**: Unknown route
- **500**: Computation error

## CORS

CORS is enabled for all origins (`Access-Control-Allow-Origin: *`). In production, restrict to `*.zeal.*` domains.

## Local Development

```bash
cd apps/astro-worker
npx wrangler dev
```

The worker runs at `http://localhost:8787`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Deployment environment | `production` |

## Web App Integration

The web app (`apps/web`) includes an HTTP client at `lib/astrology/client.ts` that calls this worker. Set `ASTRO_WORKER_URL` in `apps/web/.env.local`:

```
ASTRO_WORKER_URL=http://localhost:8787  # local
ASTRO_WORKER_URL=https://zeal-astro.workers.dev  # production
```

Test endpoint: `POST /api/astrology/test` in the web app.
