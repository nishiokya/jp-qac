# jp-qac working agreements

## Product direction

- Keep the API and browser SDK free to use, without registration, license keys, or usage-based feature gates.
- Present paid support as an optional way to get hands-on setup, integration, or operations help. Do not make it the main page message.
- Prefer practical, approachable Japanese over enterprise sales language, plan comparisons, or aggressive calls to action.
- Keep public tutorials complete enough for a first-time user to succeed without paid support.

## Documentation

- Update both `docs/tutorial.md` and `public/tutorial/index.html` when setup, routes, SDK usage, environment variables, or troubleshooting steps change.
- Keep the landing page focused on trying the demo and reaching the tutorial.
- Do not claim a feature, limit, support response time, or price unless it is implemented and currently offered.

## Validation

- Run `npm test`, `npm run typecheck`, and `npm run build` for code or configuration changes.
- For user-facing pages, also verify `/demo/lp/`, `/demo/tutorial/`, `/documentation`, and the SDK in a browser at the configured local port (3010 by default).
- Before publishing, confirm that secrets and `.env` are not tracked and that public links point to the intended repository and host.
