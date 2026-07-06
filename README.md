# jp-qac

Japanese postal-code and corporate autocomplete API.

## Quick start

```bash
npm install
npm run data:postal
cp .env.example .env
npm run dev
```

Open `http://localhost:3000/` for the API documentation and
`http://localhost:3000/demo/` for the small verification client.

- `http://localhost:3000/demo/lp/` — landing page with a live SDK demo
- `http://localhost:3000/demo/sdk/jp-qac.js` / `jp-qac.css` — the browser SDK
  (design notes in `docs/sdk-design.md`)

The postal importer downloads Japan Post's official UTF-8, one-record-per-line
dataset and stores it in `data/jp-qac.sqlite`.

Corporate-name search uses the National Tax Agency Web API when
`NTA_APPLICATION_ID` is configured. The application ID is deliberately kept on
the server and is never exposed to the browser.

## API

- `GET /health`
- `GET /v1/postal-codes/:postalCode`
- `GET /v1/corporations?name=...&limit=10`
- `GET /v1/corporations/:corporateNumber`
- `GET /documentation`

Successful responses use `{ "data": ..., "meta": ... }`. Errors use
`{ "error": { "code", "message", "details?", "requestId" } }`.

Postal codes accept `100-0001`, `１００－０００１`, and `1000001`. Corporate
numbers accept ASCII/full-width digits and optional separators.

## Commands

```bash
npm test             # unit and API tests
npm run typecheck    # TypeScript validation
npm run build        # production build
npm start            # run dist/server.js
npm run data:postal  # refresh the Japan Post dataset atomically
```

## Data attribution

Postal data is sourced from Japan Post. Corporate data is based on the National
Tax Agency Corporate Number Publication Site Web API. When publishing a service
using the NTA data, display the attribution/disclaimer required by its terms.
