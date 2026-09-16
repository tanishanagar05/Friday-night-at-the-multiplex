const MONEY_PATTERN = /^\s*(?:₹|INR)?\s*(-?[0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)\s*$/i;

export class PricingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PricingError';
    this.status = status;
  }
}

export function parseMoneyToPaise(value, fieldName = 'price') {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || Math.round(value * 100) !== value * 100) {
      throw new PricingError(`${fieldName} must be a non-negative amount with at most 2 decimals`);
    }
    return Math.round(value * 100);
  }

  if (typeof value !== 'string') {
    throw new PricingError(`${fieldName} must be a money amount`);
  }

  const match = value.match(MONEY_PATTERN);
  if (!match) {
    throw new PricingError(`${fieldName} must look like 250, 250.50, or ₹250.50`);
  }

  const normalized = match[1].replaceAll(',', '');
  if (normalized.startsWith('-')) {
    throw new PricingError(`${fieldName} must be non-negative`);
  }
  const [rupees, paise = ''] = normalized.split('.');
  return Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
}

export function formatMoney(paise) {
  if (!Number.isInteger(paise) || paise < 0) {
    throw new PricingError('Money values must be non-negative integer paise');
  }
  return `₹${Math.floor(paise / 100).toLocaleString('en-IN')}.${String(paise % 100).padStart(2, '0')}`;
}

function roundPercent(paise, percentage) {
  return Math.floor((paise * percentage + 50) / 100);
}

export function importSeatPrices(rows) {
  if (!Array.isArray(rows)) {
    throw new PricingError('prices must be an array');
  }

  const prices = {};
  const imported = [];
  const deduplicated = [];
  const rejected = [];
  let duplicateCount = 0;

  rows.forEach((row, index) => {
    const rawName = row && (row.name ?? row.class ?? row.seatClass);
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const key = name.toLowerCase();
    const rawPrice = row && (row.price ?? row.amount);

    if (!name) {
      rejected.push({ index, reason: 'Seat class name is blank' });
      return;
    }
    if (rawPrice === '' || rawPrice === null || rawPrice === undefined) {
      rejected.push({ index, name, reason: 'Price is blank' });
      return;
    }

    let paise;
    try {
      paise = parseMoneyToPaise(rawPrice, `price for ${name}`);
    } catch (error) {
      rejected.push({ index, name, reason: error.message });
      return;
    }
    if (paise <= 0) {
      rejected.push({ index, name, reason: 'Price must be greater than zero' });
      return;
    }

    if (Object.hasOwn(prices, key)) {
      duplicateCount += 1;
      deduplicated.push({ name, replacedPrice: formatMoney(prices[key].paise), retainedPrice: formatMoney(paise), index });
    }
    prices[key] = { name, paise };
    imported.push({ index, name, price: formatMoney(paise) });
  });

  return {
    prices: Object.fromEntries(Object.values(prices).map(({ name, paise }) => [name, paise])),
    imported,
    deduplicated,
    rejected,
    importedCount: imported.length,
    uniqueCount: Object.keys(prices).length,
    duplicateCount,
    rejectedCount: rejected.length
  };
}

export function calculateBooking({ seats, priceList, festivalDiscount = 0, member = false, memberPercent = 10, memberCap = 15000, convenienceFee = 250, gstPercent = 18 }) {
  if (!Array.isArray(seats) || seats.length === 0) throw new PricingError('At least one seat is required');
  if (!priceList || typeof priceList !== 'object') throw new PricingError('A price list is required');
  if (memberPercent < 0 || memberPercent > 100 || gstPercent < 0 || gstPercent > 100) throw new PricingError('Percentages must be between 0 and 100');

  const ticketLines = seats.map((seat, index) => {
    const requested = typeof seat === 'string' ? seat : seat?.class;
    const key = typeof requested === 'string' ? requested.trim().toLowerCase() : '';
    const suppliedName = Object.keys(priceList).find((name) => name.trim().toLowerCase() === key);
    const price = suppliedName === undefined ? undefined : priceList[suppliedName];
    if (!price) throw new PricingError(`Seat class "${requested || `at position ${index + 1}`}" is unavailable`);
    if (typeof seat === 'object' && seat.available === false) throw new PricingError(`Seat class "${requested}" is sold out`);
    return { class: requested, pricePaise: Number(price) };
  });

  const subtotal = ticketLines.reduce((sum, line) => sum + line.pricePaise, 0);
  const flatDiscount = Math.min(parseMoneyToPaise(festivalDiscount, 'festivalDiscount'), subtotal);
  const afterFestival = subtotal - flatDiscount;
  const requestedMemberDiscount = member ? roundPercent(afterFestival, memberPercent) : 0;
  const memberDiscount = Math.min(requestedMemberDiscount, Math.max(0, Number(memberCap)));
  const taxableTickets = afterFestival - memberDiscount;
  const fee = ticketLines.length * Number(convenienceFee);
  const gst = roundPercent(taxableTickets + fee, gstPercent);
  const total = taxableTickets + fee + gst;

  return {
    currency: 'INR',
    tickets: ticketLines.map(({ class: seatClass, pricePaise }) => ({ class: seatClass, amount: formatMoney(pricePaise) })),
    breakdown: {
      subtotal: formatMoney(subtotal),
      festivalDiscount: formatMoney(flatDiscount),
      memberDiscount: formatMoney(memberDiscount),
      convenienceFee: formatMoney(fee),
      gst: formatMoney(gst),
      total: formatMoney(total)
    },
    paise: { subtotal, flatDiscount, memberDiscount, fee, gst, total },
    rules: { memberPercent, memberCap: formatMoney(Number(memberCap)), gstPercent }
  };
}