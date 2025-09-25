function sanitize(obj) {
  const {
    id,
    name,
    alias,
    group_alias,
    groupAlias,
    group_name,
    groupName,
    department_alias,
    departmentAlias,
    department_name,
    departmentName,
    display_order,
    displayOrder,
  } = obj;

  return {
    id,
    name,
    alias,
    group_alias: group_alias ?? groupAlias ?? null,
    group_name: group_name ?? groupName ?? null,
    department_alias: department_alias ?? departmentAlias ?? null,
    department_name: department_name ?? departmentName ?? null,
    display_order: display_order ?? displayOrder ?? null,
  };
}

function toPublic(role) {
  if (!role) return null;
  const plain =
    typeof role.get === 'function' ? role.get({ plain: true }) : role;
  return sanitize(plain);
}

export default { toPublic };
