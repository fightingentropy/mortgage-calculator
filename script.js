// Formatting helpers
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

// Domain logic
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

// UI wiring
function $(id) { return document.getElementById(id); }

const inputs = {
  purchasePrice: $('purchasePrice'),
  isAdditional: $('isAdditional'),
  otherPurchaseCosts: $('otherPurchaseCosts'),
  ltvPercent: $('ltvPercent'),
  interestRatePercent: $('interestRatePercent'),
  repaymentType: $('repaymentType'),
  termYears: $('termYears'),
  salary: $('salary'),
  annualRent: $('annualRent'),
  voidsPercent: $('voidsPercent'),
  lettingPercent: $('lettingPercent'),
  maintenancePercent: $('maintenancePercent'),
  insuranceAnnual: $('insuranceAnnual'),
  serviceChargeAnnual: $('serviceChargeAnnual'),
  otherAnnualExpenses: $('otherAnnualExpenses'),
};

const outputs = {
  netCashAfterTax: $('netCashAfterTax'),
  netYieldOnPurchasePrice: $('netYieldOnPurchasePrice'),
  cashOnCash: $('cashOnCash'),
  capRate: $('capRate'),

  deposit: $('deposit'),
  sdlt: $('sdlt'),
  otherPurchaseCostsOut: $('otherPurchaseCostsOut'),
  cashInvested: $('cashInvested'),

  rentAfterVoids: $('rentAfterVoids'),
  lettingFee: $('lettingFee'),
  maintenanceCost: $('maintenanceCost'),
  insurance: $('insurance'),
  service: $('service'),
  otherAnnual: $('otherAnnual'),
  noi: $('noi'),

  loanAmount: $('loanAmount'),
  annualInterest: $('annualInterest'),
  annualRepayment: $('annualRepayment'),
  s24Credit: $('s24Credit'),

  propertyProfitPreFinance: $('propertyProfitPreFinance'),
  incrementalTaxDue: $('incrementalTaxDue'),
};

function readNumber(el) { return Math.max(0, Number(el.value) || 0); }

function recompute() {
  const ltv = clamp((readNumber(inputs.ltvPercent)) / 100, 0, 1);
  const interestRate = Math.max(0, Number(inputs.interestRatePercent.value) || 0);
  const term = Math.max(1, Number(inputs.termYears.value) || 25);

  const salaryNum = readNumber(inputs.salary);
  const rent = readNumber(inputs.annualRent);
  const voids = clamp((Number(inputs.voidsPercent.value) || 0) / 100, 0, 1);
  const letting = clamp((Number(inputs.lettingPercent.value) || 0) / 100, 0, 1);
  const maintenance = clamp((Number(inputs.maintenancePercent.value) || 0) / 100, 0, 1);
  const insurance = readNumber(inputs.insuranceAnnual);
  const service = readNumber(inputs.serviceChargeAnnual);
  const otherAnnual = readNumber(inputs.otherAnnualExpenses);

  const price = readNumber(inputs.purchasePrice);
  const loanAmount = price * ltv;
  const deposit = price - loanAmount;
  const sdlt = computeSdlt(price, inputs.isAdditional.value === 'yes');
  const otherPurchaseCosts = readNumber(inputs.otherPurchaseCosts);
  const cashInvested = deposit + sdlt + otherPurchaseCosts;

  const rentAfterVoids = rent * (1 - voids);
  const lettingFee = rentAfterVoids * letting;
  const maintenanceCost = rentAfterVoids * maintenance;
  const operatingExpenses = lettingFee + maintenanceCost + insurance + service + otherAnnual;
  const noi = Math.max(0, rentAfterVoids - operatingExpenses);

  const { annualInterest, annualRepayment } = computeMortgageAnnuals(loanAmount, interestRate, inputs.repaymentType.value, term);
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

  outputs.netCashAfterTax.textContent = formatCurrency(netCashAfterTax);
  outputs.netYieldOnPurchasePrice.textContent = formatPercent(netYieldOnPurchasePrice);
  outputs.cashOnCash.textContent = formatPercent(cashOnCash);
  outputs.capRate.textContent = formatPercent(capRate);

  outputs.deposit.textContent = formatCurrency(deposit);
  outputs.sdlt.textContent = formatCurrency(sdlt);
  outputs.otherPurchaseCostsOut.textContent = formatCurrency(otherPurchaseCosts);
  outputs.cashInvested.textContent = formatCurrency(cashInvested);

  outputs.rentAfterVoids.textContent = formatCurrency(rentAfterVoids);
  outputs.lettingFee.textContent = formatCurrency(lettingFee);
  outputs.maintenanceCost.textContent = formatCurrency(maintenanceCost);
  outputs.insurance.textContent = formatCurrency(insurance);
  outputs.service.textContent = formatCurrency(service);
  outputs.otherAnnual.textContent = formatCurrency(otherAnnual);
  outputs.noi.textContent = formatCurrency(noi);

  outputs.loanAmount.textContent = formatCurrency(loanAmount);
  outputs.annualInterest.textContent = formatCurrency(annualInterest);
  outputs.annualRepayment.textContent = formatCurrency(annualRepayment);
  outputs.s24Credit.textContent = formatCurrency(s24Credit);

  outputs.propertyProfitPreFinance.textContent = formatCurrency(propertyProfitPreFinance);
  outputs.incrementalTaxDue.textContent = formatCurrency(incrementalTaxDue);

  const showTermYears = inputs.repaymentType.value === 'repayment';
  document.getElementById('termYearsField').style.display = showTermYears ? '' : 'none';
}

function attachListeners() {
  const elements = [
    inputs.purchasePrice,
    inputs.isAdditional,
    inputs.otherPurchaseCosts,
    inputs.ltvPercent,
    inputs.interestRatePercent,
    inputs.repaymentType,
    inputs.termYears,
    inputs.salary,
    inputs.annualRent,
    inputs.voidsPercent,
    inputs.lettingPercent,
    inputs.maintenancePercent,
    inputs.insuranceAnnual,
    inputs.serviceChargeAnnual,
    inputs.otherAnnualExpenses,
  ];
  elements.forEach((el) => {
    el.addEventListener('input', recompute);
    el.addEventListener('change', recompute);
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    inputs.purchasePrice.value = 300000;
    inputs.isAdditional.value = 'yes';
    inputs.otherPurchaseCosts.value = 3000;
    inputs.ltvPercent.value = 75;
    inputs.interestRatePercent.value = 5.5;
    inputs.repaymentType.value = 'interest_only';
    inputs.termYears.value = 25;
    inputs.salary.value = 60000;
    inputs.annualRent.value = 21000;
    inputs.voidsPercent.value = 5;
    inputs.lettingPercent.value = 10;
    inputs.maintenancePercent.value = 8;
    inputs.insuranceAnnual.value = 300;
    inputs.serviceChargeAnnual.value = 1200;
    inputs.otherAnnualExpenses.value = 300;
    recompute();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  attachListeners();
  recompute();
});


