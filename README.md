# Friday night at the multiplex

A small, reusable cinema booking engine with an HTTP API and browser counter. It keeps every calculation in integer paise, so decimal floating-point errors cannot change the bill. The browser opens ready to use with the built-in cinema catalog and an initial quote.

## Run in GitHub Codespaces

Requires Node.js 20 or newer.

```bash
npm test
npm start
```

Open `http://localhost:3000` in the forwarded Ports panel. For live development, use `npm run dev`.

## Rules

- Seat classes are looked up case-insensitively. A quote fails when a class is missing or marked sold out.
- Festival discount is a flat rupee amount, limited to the ticket subtotal.
- Member discount is calculated after the festival discount and limited by `memberCap`.
- Convenience fee is per ticket and is added after discounts.
- GST is calculated on discounted tickets plus convenience fee. Percentages are rounded half-up to the nearest paisa.
- The importer trims names, accepts values such as `250`, `1,250.50`, and `₹1,250.50`, keeps the last valid duplicate case-insensitively, and reports imported, duplicate, and rejected rows.
- Negative, zero, blank, malformed, and blank-name rows are rejected with row-specific reasons. Imported names and report values are escaped before being rendered in the browser.

## Counter Experience

- The internal sample catalog loads automatically; users do not need to paste JSON or configure prices to start a booking.
- Click a Silver, Gold, or Recliner class to add it and recalculate the bill immediately. Seat names can also be edited directly as a comma-separated list.
- Changing the discount, fee, GST, or member setting recalculates the quote on change. The bill shows tickets, subtotal, discounts, fee, GST, and total due line by line.
- The header theme toggle switches between light and dark backgrounds, updates readable text colors and controls, and persists the choice in the browser.
- The layout adapts across desktop, tablet, and narrow mobile widths with touch-sized controls, wrapping text, no horizontal overflow, and a mobile bill summary.

## API

`POST /api/import-prices`

```json
{
	"prices": [
		{ "name": "Silver", "price": "₹250" },
		{ "name": "Gold", "price": "400.00" }
	]
}
```

The response includes `imported` rows, `deduplicated` rows with their replaced and retained prices, `rejected` rows with reasons, and summary counts: `importedCount`, `uniqueCount`, `duplicateCount`, and `rejectedCount`.

`POST /api/quote`

```json
{
	"seats": ["Silver", "Gold"],
	"priceList": { "Silver": 25000, "Gold": 40000 },
	"festivalDiscount": "50",
	"member": true,
	"memberPercent": 10,
	"memberCap": 15000,
	"convenienceFee": 250,
	"gstPercent": 18
}
```

All amounts in the API response are formatted for display and also returned as integer paise under `paise`.

## Structure

- `src/pricing.js`: pure importer, parser, formatter, and booking calculation.
- `src/server.js`: Node HTTP API and static-file server.
- `public/`: counter interface.
- `test/pricing.test.js`: money and validation regression tests.
- `AI_LOGS.md`: combined visible conversation and AI response log.
- `REASONING.md`: high-level implementation rationale and verification notes.