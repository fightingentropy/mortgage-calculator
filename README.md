UK Property Net Yield Calculator

What this does
- Calculates after-tax net annual cash flow for a UK residential rental property
- Adjusts income tax using your other income and 2024/25 rUK bands
- Applies Section 24 (20% tax credit on mortgage interest)
- Computes SDLT with optional 3% additional property surcharge
- Shows net yield on purchase price, cash-on-cash return, and cap rate

How to use (Next.js)
1. Install dependencies:
   - `npm install`
2. Start the development server:
   - `npm run dev`
   - Then open `http://localhost:3000`.
3. Build for production:
   - `npm run build`
   - `npm start`
4. Fill in purchase, mortgage, rent, expenses, and your other taxable income.
5. Toggle "Additional property" to include the 3% SDLT surcharge. Results update instantly.

Run with a simple server (legacy)
- The previous static version (`index.html` + `app.js`) still exists for reference, but the recommended approach is the Next.js app above.

Key assumptions
- Income Tax (England/Northern Ireland/Wales) 2024/25:
  - Personal Allowance £12,570, tapered £1 per £2 over £100k (zero by £125,140)
  - 20% basic rate to £37,700; 40% higher to £125,140; 45% thereafter
- Section 24: mortgage interest is not deductible; instead a 20% tax credit applies, capped by the property profit (pre-finance). Loss/carry-forward not modelled.
- SDLT (residential): 0% to £250k, 5% £250k–£925k, 10% £925k–£1.5m, 12% above £1.5m; +3% surcharge for additional properties. First-time buyer relief not applied.
- Mortgage repayment schedules are simplified to first-year interest; repayment payments are calculated with a standard amortisation formula.
- National Insurance is ignored for property income.

Metrics shown
- Net annual cash flow after tax: cash you keep after mortgage payments and incremental tax.
- Net yield on purchase price: after-tax cash flow ÷ purchase price.
- Cash-on-cash return: after-tax cash flow ÷ total cash invested (deposit + SDLT + other purchase costs).
- Cap rate: NOI (pre-finance) ÷ purchase price.

Notes
- All figures are estimates for guidance only and not tax advice.
- Scotland/Wales devolved income tax/land taxes are not modelled.


