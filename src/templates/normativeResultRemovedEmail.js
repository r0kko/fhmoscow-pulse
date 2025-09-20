import { buildNormativeEmail } from './helpers/normativeEmail.js';

export function renderNormativeResultRemovedEmail(result) {
  const typeName =
    result?.NormativeType?.name || result?.type?.name || 'нормативу';
  const groupName =
    result?.group?.name ||
    result?.NormativeType?.NormativeGroupTypes?.[0]?.NormativeGroup?.name ||
    '';
  const intro = `Результат по нормативу <strong>${typeName}</strong>${groupName ? ` (${groupName})` : ''} удален.`;
  return buildNormativeEmail(result, {
    subject: 'Результат норматива удален',
    intro,
    previewText: `${typeName}${groupName ? ` (${groupName})` : ''}: результат удален`,
  });
}

export default { renderNormativeResultRemovedEmail };
