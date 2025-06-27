function sanitize(obj) {
  const { id, signing_date, valid_until, Document, DocumentStatus } = obj;
  const out = { id, signing_date, valid_until };
  if (Document) {
    out.document = Document.alias;
    out.document_name = Document.name;
    if (Document.DocumentType) {
      out.document_type = Document.DocumentType.alias;
      out.document_type_name = Document.DocumentType.name;
    }
  }
  if (DocumentStatus) {
    out.status = DocumentStatus.alias;
    out.status_name = DocumentStatus.name;
  }
  return out;
}

function toPublic(record) {
  if (!record) return null;
  const plain =
    typeof record.get === 'function' ? record.get({ plain: true }) : record;
  return sanitize(plain);
}

function toPublicArray(arr = []) {
  return arr.map(toPublic);
}

export default { toPublic, toPublicArray };
