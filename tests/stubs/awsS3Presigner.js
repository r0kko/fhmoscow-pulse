export async function getSignedUrl(_client, command, options = {}) {
  const key = command?.input?.Key || 'unknown';
  const expiresIn = options.expiresIn ?? 0;
  return `https://signed.mock/${encodeURIComponent(key)}?expires=${expiresIn}`;
}

export default { getSignedUrl };
