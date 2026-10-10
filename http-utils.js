// Tiny helpers shared across the backend. Kept dependency-free on purpose —
// this app is small enough that a micro-framework would add more ceremony
// than it saves.

export function sendJSON(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
  return undefined;
}

// Reads and JSON-parses an incoming request body. Resolves to {} for empty
// bodies so handlers can safely destructure without an extra null check.
export function readJSONBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      // Basic guard against runaway payloads.
      if (raw.length > 1_000_000) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

// Reads x-www-form-urlencoded bodies (PayFast's ITN webhook posts this format).
export function readFormBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 200_000) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      const params = new URLSearchParams(raw);
      const obj = {};
      for (const [key, value] of params.entries()) obj[key] = value;
      resolve(obj);
    });
    req.on('error', reject);
  });
}