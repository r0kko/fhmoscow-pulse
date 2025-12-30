export const MATCH_FORMAT_OPTIONS = Object.freeze([
  { value: 'FIVE_FIVE_FULL', label: '5 на 5 · На все поле' },
  { value: 'FOUR_FOUR_FULL', label: '4 на 4 · На все поле' },
  { value: 'FOUR_FOUR_HALF', label: '4 на 4 · На половину поля' },
  { value: 'THREE_THREE_FULL', label: '3 на 3 · На все поле' },
  { value: 'THREE_THREE_HALF', label: '3 на 3 · На половину поля' },
  { value: 'OTHER', label: 'Иное' },
]);

export const REFEREE_PAYMENT_OPTIONS = Object.freeze([
  { value: 'HOME_TEAM', label: 'Команда - "хозяин поля"' },
  { value: 'ORGANIZER', label: 'Организатор соревнований' },
  { value: 'OTHER', label: 'Иное' },
]);

export const MATCH_FORMAT_VALUES = new Set(
  MATCH_FORMAT_OPTIONS.map((option) => option.value)
);
export const REFEREE_PAYMENT_VALUES = new Set(
  REFEREE_PAYMENT_OPTIONS.map((option) => option.value)
);
