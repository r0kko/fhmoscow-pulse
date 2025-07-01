function toPublic(file, url) {
  if (!file) return null;
  const plain = typeof file.get === 'function' ? file.get({ plain: true }) : file;
  return {
    id: plain.id,
    type: plain.type,
    name: plain.original_name,
    url,
  };
}

export default { toPublic };
