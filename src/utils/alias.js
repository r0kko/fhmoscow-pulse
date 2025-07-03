export default function generateAlias(name) {
  const map = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'c',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ы: 'y',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };
  const translit = String(name)
    .split('')
    .map((c) => map[c.toLowerCase()] || c)
    .join('');
  return translit
    .replace(/[^0-9a-zA-Z]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}
