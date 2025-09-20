import { buildNormativeEmail } from './helpers/normativeEmail.js';

export function renderNormativeResultUpdatedEmail(result) {
  const typeName =
    result?.NormativeType?.name || result?.type?.name || 'нормативу';
  const groupName =
    result?.group?.name ||
    result?.NormativeType?.NormativeGroupTypes?.[0]?.NormativeGroup?.name ||
    '';
  const intro = `Результат по нормативу <strong>${typeName}</strong>${groupName ? ` (${groupName})` : ''} изменен.`;
  return buildNormativeEmail(result, {
    subject: 'Изменен результат норматива',
    intro,
    previewText: `${typeName}${groupName ? ` (${groupName})` : ''}: результат обновлен`,
  });
}

export default { renderNormativeResultUpdatedEmail };
