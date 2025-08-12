function toPublic(vehicle) {
  if (!vehicle) return null;
  const { id, brand, model, number, is_active } =
    typeof vehicle.get === 'function' ? vehicle.get({ plain: true }) : vehicle;
  return { id, brand, model, number, is_active };
}

export default { toPublic };
