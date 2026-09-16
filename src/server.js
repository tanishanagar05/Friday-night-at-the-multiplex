import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateBooking, importSeatPrices, PricingError } from './pricing.js';

const root = fileURLToPath(new URL('../public', import.meta.url));
const port = Number(process.env.PORT || 3000);
const defaultPrices = { Silver: 25000, Gold: 40000, Recliner: 65000 };

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function requestBody(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new PricingError('Request body must be valid JSON');
  }
}

async function serveStatic(request, response) {
  const requested = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const file = normalize(join(root, requested));
  if (!file.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  try {
    const content = await readFile(file);
    const contentType = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }[extname(file)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url.startsWith('/api/defaults')) {
      sendJson(response, 200, { prices: defaultPrices, defaults: { festivalDiscount: 0, memberPercent: 10, memberCap: 15000, convenienceFee: 250, gstPercent: 18 } });
      return;
    }
    if (request.method === 'POST' && request.url === '/api/import-prices') {
      sendJson(response, 200, importSeatPrices((await requestBody(request)).prices));
      return;
    }
    if (request.method === 'POST' && request.url === '/api/quote') {
      sendJson(response, 200, calculateBooking(await requestBody(request)));
      return;
    }
    if (request.method === 'GET') {
      await serveStatic(request, response);
      return;
    }
    sendJson(response, 404, { error: 'Route not found' });
  } catch (error) {
    const status = error instanceof PricingError ? error.status : 500;
    sendJson(response, status, { error: error.message || 'Unexpected server error' });
  }
});

server.listen(port, () => console.log(`Multiplex counter running at http://localhost:${port}`));