/*
  UK Property Net Yield Calculator
  Assumptions: 2024/25 rUK income tax bands, Section 24 credit at 20%, residential SDLT bands with 3% surcharge for additional properties.
  This is a first-year estimate. Mortgage repayment schedules are simplified to first-year interest.
*/

(function () {
  const currency = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
  const percent = (v) => `${(v * 100).toFixed(2)}%`;

  // Inputs
  const el = {
    purchasePrice: document.getElementById("purchasePrice"),
    isAdditional: document.getElementById("isAdditional"),
    otherPurchaseCosts: document.getElementById("otherPurchaseCosts"),
    ltvPercent: document.getElementById("ltvPercent"),
    interestRatePercent: document.getElementById("interestRatePercent"),
    repaymentType: document.getElementById("repaymentType"),
    termYears: document.getElementById("termYears"),
    termYearsWrap: document.getElementById("termYearsWrap"),
    salary: document.getElementById("salary"),
    annualRent: document.getElementById("annualRent"),
    voidsPercent: document.getElementById("voidsPercent"),
    lettingPercent: document.getElementById("lettingPercent"),
    maintenancePercent: document.getElementById("maintenancePercent"),
    insuranceAnnual: document.getElementById("insuranceAnnual"),
    serviceChargeAnnual: document.getElementById("serviceChargeAnnual"),
    otherAnnualExpenses: document.getElementById("otherAnnualExpenses"),
    resetBtn: document.getElementById("resetBtn"),
  };

  // Outputs
  const out = {
    netCashAfterTax: document.getElementById("netCashAfterTax"),
    netYieldOnPrice: document.getElementById("netYieldOnPrice"),
    cashOnCash: document.getElementById("cashOnCash"),
    capRate: document.getElementById("capRate"),
    depositOut: document.getElementById("depositOut"),
    sdltOut: document.getElementById("sdltOut"),
    otherPurchaseCostsOut: document.getElementById("otherPurchaseCostsOut"),
    cashInvestedOut: document.getElementById("cashInvestedOut"),
    rentAfterVoidsOut: document.getElementById("rentAfterVoidsOut"),
    lettingOut: document.getElementById("lettingOut"),
    maintenanceOut: document.getElementById("maintenanceOut"),
    insuranceOut: document.getElementById("insuranceOut"),
    serviceOut: document.getElementById("serviceOut"),
    otherAnnualOut: document.getElementById("otherAnnualOut"),
    noiOut: document.getElementById("noiOut"),
    loanAmountOut: document.getElementById("loanAmountOut"),
    annualInterestOut: document.getElementById("annualInterestOut"),
    annualRepaymentOut: document.getElementById("annualRepaymentOut"),
    s24CreditOut: document.getElementById("s24CreditOut"),
    taxableProfitOut: document.getElementById("taxableProfitOut"),
    incrementalTaxOut: document.getElementById("incrementalTaxOut"),
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function showTermYears() {
    const isRepayment = el.repaymentType.value === "repayment";
    el.termYearsWrap.style.display = isRepayment ? "block" : "none";
  }

  // SDLT calculation (residential, England/Northern Ireland), 3% surcharge for additional properties
  function computeSdlt(purchasePrice, isAdditional) {
    const bands = [
      { upTo: 250000, rate: 0.00 },
      { upTo: 925000, rate: 0.05 },
      { upTo: 1500000, rate: 0.10 },
      { upTo: Infinity, rate: 0.12 },
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
      // 3% surcharge applies to consideration up to Infinity; effectively add 3% of entire purchase price
      tax += purchasePrice * 0.03;
    }
    return Math.max(0, Math.round(tax));
  }

  // Income tax computation for rUK 2024/25
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
      { upTo: Infinity, rate: 0.45 },
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
    if (repaymentType === "interest_only") {
      return { annualInterest: interestAnnual, annualRepayment: interestAnnual };
    }
    const n = termYears * 12;
    const paymentMonthly = rMonthly > 0
      ? loanAmount * (rMonthly * Math.pow(1 + rMonthly, n)) / (Math.pow(1 + rMonthly, n) - 1)
      : loanAmount / n;
    const paymentAnnual = paymentMonthly * 12;
    return { annualInterest: interestAnnual, annualRepayment: paymentAnnual };
  }

  function calculate() {
    const purchasePrice = toNumber(el.purchasePrice.value);
    const isAdditional = el.isAdditional.value === "yes";
    const otherPurchaseCosts = toNumber(el.otherPurchaseCosts.value);
    const ltv = clamp(toNumber(el.ltvPercent.value) / 100, 0, 1);
    const interestRate = Math.max(0, toNumber(el.interestRatePercent.value));
    const repaymentType = el.repaymentType.value;
    const termYears = Math.max(1, toNumber(el.termYears.value) || 25);

    const salary = Math.max(0, toNumber(el.salary.value));
    const annualRent = Math.max(0, toNumber(el.annualRent.value));
    const voidsPct = clamp(toNumber(el.voidsPercent.value) / 100, 0, 1);
    const lettingPct = clamp(toNumber(el.lettingPercent.value) / 100, 0, 1);
    const maintenancePct = clamp(toNumber(el.maintenancePercent.value) / 100, 0, 1);
    const insuranceAnnual = Math.max(0, toNumber(el.insuranceAnnual.value));
    const serviceChargeAnnual = Math.max(0, toNumber(el.serviceChargeAnnual.value));
    const otherAnnualExpenses = Math.max(0, toNumber(el.otherAnnualExpenses.value));

    const loanAmount = purchasePrice * ltv;
    const deposit = purchasePrice - loanAmount;
    const sdlt = computeSdlt(purchasePrice, isAdditional);
    const cashInvested = deposit + sdlt + otherPurchaseCosts;

    const rentAfterVoids = annualRent * (1 - voidsPct);
    const lettingFee = rentAfterVoids * lettingPct;
    const maintenance = rentAfterVoids * maintenancePct;
    const operatingExpenses = lettingFee + maintenance + insuranceAnnual + serviceChargeAnnual + otherAnnualExpenses;
    const noi = Math.max(0, rentAfterVoids - operatingExpenses);

    const { annualInterest, annualRepayment } = computeMortgageAnnuals(loanAmount, interestRate, repaymentType, termYears);
    const cashFlowPreTax = rentAfterVoids - operatingExpenses - annualRepayment;

    // Section 24: property profit for tax is pre-finance profits
    const propertyProfitPreFinance = Math.max(0, rentAfterVoids - operatingExpenses);
    const baselineTax = computeIncomeTax(salary);
    const totalTaxWithProperty = computeIncomeTax(salary + propertyProfitPreFinance);
    const financeCosts = annualInterest; // interest only
    const s24Credit = 0.20 * Math.max(0, Math.min(financeCosts, propertyProfitPreFinance));
    const incrementalTaxDue = Math.max(0, totalTaxWithProperty - baselineTax - s24Credit);
    const netCashAfterTax = cashFlowPreTax - incrementalTaxDue;

    // Yields
    const netYieldOnPurchasePrice = purchasePrice > 0 ? (netCashAfterTax / purchasePrice) : 0;
    const cashOnCash = cashInvested > 0 ? (netCashAfterTax / cashInvested) : 0;
    const capRate = purchasePrice > 0 ? (noi / purchasePrice) : 0;

    // Outputs
    out.netCashAfterTax.textContent = currency.format(Math.round(netCashAfterTax));
    out.netYieldOnPrice.textContent = percent(netYieldOnPurchasePrice);
    out.cashOnCash.textContent = percent(cashOnCash);
    out.capRate.textContent = percent(capRate);

    out.depositOut.textContent = currency.format(Math.round(deposit));
    out.sdltOut.textContent = currency.format(sdlt);
    out.otherPurchaseCostsOut.textContent = currency.format(Math.round(otherPurchaseCosts));
    out.cashInvestedOut.textContent = currency.format(Math.round(cashInvested));

    out.rentAfterVoidsOut.textContent = currency.format(Math.round(rentAfterVoids));
    out.lettingOut.textContent = currency.format(Math.round(lettingFee));
    out.maintenanceOut.textContent = currency.format(Math.round(maintenance));
    out.insuranceOut.textContent = currency.format(Math.round(insuranceAnnual));
    out.serviceOut.textContent = currency.format(Math.round(serviceChargeAnnual));
    out.otherAnnualOut.textContent = currency.format(Math.round(otherAnnualExpenses));
    out.noiOut.textContent = currency.format(Math.round(noi));

    out.loanAmountOut.textContent = currency.format(Math.round(loanAmount));
    out.annualInterestOut.textContent = currency.format(Math.round(annualInterest));
    out.annualRepaymentOut.textContent = currency.format(Math.round(annualRepayment));
    out.s24CreditOut.textContent = currency.format(Math.round(s24Credit));

    out.taxableProfitOut.textContent = currency.format(Math.round(propertyProfitPreFinance));
    out.incrementalTaxOut.textContent = currency.format(Math.round(incrementalTaxDue));
  }

  function setDefaults() {
    el.purchasePrice.value = 300000;
    el.isAdditional.value = "yes";
    el.otherPurchaseCosts.value = 3000;
    el.ltvPercent.value = 75;
    el.interestRatePercent.value = 5.5;
    el.repaymentType.value = "interest_only";
    el.termYears.value = 25;
    el.salary.value = 60000;
    el.annualRent.value = 21000;
    el.voidsPercent.value = 5;
    el.lettingPercent.value = 10;
    el.maintenancePercent.value = 8;
    el.insuranceAnnual.value = 300;
    el.serviceChargeAnnual.value = 1200;
    el.otherAnnualExpenses.value = 300;
  }

  function bind() {
    const inputs = document.querySelectorAll("#inputs-form input, #inputs-form select");
    inputs.forEach((node) => {
      node.addEventListener("input", () => {
        if (node === el.repaymentType) showTermYears();
        calculate();
      });
      node.addEventListener("change", () => {
        if (node === el.repaymentType) showTermYears();
        calculate();
      });
    });
    el.resetBtn.addEventListener("click", () => {
      setDefaults();
      showTermYears();
      calculate();
    });
  }

  // Init
  setDefaults();
  showTermYears();
  bind();
  calculate();
})();


