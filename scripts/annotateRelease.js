import fs from 'fs';

import fetch from 'node-fetch';

async function main() {
  const GRAFANA_URL = process.env.GRAFANA_URL || 'http://localhost:3001';
  const GRAFANA_TOKEN = process.env.GRAFANA_TOKEN; // create API key in Grafana
  const text = process.argv.slice(2).join(' ') || 'Release';
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
  const tags = [process.env.NODE_ENV || 'dev', 'release'];
  const payload = {
    time: Date.now(),
    tags,
    text: `${text} v${pkg.version}`,
  };
  if (!GRAFANA_TOKEN) {
    throw new Error('GRAFANA_TOKEN is not set');
  }
  const res = await fetch(`${GRAFANA_URL}/api/annotations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GRAFANA_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Grafana annotation failed: ${res.status} ${t}`);
  }
  console.log('Grafana annotation created');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
