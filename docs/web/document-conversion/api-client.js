export async function getCapabilities() {
  return requestJson('/v1/capabilities', { method: 'GET' });
}

export async function searchPdf(payload) {
  return requestJson('/v1/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function convertDocument(payload) {
  return requestJson('/v1/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function requestJson(path, init) {
  let response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    throw new Error(`NETWORK_ERROR: ${error instanceof Error ? error.message : String(error)}`);
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`HTTP_${response.status}: server returned non-JSON content`);
  }
  if (!response.ok) {
    const code = payload?.error?.code || `HTTP_${response.status}`;
    const message = payload?.error?.message || response.statusText;
    throw new Error(`${code}: ${message}`);
  }
  return payload;
}
