'use client';

import { useMemo, useState } from 'react';

const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0
});

function formatCurrency(v) {
  return currencyFormatter.format(Math.round(v || 0));
}

function formatPercent(v) {
  const pct = Number.isFinite(v) ? v * 100 : 0;
  return `${pct.toFixed(2)}%`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computeSdlt(purchasePrice, isAdditional) {
  const bands = [
    { upTo: 250000, rate: 0.00 },
    { upTo: 925000, rate: 0.05 },
    { upTo: 1500000, rate: 0.10 },
    { upTo: Infinity, rate: 0.12 }
  ];
  let remaining = purchasePrice;
  let lastCap = 0;
  let tax = 0;
  for (const band of bands) {
    const portion = Math.max(0, Math.min(remaining, band.upTo - lastCap));
    tax += portion * band.rate;
    remaining -= portion;
    lastCap = band.upTo;
    if (remaining <= 0) break;
  }
  if (isAdditional) {
    tax += purchasePrice * 0.03;
  }
  return Math.max(0, Math.round(tax));
}

function computePersonalAllowance(grossIncome) {
  const base = 12570;
  if (grossIncome <= 100000) return base;
  const reduction = Math.floor((grossIncome - 100000) / 2);
  return Math.max(0, base - reduction);
}

function computeIncomeTax(grossIncome) {
  const personalAllowance = computePersonalAllowance(grossIncome);
  const taxable = Math.max(0, grossIncome - personalAllowance);
  const bands = [
    { upTo: 37700, rate: 0.20 },
    { upTo: 125140 - personalAllowance, rate: 0.40 },
    { upTo: Infinity, rate: 0.45 }
  ];
  let remaining = taxable;
  let lastCap = 0;
  let tax = 0;
  for (const band of bands) {
    const bandCap = band.upTo;
    const portion = Math.max(0, Math.min(remaining, bandCap - lastCap));
    tax += portion * band.rate;
    remaining -= portion;
    lastCap = bandCap;
    if (remaining <= 0) break;
  }
  return Math.max(0, tax);
}

function computeMortgageAnnuals(loanAmount, aprPercent, repaymentType, termYears) {
  const rMonthly = (aprPercent / 100) / 12;
  const interestAnnual = loanAmount * (aprPercent / 100);
  if (repaymentType === 'interest_only') {
    return { annualInterest: interestAnnual, annualRepayment: interestAnnual };
  }
  const n = termYears * 12;
  const paymentMonthly = rMonthly > 0
    ? loanAmount * (rMonthly * Math.pow(1 + rMonthly, n)) / (Math.pow(1 + rMonthly, n) - 1)
    : loanAmount / n;
  const paymentAnnual = paymentMonthly * 12;
  return { annualInterest: interestAnnual, annualRepayment: paymentAnnual };
}

export default function Page() {
  const [purchasePrice, setPurchasePrice] = useState(300000);
  const [isAdditional, setIsAdditional] = useState('yes');
  const [otherPurchaseCosts, setOtherPurchaseCosts] = useState(3000);
  const [ltvPercent, setLtvPercent] = useState(75);
  const [interestRatePercent, setInterestRatePercent] = useState(5.5);
  const [repaymentType, setRepaymentType] = useState('interest_only');
  const [termYears, setTermYears] = useState(25);
  const [salary, setSalary] = useState(60000);
  const [annualRent, setAnnualRent] = useState(21000);
  const [voidsPercent, setVoidsPercent] = useState(5);
  const [lettingPercent, setLettingPercent] = useState(10);
  const [maintenancePercent, setMaintenancePercent] = useState(8);
  const [insuranceAnnual, setInsuranceAnnual] = useState(300);
  const [serviceChargeAnnual, setServiceChargeAnnual] = useState(1200);
  const [otherAnnualExpenses, setOtherAnnualExpenses] = useState(300);

  const showTermYears = repaymentType === 'repayment';

  const computed = useMemo(() => {
    const ltv = clamp((Number(ltvPercent) || 0) / 100, 0, 1);
    const interestRate = Math.max(0, Number(interestRatePercent) || 0);
    const term = Math.max(1, Number(termYears) || 25);

    const salaryNum = Math.max(0, Number(salary) || 0);
    const rent = Math.max(0, Number(annualRent) || 0);
    const voids = clamp((Number(voidsPercent) || 0) / 100, 0, 1);
    const letting = clamp((Number(lettingPercent) || 0) / 100, 0, 1);
    const maintenance = clamp((Number(maintenancePercent) || 0) / 100, 0, 1);
    const insurance = Math.max(0, Number(insuranceAnnual) || 0);
    const service = Math.max(0, Number(serviceChargeAnnual) || 0);
    const otherAnnual = Math.max(0, Number(otherAnnualExpenses) || 0);

    const price = Math.max(0, Number(purchasePrice) || 0);
    const loanAmount = price * ltv;
    const deposit = price - loanAmount;
    const sdlt = computeSdlt(price, isAdditional === 'yes');
    const cashInvested = deposit + sdlt + (Number(otherPurchaseCosts) || 0);

    const rentAfterVoids = rent * (1 - voids);
    const lettingFee = rentAfterVoids * letting;
    const maintenanceCost = rentAfterVoids * maintenance;
    const operatingExpenses = lettingFee + maintenanceCost + insurance + service + otherAnnual;
    const noi = Math.max(0, rentAfterVoids - operatingExpenses);

    const { annualInterest, annualRepayment } = computeMortgageAnnuals(loanAmount, interestRate, repaymentType, term);
    const cashFlowPreTax = rentAfterVoids - operatingExpenses - annualRepayment;

    const propertyProfitPreFinance = Math.max(0, rentAfterVoids - operatingExpenses);
    const baselineTax = computeIncomeTax(salaryNum);
    const totalTaxWithProperty = computeIncomeTax(salaryNum + propertyProfitPreFinance);
    const financeCosts = annualInterest;
    const s24Credit = 0.20 * Math.max(0, Math.min(financeCosts, propertyProfitPreFinance));
    const incrementalTaxDue = Math.max(0, totalTaxWithProperty - baselineTax - s24Credit);
    const netCashAfterTax = cashFlowPreTax - incrementalTaxDue;

    const netYieldOnPurchasePrice = price > 0 ? (netCashAfterTax / price) : 0;
    const cashOnCash = cashInvested > 0 ? (netCashAfterTax / cashInvested) : 0;
    const capRate = price > 0 ? (noi / price) : 0;

    return {
      deposit,
      sdlt,
      otherPurchaseCosts: Number(otherPurchaseCosts) || 0,
      cashInvested,
      rentAfterVoids,
      lettingFee,
      maintenanceCost,
      insurance,
      service,
      otherAnnual,
      noi,
      loanAmount,
      annualInterest,
      annualRepayment,
      s24Credit,
      propertyProfitPreFinance,
      incrementalTaxDue,
      netCashAfterTax,
      netYieldOnPurchasePrice,
      cashOnCash,
      capRate
    };
  }, [
    purchasePrice,
    isAdditional,
    otherPurchaseCosts,
    ltvPercent,
    interestRatePercent,
    repaymentType,
    termYears,
    salary,
    annualRent,
    voidsPercent,
    lettingPercent,
    maintenancePercent,
    insuranceAnnual,
    serviceChargeAnnual,
    otherAnnualExpenses
  ]);

  function resetDefaults() {
    setPurchasePrice(300000);
    setIsAdditional('yes');
    setOtherPurchaseCosts(3000);
    setLtvPercent(75);
    setInterestRatePercent(5.5);
    setRepaymentType('interest_only');
    setTermYears(25);
    setSalary(60000);
    setAnnualRent(21000);
    setVoidsPercent(5);
    setLettingPercent(10);
    setMaintenancePercent(8);
    setInsuranceAnnual(300);
    setServiceChargeAnnual(1200);
    setOtherAnnualExpenses(300);
  }

  return (
    <>
      <header className="app-header">
        <h1>UK Property Net Yield Calculator</h1>
        <p className="subtitle">After expenses, mortgage and income tax (Section 24 aware)</p>
      </header>

      <main className="container">
        <section className="card inputs">
          <h2>Inputs</h2>
          <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
            <div className="section">
              <h3>Property & Purchase</h3>
              <div className="grid two">
                <label className="field">
                  <span>Purchase price (£)</span>
                  <input type="number" min="0" step="1000" value={purchasePrice}
                         onChange={(e) => setPurchasePrice(Number(e.target.value))} />
                </label>
                <label className="field">
                  <span className="help" title="Select Yes if this is an additional residential property. Adds the 3% SDLT surcharge on the entire purchase price.">Additional property (3% SDLT)?</span>
                  <select value={isAdditional} onChange={(e) => setIsAdditional(e.target.value)}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
                <label className="field">
                  <span className="help" title="Legal fees, searches, survey/valuation, broker fees, mortgage fees, and similar one-time costs at purchase.">Other one-off purchase costs (£)</span>
                  <input type="number" min="0" step="100" value={otherPurchaseCosts}
                         onChange={(e) => setOtherPurchaseCosts(Number(e.target.value))} />
                </label>
              </div>
            </div>

            <div className="section">
              <h3>Mortgage</h3>
              <div className="grid two">
                <label className="field">
                  <span className="help" title="Loan-to-Value: mortgage amount ÷ purchase price × 100. Deposit equals (1 − LTV) × price.">LTV (%)</span>
                  <input type="number" min="0" max="100" step="1" value={ltvPercent}
                         onChange={(e) => setLtvPercent(Number(e.target.value))} />
                </label>
                <label className="field">
                  <span className="help" title="Mortgage annual interest rate (APR). Used to calculate yearly interest and repayments.">Interest rate (APR %)</span>
                  <input type="number" min="0" step="0.01" value={interestRatePercent}
                         onChange={(e) => setInterestRatePercent(Number(e.target.value))} />
                </label>
                <label className="field">
                  <span className="help" title="Interest-only: pay interest only. Repayment: amortised payments covering interest and principal over the term.">Repayment type</span>
                  <select value={repaymentType} onChange={(e) => setRepaymentType(e.target.value)}>
                    <option value="interest_only">Interest-only</option>
                    <option value="repayment">Repayment</option>
                  </select>
                </label>
                {showTermYears && (
                  <label className="field">
                    <span className="help" title="Mortgage length in years. Only affects the monthly/annual payment when Repayment is selected.">Term (years)</span>
                    <input type="number" min="1" max="40" step="1" value={termYears}
                           onChange={(e) => setTermYears(Number(e.target.value))} />
                  </label>
                )}
              </div>
            </div>

            <div className="section">
              <h3>Your Income</h3>
              <div className="grid two">
                <label className="field">
                  <span className="help" title="Your other taxable income (e.g., salary). Used to place rental profits into the correct income tax bands. NI not included.">Other taxable income (£/yr)</span>
                  <input type="number" min="0" step="1000" value={salary}
                         onChange={(e) => setSalary(Number(e.target.value))} />
                </label>
              </div>
            </div>

            <div className="section">
              <h3>Rent & Annual Expenses</h3>
              <div className="grid two">
                <label className="field">
                  <span>Gross rent (£/yr)</span>
                  <input type="number" min="0" step="100" value={annualRent}
                         onChange={(e) => setAnnualRent(Number(e.target.value))} />
                </label>
                <label className="field">
                  <span className="help" title="Estimated percentage of annual rent lost due to vacancies and non-payment. The model reduces rent by this percentage.">Voids (%)</span>
                  <input type="number" min="0" max="100" step="0.5" value={voidsPercent}
                         onChange={(e) => setVoidsPercent(Number(e.target.value))} />
                </label>
                <label className="field">
                  <span className="help" title="Letting agent/management fees as a percent of rent after voids.">Letting/management fee (% of rent)</span>
                  <input type="number" min="0" max="100" step="0.5" value={lettingPercent}
                         onChange={(e) => setLettingPercent(Number(e.target.value))} />
                </label>
                <label className="field">
                  <span className="help" title="Annual allowance for routine repairs and wear-and-tear. Not capital improvements.">Maintenance reserve (% of rent)</span>
                  <input type="number" min="0" max="100" step="0.5" value={maintenancePercent}
                         onChange={(e) => setMaintenancePercent(Number(e.target.value))} />
                </label>
                <label className="field">
                  <span>Insurance (£/yr)</span>
                  <input type="number" min="0" step="50" value={insuranceAnnual}
                         onChange={(e) => setInsuranceAnnual(Number(e.target.value))} />
                </label>
                <label className="field">
                  <span className="help" title="Leasehold costs typically charged by the freeholder or management company.">Service charge + ground rent (£/yr)</span>
                  <input type="number" min="0" step="50" value={serviceChargeAnnual}
                         onChange={(e) => setServiceChargeAnnual(Number(e.target.value))} />
                </label>
                <label className="field">
                  <span className="help" title="Any other recurring costs (e.g., compliance, utilities you cover, council tax during voids).">Other annual expenses (£/yr)</span>
                  <input type="number" min="0" step="50" value={otherAnnualExpenses}
                         onChange={(e) => setOtherAnnualExpenses(Number(e.target.value))} />
                </label>
              </div>
            </div>

            <div className="actions">
              <button type="button" className="secondary" onClick={resetDefaults}>Reset defaults</button>
            </div>
          </form>
        </section>

        <section className="card results">
          <h2>Results</h2>
          <div className="highlights">
            <div className="kpi">
              <div className="kpi-label"><span className="help" title="Cash left after operating costs, mortgage payments, and incremental income tax.">Net annual cash flow (after tax)</span></div>
              <div className="kpi-value">{formatCurrency(computed.netCashAfterTax)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label"><span className="help" title="After-tax cash flow ÷ purchase price.">Net yield on purchase price</span></div>
              <div className="kpi-value">{formatPercent(computed.netYieldOnPurchasePrice)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label"><span className="help" title="After-tax cash flow ÷ total cash invested (deposit + SDLT + purchase costs).">Cash-on-cash return</span></div>
              <div className="kpi-value">{formatPercent(computed.cashOnCash)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label"><span className="help" title="NOI (pre-finance) ÷ purchase price.">Cap rate (pre-finance)</span></div>
              <div className="kpi-value">{formatPercent(computed.capRate)}</div>
            </div>
          </div>

          <div className="breakdown">
            <h3>Breakdown</h3>

            <div className="table">
              <div className="row header"><span>Cash invested</span><span></span></div>
              <div className="row"><span>Deposit</span><span>{formatCurrency(computed.deposit)}</span></div>
              <div className="row"><span>Stamp Duty Land Tax (SDLT)</span><span>{formatCurrency(computed.sdlt)}</span></div>
              <div className="row"><span>Other purchase costs</span><span>{formatCurrency(computed.otherPurchaseCosts)}</span></div>
              <div className="row total"><span>Total cash invested</span><span>{formatCurrency(computed.cashInvested)}</span></div>
            </div>

            <div className="table">
              <div className="row header"><span>Operating</span><span></span></div>
              <div className="row"><span className="help" title="Gross rent reduced by the voids percentage.">Rent after voids</span><span>{formatCurrency(computed.rentAfterVoids)}</span></div>
              <div className="row"><span className="help" title="Letting/management costs based on rent after voids.">Letting/management</span><span>{formatCurrency(computed.lettingFee)}</span></div>
              <div className="row"><span className="help" title="Ongoing repairs allowance set as a percent of rent after voids.">Maintenance reserve</span><span>{formatCurrency(computed.maintenanceCost)}</span></div>
              <div className="row"><span className="help" title="Annual insurance premium.">Insurance</span><span>{formatCurrency(computed.insurance)}</span></div>
              <div className="row"><span className="help" title="Service charge and ground rent if leasehold.">Service charge + ground</span><span>{formatCurrency(computed.service)}</span></div>
              <div className="row"><span className="help" title="Other recurring operating costs.">Other annual</span><span>{formatCurrency(computed.otherAnnual)}</span></div>
              <div className="row total"><span className="help" title="Net Operating Income: rent after voids minus operating expenses, before mortgage costs.">NOI (pre-finance)</span><span>{formatCurrency(computed.noi)}</span></div>
            </div>

            <div className="table">
              <div className="row header"><span>Mortgage</span><span></span></div>
              <div className="row"><span className="help" title="Purchase price × LTV.">Loan amount</span><span>{formatCurrency(computed.loanAmount)}</span></div>
              <div className="row"><span className="help" title="Year-one interest using APR × loan amount.">Annual interest</span><span>{formatCurrency(computed.annualInterest)}</span></div>
              <div className="row"><span className="help" title="Total mortgage payments in a year. For interest-only this equals the interest; for repayment this is the amortised payment.">Annual repayment</span><span>{formatCurrency(computed.annualRepayment)}</span></div>
              <div className="row"><span className="help" title="Section 24: 20% tax credit on eligible interest, capped by pre-finance property profit.">Section 24 credit (20% of allowed)</span><span>{formatCurrency(computed.s24Credit)}</span></div>
            </div>

            <div className="table">
              <div className="row header"><span>Tax</span><span></span></div>
              <div className="row"><span className="help" title="Property profit used for income tax: NOI before mortgage costs.">Taxable property profit (pre-finance)</span><span>{formatCurrency(computed.propertyProfitPreFinance)}</span></div>
              <div className="row"><span className="help" title="Extra income tax triggered by the property after Section 24 credit.">Incremental tax due</span><span>{formatCurrency(computed.incrementalTaxDue)}</span></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>
          This tool estimates UK residential property net yield using 2024/25 rUK income tax bands and SDLT with a 3% additional property surcharge when selected. It applies Section 24 (20% credit) to mortgage interest. For guidance only, not tax advice.
        </p>
      </footer>
    </>
  );
}


