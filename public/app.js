let priceList = {};
const samplePrices = '[{"name":"Silver","price":"₹250"},{"name":"Gold","price":"400"},{"name":"Recliner","price":"650.00"}]';
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  $('theme-toggle').setAttribute('aria-label', dark ? 'Switch to light background' : 'Switch to dark background');
  $('theme-toggle').title = dark ? 'Switch to light theme' : 'Switch to dark theme';
  $('theme-toggle').querySelector('span').textContent = dark ? '☀' : '☾';
}

applyTheme(localStorage.getItem('multiplex-theme') === 'dark' ? 'dark' : 'light');

function setStatus(id, message, error = false) {
  $(id).textContent = message;
  $(id).classList.toggle('error', error);
}

$('theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('multiplex-theme', theme);
  applyTheme(theme);
});

function renderPrices() {
  $('price-list').innerHTML = Object.entries(priceList).map(([name, paise]) => `<button class="price-option" type="button" data-seat-class="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><strong>₹${(paise / 100).toFixed(2)}</strong><span class="add-mark">+</span></button>`).join('');
  document.querySelectorAll('.price-option').forEach((button) => button.addEventListener('click', () => addSeat(button.dataset.seatClass)));
}

function renderImportReport(result) {
  const imported = result.imported.map((row) => `<li><span>Row ${row.index + 1} · ${escapeHtml(row.name)}</span><strong>${escapeHtml(row.price)}</strong></li>`).join('');
  const duplicates = result.deduplicated.map((row) => `<li><span>${escapeHtml(row.name)} <small>row ${row.index + 1}</small></span><strong>${escapeHtml(row.replacedPrice)} → ${escapeHtml(row.retainedPrice)}</strong></li>`).join('');
  const rejected = result.rejected.map((row) => `<li><span>${escapeHtml(row.name || `Row ${row.index + 1}`)}</span><strong>${escapeHtml(row.reason)}</strong></li>`).join('');
  $('import-report').innerHTML = `
    <div class="report-section"><h3>Imported <span>${result.importedCount}</span></h3><ul>${imported || '<li class="muted">None</li>'}</ul></div>
    <div class="report-section"><h3>De-duplicated <span>${result.duplicateCount}</span></h3><ul>${duplicates || '<li class="muted">None</li>'}</ul></div>
    <div class="report-section"><h3>Rejected <span>${result.rejectedCount}</span></h3><ul>${rejected || '<li class="muted">None</li>'}</ul></div>`;
}

function addSeat(name) {
  const input = $('seat-classes');
  const seats = input.value.split(',').map((value) => value.trim()).filter(Boolean);
  seats.push(name);
  input.value = seats.join(', ');
  input.focus();
  setStatus('quote-status', `${name} added to the booking.`);
  $('booking-form').requestSubmit();
}

function setBusy(buttonId, busy) {
  const button = $(buttonId);
  button.disabled = busy;
  button.classList.toggle('is-loading', busy);
}

function clearBill() {
  $('ticket-lines').innerHTML = '<p class="empty">Your line-by-line total will appear here.</p>';
  $('bill-count').textContent = '0 tickets';
  ['subtotal', 'festival', 'member-saving', 'fee-total', 'gst-total', 'total'].forEach((id) => {
    $(id).textContent = id === 'festival' || id === 'member-saving' ? '-₹0.00' : '₹0.00';
  });
}

async function post(path, payload) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}

function applyImportResult(result) {
  priceList = result.prices;
  renderPrices();
  renderImportReport(result);
  setStatus('import-status', `${result.uniqueCount} unique classes ready; ${result.duplicateCount} duplicate${result.duplicateCount === 1 ? '' : 's'} merged, ${result.rejectedCount} rejected.`);
}

$('booking-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy('quote-button', true);
  try {
    const result = await post('/api/quote', {
      seats: $('seat-classes').value.split(',').map((value) => value.trim()).filter(Boolean),
      priceList,
      festivalDiscount: $('festival-discount').value,
      member: $('member').checked,
      memberPercent: Number($('member-percent').value),
      memberCap: 15000,
      convenienceFee: Math.round(Number($('fee').value) * 100),
      gstPercent: Number($('gst').value)
    });
    const { breakdown, tickets } = result;
    $('bill-count').textContent = `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`;
    $('ticket-lines').innerHTML = tickets.map((ticket) => `<div class="ticket-line"><span>${escapeHtml(ticket.class)}</span><strong>${escapeHtml(ticket.amount)}</strong></div>`).join('');
    $('subtotal').textContent = breakdown.subtotal;
    $('festival').textContent = `-${breakdown.festivalDiscount}`;
    $('member-saving').textContent = `-${breakdown.memberDiscount}`;
    $('fee-total').textContent = breakdown.convenienceFee;
    $('gst-total').textContent = breakdown.gst;
    $('total').textContent = breakdown.total;
    $('total').classList.remove('total-pulse');
    requestAnimationFrame(() => $('total').classList.add('total-pulse'));
    setStatus('quote-status', 'Total calculated from the current price list.');
  } catch (error) { setStatus('quote-status', error.message, true); }
  finally { setBusy('quote-button', false); }
});

document.querySelectorAll('#seat-classes, #festival-discount, #fee, #gst, #member-percent, #member').forEach((control) => {
  control.addEventListener('change', () => $('booking-form').requestSubmit());
});

$('clear-button').addEventListener('click', () => {
  $('seat-classes').value = '';
  clearBill();
  setStatus('quote-status', 'Booking cleared.');
});

post('/api/import-prices', { prices: JSON.parse(samplePrices) })
  .then((result) => {
    applyImportResult(result);
    $('booking-form').requestSubmit();
  })
  .catch((error) => setStatus('import-status', error.message, true));