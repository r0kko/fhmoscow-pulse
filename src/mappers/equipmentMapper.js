function toPublic(item) {
  if (!item) return null;
  const plain =
    typeof item.get === 'function' ? item.get({ plain: true }) : item;
  const {
    id,
    number,
    EquipmentType: type,
    EquipmentManufacturer: manufacturer,
    EquipmentSize: size,
    Owner,
    assignment_document_id,
    AssignmentDocument,
    createdAt,
    updatedAt,
  } = plain;
  const document = AssignmentDocument
    ? {
        id: AssignmentDocument.id,
        number: AssignmentDocument.number,
        status: AssignmentDocument.DocumentStatus
          ? {
              alias: AssignmentDocument.DocumentStatus.alias,
              name: AssignmentDocument.DocumentStatus.name,
            }
          : null,
      }
    : null;
  return {
    id,
    number,
    type: type ? { id: type.id, name: type.name } : null,
    manufacturer: manufacturer
      ? { id: manufacturer.id, name: manufacturer.name }
      : null,
    size: size ? { id: size.id, name: size.name } : null,
    owner: Owner
      ? {
          id: Owner.id,
          first_name: Owner.first_name,
          last_name: Owner.last_name,
          patronymic: Owner.patronymic,
          email: Owner.email || null,
          phone: Owner.phone || null,
        }
      : null,
    document_id: assignment_document_id || null,
    document,
    status: Owner
      ? 'issued'
      : assignment_document_id
        ? 'awaiting'
        : 'free',
    created_at: createdAt ? new Date(createdAt).toISOString() : null,
    updated_at: updatedAt ? new Date(updatedAt).toISOString() : null,
  };
}

function toPublicArray(items) {
  return (items || []).map(toPublic);
}

export default { toPublic, toPublicArray };
