// Helpers
const currencyFormatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
function formatCurrency(v) { return currencyFormatter.format(Math.round(v || 0)); }
function formatPercentVal(v) { const pct = Number.isFinite(v) ? v * 100 : 0; return `${pct.toFixed(2)}%`; }
function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function $(id) { return document.getElementById(id); }

// Inputs
const I = {
  // Mode
  modeOwnerBtn: $('modeOwnerBtn'),
  modeBtlBtn: $('modeBtlBtn'),
  // Purchase & mortgage
  purchasePrice: $('purchasePrice'),
  depositType: $('depositType'),
  depositValue: $('depositValue'),
  otherPurchaseCosts: $('otherPurchaseCosts'),
  productFee: $('productFee'),
  productFeeTreatment: $('productFeeTreatment'),
  repaymentType: $('repaymentType'),
  interestRatePercent: $('interestRatePercent'),
  termYears: $('termYears'),
  // Economics & exit
  hpiGrowth: $('hpiGrowth'),
  cpiPercent: $('cpiPercent'),
  discountRate: $('discountRate'),
  sellAtEnd: $('sellAtEnd'),
  agentPercent: $('agentPercent'),
  agentVatPercent: $('agentVatPercent'),
  saleLegal: $('saleLegal'),
  // Taxes
  buyerType: $('buyerType'),
  surchargeRefund: $('surchargeRefund'),
  cgtRate: $('cgtRate'),
  cgtAllowance: $('cgtAllowance'),
  prrToggle: $('prrToggle'),
  // Owner
  currentRent: $('currentRent'),
  rentInflation: $('rentInflation'),
  ownerMaintenancePctOfValue: $('ownerMaintenancePctOfValue'),
  ownerService: $('ownerService'),
  ownerInsurance: $('ownerInsurance'),
  ownerGroundRent: $('ownerGroundRent'),
  // BTL
  btlRentMonthly: $('btlRentMonthly'),
  btlVoidsPct: $('btlVoidsPct'),
  btlMgmtPct: $('btlMgmtPct'),
  btlCompliance: $('btlCompliance'),
  landlordTaxBand: $('landlordTaxBand'),
  section24: $('section24'),
  // Capex & actions
  addCapex: $('addCapex'),
  capexRows: $('capexRows'),
  resetBtn: $('resetBtn'),
  downloadCsv: $('downloadCsv'),
  printPdf: $('printPdf'),
};

// Outputs
const O = {
  kpiIrr: $('kpiIrr'),
  kpiRealIrr: $('kpiRealIrr'),
  kpiNpv: $('kpiNpv'),
  kpiCashIn: $('kpiCashIn'),
  kpiNetProceeds: $('kpiNetProceeds'),
  kpiPayback: $('kpiPayback'),
  ownerCheaperYear: $('ownerCheaperYear'),
  ownerBreakevenRent: $('ownerBreakevenRent'),
  btlPositiveYear: $('btlPositiveYear'),
  amortTable: $('amortTable'),
  btlTableWrap: $('btlTableWrap'),
  btlTable: $('btlTable'),
  heatmapGrowth: $('heatmapGrowth'),
  heatmapFinance: $('heatmapFinance'),
};

// Sections
const S = {
  ownerOnly: document.querySelectorAll('.owner-only'),
  btlOnly: document.querySelectorAll('.btl-only'),
};

let appState = { mode: 'owner', charts: { cashflow: null, valueDebt: null }, lastExport: null };

function readNum(el) { return Number(el.value) || 0; }
function pctToDec(v) { return (Number(v) || 0) / 100; }

function setMode(mode) {
  appState.mode = mode;
  I.modeOwnerBtn.classList.toggle('active', mode === 'owner');
  I.modeOwnerBtn.setAttribute('aria-selected', mode === 'owner' ? 'true' : 'false');
  I.modeBtlBtn.classList.toggle('active', mode === 'btl');
  I.modeBtlBtn.setAttribute('aria-selected', mode === 'btl' ? 'true' : 'false');
  S.ownerOnly.forEach(el => el.hidden = mode !== 'owner');
  S.btlOnly.forEach(el => el.hidden = mode !== 'btl');
  recomputeAll();
}

function computeDeposit(price) {
  const type = I.depositType.value;
  const v = readNum(I.depositValue);
  if (type === 'percent') {
    const dp = clamp(v, 0, 100) / 100;
    return clamp(price * dp, 0, price);
  }
  return clamp(v, 0, price);
}

function computeSdltAdvanced(price, buyerType, surchargeRefund) {
  // Standard residential bands
  const bands = [
    { upTo: 250000, rate: 0.00 },
    { upTo: 925000, rate: 0.05 },
    { upTo: 1500000, rate: 0.10 },
    { upTo: Infinity, rate: 0.12 }
  ];
  function bandsTax(p) {
    let remaining = p, last = 0, tax = 0;
    for (const b of bands) {
      const portion = Math.max(0, Math.min(remaining, b.upTo - last));
      tax += portion * b.rate;
      remaining -= portion;
      last = b.upTo;
      if (remaining <= 0) break;
    }
    return tax;
  }
  if (buyerType === 'ftb') {
    // First-time buyer relief up to £625k; 0% to £425k, 5% from £425k to £625k
    if (price > 625000) {
      return Math.round(bandsTax(price));
    }
    const zeroBand = Math.min(price, 425000);
    const fiveBand = Math.max(0, Math.min(price, 625000) - 425000);
    const rest = Math.max(0, price - 625000);
    return Math.round(0 * zeroBand + 0.05 * fiveBand + bandsTax(rest));
  }
  if (buyerType === 'additional') {
    const base = bandsTax(price);
    const surcharge = surchargeRefund === 'yes' ? 0 : price * 0.03;
    return Math.round(base + surcharge);
  }
  return Math.round(bandsTax(price));
}

function amortize(principal, aprPct, years, type) {
  const months = Math.max(1, Math.floor(years * 12));
  const r = (aprPct / 100) / 12;
  let balance = principal;
  const perYear = [];
  let paymentMonthly = 0;
  if (type === 'repayment') {
    paymentMonthly = r > 0 ? principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1) : principal / months;
  }
  let yearInterest = 0, yearPrincipal = 0, yearPayment = 0, yearIndex = 0;
  for (let m = 1; m <= months; m++) {
    const interest = balance * r;
    let principalPaid = 0;
    let payment = 0;
    if (type === 'interest_only') {
      payment = balance * r;
      principalPaid = 0;
    } else {
      payment = paymentMonthly;
      principalPaid = Math.max(0, payment - interest);
      principalPaid = Math.min(principalPaid, balance);
      balance -= principalPaid;
    }
    yearInterest += interest;
    yearPrincipal += principalPaid;
    yearPayment += payment;
    if (m % 12 === 0 || m === months) {
      perYear.push({ year: ++yearIndex, interest: yearInterest, principal: yearPrincipal, payment: yearPayment, balance: balance });
      yearInterest = 0; yearPrincipal = 0; yearPayment = 0;
    }
  }
  if (type === 'interest_only') {
    for (let y = perYear.length; y < years; y++) {
      perYear.push({ year: y + 1, interest: principal * (aprPct / 100), principal: 0, payment: principal * (aprPct / 100), balance: principal });
    }
  }
  return perYear;
}

function irr(cashflows) {
  // Bisection on rate in [-0.999, 10]
  let low = -0.999, high = 10, mid = 0;
  function npvAt(r) { return cashflows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + r, i), 0); }
  let npvLow = npvAt(low), npvHigh = npvAt(high);
  if (npvLow * npvHigh > 0) return null;
  for (let i = 0; i < 100; i++) {
    mid = (low + high) / 2;
    const v = npvAt(mid);
    if (Math.abs(v) < 1e-6) break;
    if (v * npvLow > 0) { low = mid; npvLow = v; } else { high = mid; npvHigh = v; }
  }
  return mid;
}

function npv(ratePct, cashflows) {
  const r = ratePct / 100;
  return cashflows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + r, i), 0);
}

function buildCapexList() {
  const rows = Array.from(I.capexRows.querySelectorAll('.capex-row'));
  return rows.map(row => {
    const year = Number(row.querySelector('input[data-key="year"]').value) || 0;
    const amount = Number(row.querySelector('input[data-key="amount"]').value) || 0;
    return { year: Math.max(0, Math.floor(year)), amount: Math.max(0, amount) };
  }).filter(r => r.amount > 0);
}

function addCapexRow(year = 1, amount = 0) {
  const row = document.createElement('div');
  row.className = 'capex-row';
  row.innerHTML = `
    <input type="number" min="0" step="1" placeholder="Year" data-key="year" value="${year}">
    <input type="number" min="0" step="50" placeholder="Amount (£)" data-key="amount" value="${amount}">
    <button type="button" class="remove">Remove</button>
  `;
  row.querySelector('.remove').addEventListener('click', () => { row.remove(); recomputeAll(); });
  row.querySelectorAll('input').forEach(i => { i.addEventListener('input', recomputeAll); i.addEventListener('change', recomputeAll); });
  I.capexRows.appendChild(row);
}

function computeCgtOnSale(params) {
  const { sellPrice, sellCosts, purchasePrice, sdltPaid, productFeeUpfront, otherPurchase, capexTotal, years, prrOn, cgtRate, cgtAllowance } = params;
  const basis = purchasePrice + sdltPaid + productFeeUpfront + otherPurchase + capexTotal;
  const grossGain = Math.max(0, sellPrice - sellCosts - basis);
  const prrFraction = prrOn ? Math.min(1, 9 / (years * 12)) : 0;
  const chargeable = Math.max(0, grossGain * (1 - prrFraction) - cgtAllowance);
  if (chargeable <= 0) return 0;
  if (cgtRate === '18') return chargeable * 0.18;
  if (cgtRate === '24') return chargeable * 0.24;
  const basic = Math.min(chargeable, 37700);
  const higher = Math.max(0, chargeable - 37700);
  return basic * 0.18 + higher * 0.24;
}

function buildTables(container, rows, headers) {
  const parts = [];
  parts.push(`<div class="row header"><span>${headers[0]}</span><span>${headers[1]}</span></div>`);
  for (const r of rows) parts.push(`<div class="row"><span>${r[0]}</span><span>${r[1]}</span></div>`);
  container.innerHTML = parts.join('');
}

function recomputeAll() {
  const mode = appState.mode;
  const price = Math.max(0, readNum(I.purchasePrice));
  const deposit = computeDeposit(price);
  const productFee = Math.max(0, readNum(I.productFee));
  const productUpfront = I.productFeeTreatment.value === 'upfront' ? productFee : 0;
  const productOnLoan = I.productFeeTreatment.value === 'add_to_loan' ? productFee : 0;
  const principal = Math.max(0, price - deposit + productOnLoan);
  const apr = Math.max(0, readNum(I.interestRatePercent));
  const termYears = Math.max(1, Math.floor(readNum(I.termYears) || 25));
  const hpi = pctToDec(I.hpiGrowth.value);
  const rentInfl = pctToDec(I.rentInflation.value);
  const cpi = pctToDec(I.cpiPercent.value);
  const discount = Math.max(0, readNum(I.discountRate));
  const sellAtEnd = I.sellAtEnd.value === 'yes';
  const agentPct = pctToDec(I.agentPercent.value);
  const agentVatPct = pctToDec(I.agentVatPercent.value);
  const saleLegal = Math.max(0, readNum(I.saleLegal));
  const buyerType = I.buyerType.value;
  const surchargeRefund = I.surchargeRefund.value;
  const sdlt = computeSdltAdvanced(price, buyerType, surchargeRefund);
  const otherPurchase = Math.max(0, readNum(I.otherPurchaseCosts));
  const capexList = buildCapexList();
  const capexByYear = new Map(capexList.map(c => [c.year, c.amount]));
  const capexTotal = capexList.reduce((a, c) => a + c.amount, 0);

  const schedule = amortize(principal, apr, termYears, I.repaymentType.value);
  const values = Array.from({ length: termYears + 1 }, (_, t) => price * Math.pow(1 + hpi, t));

  // Annual flows by mode
  const years = termYears;
  const cashflows = new Array(years + 1).fill(0);
  cashflows[0] = -(deposit + otherPurchase + productUpfront + sdlt);
  const btlPnlRows = [];
  let firstPositiveOwnerYear = null;
  let firstPositiveBtlYear = null;

  for (let y = 1; y <= years; y++) {
    const sched = schedule[Math.min(y - 1, schedule.length - 1)] || { interest: 0, principal: 0, payment: 0, balance: principal };
    if (mode === 'owner') {
      const rentYr = Math.max(0, readNum(I.currentRent)) * 12 * Math.pow(1 + rentInfl, y - 1);
      const ownMaint = values[y - 1] * (pctToDec(I.ownerMaintenancePctOfValue.value));
      const ownService = Math.max(0, readNum(I.ownerService));
      const ownIns = Math.max(0, readNum(I.ownerInsurance));
      const ownGround = Math.max(0, readNum(I.ownerGroundRent));
      const owningCost = sched.interest + ownMaint + ownService + ownIns + ownGround;
      const ownVsRent = rentYr - owningCost;
      if (firstPositiveOwnerYear === null && ownVsRent > 0) firstPositiveOwnerYear = y;
      cashflows[y] += ownVsRent - (capexByYear.get(y) || 0);
    } else {
      const rentMonthly = Math.max(0, readNum(I.btlRentMonthly));
      const gross = rentMonthly * 12 * Math.pow(1 + rentInfl, y - 1);
      const voids = pctToDec(I.btlVoidsPct.value);
      const collected = gross * (1 - voids);
      const mgmt = collected * pctToDec(I.btlMgmtPct.value);
      const compliance = Math.max(0, readNum(I.btlCompliance));
      const noi = collected - mgmt - compliance;
      const interest = sched.interest;
      let taxable, tax;
      if (I.section24.value === 'on') {
        taxable = Math.max(0, noi);
        const band = Number(I.landlordTaxBand.value) / 100;
        const grossTax = taxable * band;
        const credit = 0.20 * Math.max(0, Math.min(interest, taxable));
        tax = Math.max(0, grossTax - credit);
      } else {
        taxable = Math.max(0, noi - interest);
        const band = Number(I.landlordTaxBand.value) / 100;
        tax = taxable * band;
      }
      const net = noi - sched.payment - tax;
      const row = [
        `Year ${y}`,
        `Rent ${formatCurrency(collected)}`,
        `Mgmt ${formatCurrency(mgmt)}`,
        `Compliance ${formatCurrency(compliance)}`,
        `NOI ${formatCurrency(noi)}`,
        `Interest ${formatCurrency(interest)}`,
        `Payment ${formatCurrency(sched.payment)}`,
        `Tax ${formatCurrency(tax)}`,
        `Net ${formatCurrency(net)}`
      ];
      btlPnlRows.push([row[0], row.slice(1).join(' | ')]);
      if (firstPositiveBtlYear === null && net > 0) firstPositiveBtlYear = y;
      cashflows[y] += net - (capexByYear.get(y) || 0);
    }
  }

  // Terminal event
  const finalValue = values[years];
  const finalBalance = schedule[Math.min(years - 1, schedule.length - 1)]?.balance ?? principal;
  let netProceeds = 0;
  if (sellAtEnd) {
    const agentFee = finalValue * agentPct;
    const vat = agentFee * agentVatPct;
    const sellCosts = agentFee + vat + saleLegal;
    const cgt = computeCgtOnSale({ sellPrice: finalValue, sellCosts, purchasePrice: price, sdltPaid: sdlt, productFeeUpfront: productUpfront, otherPurchase, capexTotal, years, prrOn: I.prrToggle.value === 'yes', cgtRate: I.cgtRate.value, cgtAllowance: Math.max(0, readNum(I.cgtAllowance)) });
    netProceeds = Math.max(0, finalValue - sellCosts - finalBalance - cgt);
    cashflows[years] += netProceeds;
  } else {
    netProceeds = Math.max(0, finalValue - finalBalance);
  }

  // KPIs
  const irrNom = irr(cashflows);
  const deflated = cashflows.map((cf, i) => cf / Math.pow(1 + cpi, i));
  const irrReal = irr(deflated);
  const npvVal = npv(discount, cashflows);
  let payback = '—';
  let cum = cashflows[0];
  for (let y = 1; y < cashflows.length - (sellAtEnd ? 1 : 0); y++) { cum += cashflows[y]; if (cum >= 0) { payback = `${y}`; break; } }

  O.kpiIrr.textContent = irrNom == null ? '—' : formatPercentVal(irrNom);
  O.kpiRealIrr.textContent = irrReal == null ? '—' : formatPercentVal(irrReal);
  O.kpiNpv.textContent = formatCurrency(npvVal);
  O.kpiCashIn.textContent = formatCurrency(-(cashflows[0]));
  O.kpiNetProceeds.textContent = formatCurrency(netProceeds);
  O.kpiPayback.textContent = payback;
  O.ownerCheaperYear.textContent = appState.mode === 'owner' ? (firstPositiveOwnerYear ? `${firstPositiveOwnerYear}` : '—') : '—';
  const y1Sched = schedule[0] || { interest: 0 };
  const y1Cost = (values[0] * pctToDec(I.ownerMaintenancePctOfValue.value)) + Math.max(0, readNum(I.ownerService)) + Math.max(0, readNum(I.ownerInsurance)) + Math.max(0, readNum(I.ownerGroundRent)) + y1Sched.interest;
  O.ownerBreakevenRent.textContent = appState.mode === 'owner' ? formatCurrency(y1Cost / 12) : '—';
  O.btlPositiveYear.textContent = appState.mode === 'btl' ? (firstPositiveBtlYear ? `${firstPositiveBtlYear}` : '—') : '—';

  // Tables
  const amortRows = schedule.map(y => [`Year ${y.year}`, `${formatCurrency(y.interest)} interest | ${formatCurrency(y.principal)} principal | bal ${formatCurrency(y.balance)}`]);
  buildTables(O.amortTable, amortRows, ['Year', 'Amortisation']);
  if (appState.mode === 'btl') { O.btlTableWrap.hidden = false; buildTables(O.btlTable, btlPnlRows, ['Year', 'BTL P&L']); } else { O.btlTableWrap.hidden = true; O.btlTable.innerHTML = ''; }

  // Charts
  const labels = Array.from({ length: years }, (_, i) => `Y${i + 1}`);
  const byYearInterest = schedule.map(s => s.interest);
  const byYearPrincipal = schedule.map(s => s.principal);
  let incomeSeries = [];
  let opexSeries = [];
  let taxSeries = [];
  let capexSeries = [];
  let netSeries = [];
  if (appState.mode === 'owner') {
    for (let y = 1; y <= years; y++) {
      const rentYr = Math.max(0, readNum(I.currentRent)) * 12 * Math.pow(1 + rentInfl, y - 1);
      const ownMaint = values[y - 1] * (pctToDec(I.ownerMaintenancePctOfValue.value));
      const ownService = Math.max(0, readNum(I.ownerService));
      const ownIns = Math.max(0, readNum(I.ownerInsurance));
      const ownGround = Math.max(0, readNum(I.ownerGroundRent));
      const opex = ownMaint + ownService + ownIns + ownGround;
      const ownVsRent = rentYr - (opex + byYearInterest[y - 1]);
      incomeSeries.push(rentYr);
      opexSeries.push(opex);
      taxSeries.push(0);
      capexSeries.push(capexByYear.get(y) || 0);
      netSeries.push(ownVsRent - (capexByYear.get(y) || 0));
    }
  } else {
    for (let y = 1; y <= years; y++) {
      const rentMonthly = Math.max(0, readNum(I.btlRentMonthly));
      const gross = rentMonthly * 12 * Math.pow(1 + rentInfl, y - 1);
      const voids = pctToDec(I.btlVoidsPct.value);
      const collected = gross * (1 - voids);
      const mgmt = collected * pctToDec(I.btlMgmtPct.value);
      const compliance = Math.max(0, readNum(I.btlCompliance));
      const noi = collected - mgmt - compliance;
      let tax;
      if (I.section24.value === 'on') {
        const band = Number(I.landlordTaxBand.value) / 100;
        const credit = 0.20 * Math.max(0, Math.min(byYearInterest[y - 1], Math.max(0, noi)));
        tax = Math.max(0, Math.max(0, noi) * band - credit);
      } else {
        const band = Number(I.landlordTaxBand.value) / 100;
        tax = Math.max(0, (noi - byYearInterest[y - 1]) * band);
      }
      incomeSeries.push(collected);
      opexSeries.push(mgmt + compliance);
      taxSeries.push(tax);
      capexSeries.push(capexByYear.get(y) || 0);
      netSeries.push(noi - (schedule[y - 1]?.payment || 0) - tax - (capexByYear.get(y) || 0));
    }
  }
  renderCharts(labels, incomeSeries, opexSeries, byYearInterest, taxSeries, capexSeries, netSeries, values.slice(1), schedule.map(s => s.balance));

  // Heatmaps
  renderHeatmaps({ price, baseHpi: Number(I.hpiGrowth.value), baseRentInfl: Number(I.rentInflation.value), baseApr: Number(I.interestRatePercent.value), baseDepositPct: (deposit / Math.max(1, price)) * 100 });

  // Export dataset
  appState.lastExport = { labels, values, balances: schedule.map(s => s.balance), incomeSeries, opexSeries, interestSeries: byYearInterest, principalSeries: byYearPrincipal, taxSeries, capexSeries, netSeries, cashflows };
}

function renderCharts(labels, income, opex, interest, tax, capex, net, values, balances) {
  const ctx1 = $('cashflowChart').getContext('2d');
  const ctx2 = $('valueDebtChart').getContext('2d');
  if (appState.charts.cashflow) appState.charts.cashflow.destroy();
  if (appState.charts.valueDebt) appState.charts.valueDebt.destroy();
  appState.charts.cashflow = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Income', data: income, backgroundColor: 'rgba(45, 212, 191, 0.6)', stack: 'cf' },
        { label: 'Opex', data: opex.map(v => -v), backgroundColor: 'rgba(156, 163, 175, 0.5)', stack: 'cf' },
        { label: 'Interest', data: interest.map(v => -v), backgroundColor: 'rgba(59, 130, 246, 0.5)', stack: 'cf' },
        { label: 'Tax', data: tax.map(v => -v), backgroundColor: 'rgba(244, 63, 94, 0.5)', stack: 'cf' },
        { label: 'Capex', data: capex.map(v => -v), backgroundColor: 'rgba(234, 179, 8, 0.5)', stack: 'cf' },
        { type: 'line', label: 'Net', data: net, borderColor: '#80ffdb', backgroundColor: 'transparent', yAxisID: 'y' }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { stacked: true } } }
  });
  appState.charts.valueDebt = new Chart(ctx2, {
    type: 'line',
    data: { labels, datasets: [ { label: 'Value', data: values, borderColor: '#80ffdb', fill: false }, { label: 'Debt', data: balances, borderColor: '#ff5c72', fill: false } ] },
    options: { responsive: true, plugins: { legend: { position: 'top' } } }
  });
}

function computeIrrSnapshotOverrides(overrides) {
  const mode = appState.mode;
  const price = Math.max(0, readNum(I.purchasePrice));
  const deposit = clamp((overrides.depositPct ?? (computeDeposit(price) / Math.max(1, price)) * 100), 0, 100) / 100 * price;
  const productFee = Math.max(0, readNum(I.productFee));
  const productUpfront = I.productFeeTreatment.value === 'upfront' ? productFee : 0;
  const productOnLoan = I.productFeeTreatment.value === 'add_to_loan' ? productFee : 0;
  const principal = Math.max(0, price - deposit + productOnLoan);
  const apr = Math.max(0, overrides.apr ?? readNum(I.interestRatePercent));
  const termYears = Math.max(1, Math.floor(readNum(I.termYears) || 25));
  const hpi = ((overrides.hpi ?? Number(I.hpiGrowth.value)) / 100);
  const rentInfl = ((overrides.rentInfl ?? Number(I.rentInflation.value)) / 100);
  const sellAtEnd = I.sellAtEnd.value === 'yes';
  const agentPct = pctToDec(I.agentPercent.value);
  const agentVatPct = pctToDec(I.agentVatPercent.value);
  const saleLegal = Math.max(0, readNum(I.saleLegal));
  const buyerType = I.buyerType.value;
  const surchargeRefund = I.surchargeRefund.value;
  const sdlt = computeSdltAdvanced(price, buyerType, surchargeRefund);
  const otherPurchase = Math.max(0, readNum(I.otherPurchaseCosts));
  const schedule = amortize(principal, apr, termYears, I.repaymentType.value);
  const values = Array.from({ length: termYears + 1 }, (_, t) => price * Math.pow(1 + hpi, t));
  const years = termYears;
  const cashflows = new Array(years + 1).fill(0);
  cashflows[0] = -(deposit + otherPurchase + productUpfront + sdlt);
  for (let y = 1; y <= years; y++) {
    const sched = schedule[Math.min(y - 1, schedule.length - 1)] || { interest: 0, payment: 0 };
    if (mode === 'owner') {
      const rentYr = Math.max(0, readNum(I.currentRent)) * 12 * Math.pow(1 + rentInfl, y - 1);
      const ownMaint = values[y - 1] * (pctToDec(I.ownerMaintenancePctOfValue.value));
      const ownService = Math.max(0, readNum(I.ownerService));
      const ownIns = Math.max(0, readNum(I.ownerInsurance));
      const ownGround = Math.max(0, readNum(I.ownerGroundRent));
      const owningCost = sched.interest + ownMaint + ownService + ownIns + ownGround;
      cashflows[y] += rentYr - owningCost;
    } else {
      const rentMonthly = Math.max(0, readNum(I.btlRentMonthly));
      const gross = rentMonthly * 12 * Math.pow(1 + rentInfl, y - 1);
      const voids = pctToDec(I.btlVoidsPct.value);
      const collected = gross * (1 - voids);
      const mgmt = collected * pctToDec(I.btlMgmtPct.value);
      const compliance = Math.max(0, readNum(I.btlCompliance));
      const noi = collected - mgmt - compliance;
      let tax;
      if (I.section24.value === 'on') {
        const band = Number(I.landlordTaxBand.value) / 100;
        const credit = 0.20 * Math.max(0, Math.min(sched.interest, Math.max(0, noi)));
        tax = Math.max(0, Math.max(0, noi) * band - credit);
      } else {
        const band = Number(I.landlordTaxBand.value) / 100;
        tax = Math.max(0, (noi - sched.interest) * band);
      }
      cashflows[y] += noi - sched.payment - tax;
    }
  }
  if (sellAtEnd) {
    const finalValue = values[years];
    const finalBalance = schedule[Math.min(years - 1, schedule.length - 1)]?.balance ?? principal;
    const agentFee = finalValue * agentPct;
    const vat = agentFee * agentVatPct;
    const sellCosts = agentFee + vat + saleLegal;
    const cgt = computeCgtOnSale({ sellPrice: finalValue, sellCosts, purchasePrice: price, sdltPaid: sdlt, productFeeUpfront: productUpfront, otherPurchase, capexTotal: 0, years, prrOn: I.prrToggle.value === 'yes', cgtRate: I.cgtRate.value, cgtAllowance: Math.max(0, readNum(I.cgtAllowance)) });
    cashflows[years] += Math.max(0, finalValue - sellCosts - finalBalance - cgt);
  }
  return irr(cashflows);
}

function renderHeatmaps({ price, baseHpi, baseRentInfl, baseApr, baseDepositPct }) {
  const growthVals = [-2, -1, 0, 1, 2].map(d => Math.max(0, baseHpi + d));
  const rentVals = [-2, -1, 0, 1, 2].map(d => Math.max(0, baseRentInfl + d));
  const aprVals = [-1, -0.5, 0, 0.5, 1].map(d => Math.max(0, baseApr + d));
  const depVals = [-10, -5, 0, 5, 10].map(d => clamp(baseDepositPct + d, 0, 90));

  function heatClass(val) {
    if (val == null) return 'heat-mid';
    if (val < 0.02) return 'heat-cold';
    if (val < 0.08) return 'heat-mid';
    return 'heat-hot';
  }

  const gEl = O.heatmapGrowth; gEl.innerHTML = '';
  for (const g of growthVals) {
    for (const r of rentVals) {
      const val = computeIrrSnapshotOverrides({ hpi: g, rentInfl: r });
      const div = document.createElement('div');
      div.className = 'heat-cell ' + heatClass(val);
      div.textContent = val == null ? '—' : `${(val * 100).toFixed(1)}%`;
      div.title = `HPI ${g.toFixed(1)}%, Rent ${r.toFixed(1)}%`;
      div.addEventListener('click', () => { I.hpiGrowth.value = g; I.rentInflation.value = r; recomputeAll(); });
      gEl.appendChild(div);
    }
  }
  const fEl = O.heatmapFinance; fEl.innerHTML = '';
  for (const a of aprVals) {
    for (const d of depVals) {
      const val = computeIrrSnapshotOverrides({ apr: a, depositPct: d });
      const div = document.createElement('div');
      div.className = 'heat-cell ' + heatClass(val);
      div.textContent = val == null ? '—' : `${(val * 100).toFixed(1)}%`;
      div.title = `APR ${a.toFixed(2)}%, Deposit ${d.toFixed(1)}%`;
      div.addEventListener('click', () => { I.interestRatePercent.value = a; I.depositType.value = 'percent'; I.depositValue.value = d; recomputeAll(); });
      fEl.appendChild(div);
    }
  }
}

function downloadCsv() {
  const exp = appState.lastExport;
  if (!exp) return;
  const lines = [];
  lines.push(['Year', 'Value', 'Debt', 'Income', 'Opex', 'Interest', 'Principal', 'Tax', 'Capex', 'Net'].join(','));
  for (let i = 0; i < exp.labels.length; i++) {
    const y = i + 1;
    lines.push([y, Math.round(exp.values[i]), Math.round(exp.balances[i]), Math.round(exp.incomeSeries[i]||0), Math.round(exp.opexSeries[i]||0), Math.round(exp.interestSeries[i]||0), Math.round(exp.principalSeries[i]||0), Math.round(exp.taxSeries[i]||0), Math.round(exp.capexSeries[i]||0), Math.round(exp.netSeries[i]||0)].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'annual_cashflows.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function resetDefaults() {
  I.purchasePrice.value = 500000;
  I.depositType.value = 'amount';
  I.depositValue.value = 50000;
  I.productFee.value = 0;
  I.productFeeTreatment.value = 'add_to_loan';
  I.otherPurchaseCosts.value = 0;
  I.repaymentType.value = 'repayment';
  I.interestRatePercent.value = 4;
  I.termYears.value = 25;
  I.hpiGrowth.value = 3;
  I.cpiPercent.value = 2;
  I.discountRate.value = 4;
  I.sellAtEnd.value = 'yes';
  I.agentPercent.value = 1.5;
  I.agentVatPercent.value = 20;
  I.saleLegal.value = 1000;
  I.buyerType.value = 'additional';
  I.surchargeRefund.value = 'no';
  I.cgtRate.value = '24';
  I.cgtAllowance.value = 3000;
  I.prrToggle.value = 'no';
  I.currentRent.value = 2000;
  I.rentInflation.value = 3;
  I.ownerMaintenancePctOfValue.value = 1;
  I.ownerService.value = 2300;
  I.ownerInsurance.value = 300;
  I.ownerGroundRent.value = 0;
  I.btlRentMonthly.value = 2000;
  I.btlVoidsPct.value = 5;
  I.btlMgmtPct.value = 12;
  I.btlCompliance.value = 250;
  I.landlordTaxBand.value = '45';
  I.section24.value = 'on';
  I.capexRows.innerHTML = '';
}

function attach() {
  I.modeOwnerBtn.addEventListener('click', () => setMode('owner'));
  I.modeBtlBtn.addEventListener('click', () => setMode('btl'));
  [
    I.purchasePrice, I.depositType, I.depositValue, I.otherPurchaseCosts, I.productFee, I.productFeeTreatment,
    I.repaymentType, I.interestRatePercent, I.termYears, I.hpiGrowth, I.cpiPercent, I.discountRate, I.sellAtEnd,
    I.agentPercent, I.agentVatPercent, I.saleLegal, I.buyerType, I.surchargeRefund, I.cgtRate, I.cgtAllowance, I.prrToggle,
    I.currentRent, I.rentInflation, I.ownerMaintenancePctOfValue, I.ownerService, I.ownerInsurance, I.ownerGroundRent,
    I.btlRentMonthly, I.btlVoidsPct, I.btlMgmtPct, I.btlCompliance, I.landlordTaxBand, I.section24
  ].forEach(el => { el.addEventListener('input', recomputeAll); el.addEventListener('change', recomputeAll); });
  I.addCapex.addEventListener('click', () => addCapexRow());
  I.resetBtn.addEventListener('click', () => { resetDefaults(); recomputeAll(); });
  I.downloadCsv.addEventListener('click', downloadCsv);
  I.printPdf.addEventListener('click', () => window.print());
}

window.addEventListener('DOMContentLoaded', () => {
  resetDefaults();
  attach();
  setMode('owner');
});


