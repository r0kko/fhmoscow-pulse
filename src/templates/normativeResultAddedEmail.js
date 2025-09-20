import { buildNormativeEmail } from './helpers/normativeEmail.js';

export function renderNormativeResultAddedEmail(result) {
  const typeName =
    result?.NormativeType?.name || result?.type?.name || 'нормативу';
  const groupName =
    result?.group?.name ||
    result?.NormativeType?.NormativeGroupTypes?.[0]?.NormativeGroup?.name ||
    '';
  const intro = `Добавлен результат по нормативу <strong>${typeName}</strong>${groupName ? ` (${groupName})` : ''}.`;
  return buildNormativeEmail(result, {
    subject: 'Добавлен результат норматива',
    intro,
    previewText: `${typeName}${groupName ? ` (${groupName})` : ''}: добавлен результат`,
  });
}

export default { renderNormativeResultAddedEmail };
