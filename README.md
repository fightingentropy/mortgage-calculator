UK Property Calculator (Buy vs Rent + Buy‑to‑Let)

What this is
- Interactive UK property calculator with two modes:
  - Buy vs Rent (owner‑occupier)
  - Buy‑to‑Let (investment)
- Built with vanilla JS and a minimal Bun server for local hosting.

Key features
- Dual modes with instant recalculation and mode‑specific outputs
- Mortgage: repayment or interest‑only; APR; term in years
- Deposit: fixed £ amount or % of price; product fee paid upfront or added to loan
- Taxes: SDLT by buyer type (first‑time buyer, standard, additional property with 3% surcharge and optional refund toggle)
- CGT: choose 18%, 24%, or a blended estimate; configurable annual allowance; PRR toggle (last 9 months deemed occupied)
- Economics & exit: house‑price growth (HPI), CPI inflation, discount rate, sell/no‑sell at term end, agent fee + VAT, sale legal fees
- Capex schedule: add arbitrary yearly capital expenditures
- KPIs: Nominal IRR, Real IRR (deflated by CPI), NPV, Total cash in, Net proceeds/Equity at end, Payback year
- Owner outputs: Year owning becomes cheaper than renting; Year‑1 breakeven rent (£/mo)
- BTL outputs: Year cashflow turns positive; detailed per‑year P&L
- Visuals: stacked cashflow chart; value vs debt chart
- Sensitivity: clickable heatmaps (Price growth × Rent growth; Interest rate × Deposit)
- Export/print: CSV export of annual series; print‑friendly summary

How to use (static site)
1. Open `index.html` directly in your browser, or
2. Serve locally with Bun:
   - `bun run dev` (watches files)
   - or `bun start`
3. Open `http://localhost:3000`.

Inputs
- Property & purchase: purchase price; deposit type/value; other purchase fees; product fee; product fee treatment
- Mortgage: type (repayment/interest‑only); APR; term (years)
- Economics & exit: HPI growth; CPI; discount rate; sell at end; agent fee; VAT on agent fee; legal fees on sale; capex schedule
- Taxes: buyer type (SDLT); surcharge refund toggle; CGT rate; CGT annual allowance; PRR main residence toggle
- Owner‑occupier: current rent; rent inflation; maintenance % of value; service charge; buildings insurance; ground rent
- Buy‑to‑Let: market rent; voids %; management fee %; compliance & safety (£/yr); landlord tax band (20/40/45%); Section 24 on/off

Outputs & UI
- Summary KPIs: Nominal IRR, Real IRR, NPV, Total cash in, Net proceeds/Equity, Payback year
- Mode‑specific tables: amortisation; BTL P&L (investment mode)
- Charts: cashflow composition; value vs debt over time
- Sensitivity heatmaps update inputs on click
- Actions: Reset defaults; Download CSV; Print summary

CSV export format
- Columns: Year, Value, Debt, Income, Opex, Interest, Principal, Tax, Capex, Net

Files
- `index.html`: UI markup
- `styles.css`: Styling and print rules
- `script.js`: Calculator logic, charts, heatmaps, CSV export
- `server.js`: Minimal Bun static file server (default port 3000)
- `package.json`: Bun scripts (`dev`, `start`)
- `favicon.svg`: App icon

Assumptions & limitations
- Section 24: mortgage interest is not deductible; a 20% tax credit applies, capped by pre‑finance property profit
- SDLT (residential): 0% to £250k; 5% £250k–£925k; 10% £925k–£1.5m; 12% above £1.5m; +3% surcharge for additional properties; first‑time buyer relief up to £625k
- CGT: 18%/24% rates or blended estimate; annual allowance configurable; PRR models last 9 months deemed occupied
- Mortgage: standard amortisation for repayment; interest‑only modeled with bullet principal
- National Insurance ignored; Scotland/Wales devolved income/land taxes not modeled
- Estimates only. Not tax advice.

