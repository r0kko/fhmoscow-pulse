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
  } = plain;
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
        }
      : null,
    document_id: assignment_document_id || null,
  };
}

function toPublicArray(items) {
  return (items || []).map(toPublic);
}

export default { toPublic, toPublicArray };
