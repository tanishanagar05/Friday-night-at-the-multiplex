# Solution Reasoning

## Goal

Build a reusable cinema pricing engine that produces an exact-paisa total, explains every bill component, rejects invalid bookings, and imports messy seat-class prices safely.

## Design Decisions

### Integer paise

All calculations use integer paise rather than JavaScript floating-point rupees. This prevents values such as `0.1 + 0.2` from affecting the final bill. Display formatting happens only at the output boundary.

### Pricing order

The calculation follows a fixed, explicit order:

1. Add the selected seat-class prices to get the ticket subtotal.
2. Apply the flat festival discount, limited to the subtotal.
3. Apply the member percentage discount to the reduced subtotal.
4. Apply the member discount cap.
5. Add the per-ticket convenience fee.
6. Calculate GST on the discounted tickets plus the convenience fee.
7. Add the taxable amount, fee, and GST for the final total.

Percentage amounts are rounded half-up to the nearest paisa.

### Seat-price import

The importer trims seat names and accepts common money formats such as `250`, `1,250.50`, and `₹1,250.50`. Blank names, blank values, malformed values, zero prices, and negative prices are rejected with row indexes and reasons.

Duplicate names are compared case-insensitively. The last valid duplicate is retained as the canonical price, while the import report records the duplicate count and all accepted rows.

### Validation

The pricing engine rejects empty bookings, missing price lists, unknown seat classes, sold-out classes, invalid percentages, and malformed monetary values. These failures become HTTP 400 responses from the API.

### Automatic catalog and browser safety

The counter imports its built-in sample catalog on startup rather than asking counter staff to paste JSON. The imported catalog and audit still come from the same importer API, so the production path exercises the real cleaning logic while the interface stays focused on booking. The browser escapes imported names, ticket labels, prices, and rejection messages before inserting them into the page.

### Interaction and responsive behavior

Seat-class controls are direct actions: clicking one appends the class and requests a fresh quote. Pricing fields and the member toggle recalculate on change. The total receives a small update animation, and the clear action resets both the selected seats and every displayed bill amount. The responsive layout uses grid breakpoints for tablet and mobile widths, touch-sized controls, safe text wrapping, overflow protection, and a sticky mobile bill summary. A persisted light/dark theme changes the page, cards, forms, bill, and text variables together.

### Project shape

- `src/pricing.js` contains pure business logic so it can be tested independently of HTTP or browser code.
- `src/server.js` provides the API and serves the frontend without requiring a separate backend framework.
- `public/` contains the browser counter and line-by-line bill.
- `test/pricing.test.js` protects the money rules and importer behavior.
- `.devcontainer/devcontainer.json` makes the project open and test consistently in GitHub Codespaces.
- `AI_LOGS.md` records the visible project conversation and implementation responses in one file.
- `REASONING.md` records these implementation decisions without reproducing private chain-of-thought.

## Verification

The implementation was checked with:

```bash
npm test
node --check public/app.js
git diff --check
```

The test suite covers money parsing, duplicate and rejected imports, discount ordering and caps, exact GST arithmetic, unavailable classes, and sold-out classes. The browser and server entrypoints are syntax-checked, and the API was smoke-tested through `/api/import-prices`, `/api/quote`, and the browser root route.

## Scope Note

This file records implementation decisions and verifiable rationale. It does not reproduce private chain-of-thought or hidden system/developer instructions.