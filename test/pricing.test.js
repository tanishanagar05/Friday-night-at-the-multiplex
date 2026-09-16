import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBooking, importSeatPrices, parseMoneyToPaise, PricingError } from '../src/pricing.js';

test('parses common rupee formats into integer paise', () => {
  assert.equal(parseMoneyToPaise('₹1,250.50'), 125050);
  assert.equal(parseMoneyToPaise(' 400 '), 40000);
  assert.throws(() => parseMoneyToPaise('-10'), /non-negative/);
});

test('imports, de-duplicates case-insensitively, and reports bad rows', () => {
  const result = importSeatPrices([
    { name: 'Silver', price: '250' },
    { name: 'silver', price: '₹275.00' },
    { name: 'Gold', price: '' },
    { name: 'Recliner', price: '-10' },
    { name: '  ', price: '50' }
  ]);
  assert.deepEqual(result.prices, { silver: 27500 });
  assert.equal(result.importedCount, 2);
  assert.equal(result.uniqueCount, 1);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.rejectedCount, 3);
  assert.deepEqual(result.deduplicated, [{ name: 'silver', replacedPrice: '₹250.00', retainedPrice: '₹275.00', index: 1 }]);
});

test('calculates discount, capped membership, fee, and GST in paise', () => {
  const quote = calculateBooking({
    seats: ['silver', 'GOLD'],
    priceList: { Silver: 25000, Gold: 40000 },
    festivalDiscount: '50',
    member: true,
    memberPercent: 10,
    memberCap: 5000,
    convenienceFee: 250,
    gstPercent: 18
  });
  assert.deepEqual(quote.paise, { subtotal: 65000, flatDiscount: 5000, memberDiscount: 5000, fee: 500, gst: 9990, total: 65490 });
  assert.equal(quote.breakdown.total, '₹654.90');
});

test('rejects an unavailable or sold-out class', () => {
  assert.throws(() => calculateBooking({ seats: ['IMAX'], priceList: { Silver: 25000 } }), /unavailable/);
  assert.throws(() => calculateBooking({ seats: [{ class: 'Silver', available: false }], priceList: { Silver: 25000 } }), /sold out/);
});