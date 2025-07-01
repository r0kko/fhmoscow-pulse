function toPublic(attachment, url) {
  if (!attachment || !attachment.File) return null;
  const file =
    typeof attachment.File.get === 'function'
      ? attachment.File.get({ plain: true })
      : attachment.File;
  return {
    id: file.id,
    type:
      attachment.MedicalCertificateType?.alias ||
      attachment.MedicalCertificateType?.name,
    name: file.original_name,
    url,
  };
}

export default { toPublic };
