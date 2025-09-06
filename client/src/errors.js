export const ERROR_MESSAGES = {
  unauthorized: 'Требуется авторизация',
  internal_error: 'Произошла ошибка сервера. Попробуйте позже.',
  account_locked: 'Аккаунт заблокирован',
  already_confirmed: 'Электронная почта уже подтверждена',
  bank_account_exists: 'Банковский счёт уже указан',
  bank_account_invalid: 'Неверные реквизиты счёта',
  bank_account_locked: 'Банковский счёт заблокирован',
  bank_account_not_found: 'Банковский счёт не найден',
  bank_not_found: 'Банк не найден',
  country_not_found: 'Страна не найдена',
  document_type_not_found: 'Тип документа не найден',
  email_exists: 'Email уже зарегистрирован',
  inn_exists: 'ИНН уже зарегистрирован',
  inn_not_found: 'ИНН не найден',
  invalid_code: 'Неверный код',
  invalid_credentials: 'Неверные учётные данные',
  invalid_passport: 'Неверные данные паспорта',
  invalid_token: 'Некорректный или истёкший токен',
  invalid_token_type: 'Некорректный тип токена',
  invalid_type_id: 'Некорректный тип нормативного упражнения',
  invalid_value: 'Некорректное значение',
  weak_password:
    'Пароль слишком простой. Минимум 8 символов, латинские буквы и цифры. Рекомендуем добавить заглавные буквы и спецсимволы.',
  invalid_email: 'Неверный формат email',
  invalid_phone: 'Неверный номер телефона',
  sex_required: 'Укажите пол',
  invalid_birth_date: 'Введите корректную дату рождения',
  missing_token: 'Отсутствует токен авторизации',
  passport_exists: 'Паспорт уже добавлен',
  passport_not_found: 'Паспорт не найден',
  phone_exists: 'Телефон уже зарегистрирован',
  role_not_found: 'Роль не найдена',
  snils_exists: 'СНИЛС уже зарегистрирован',
  snils_not_found: 'СНИЛС не найден',
  status_not_found: 'Статус не найден',
  status_required: 'Не указан статус',
  taxation_not_found: 'Налоговый статус не найден',
  certificate_not_found: 'Медицинское заключение не найдено',
  ground_not_found: 'Площадка не найдена',
  training_not_found: 'Тренировка не найдена',
  registration_not_found: 'Запись не найдена',
  registration_closed: 'Запись закрыта',
  cancellation_deadline_passed:
    'Нельзя отменить запись менее чем за 48 часов до начала',
  cancellation_forbidden: 'Отменять запись могут только участники',
  already_registered: 'Уже зарегистрированы',
  referee_group_not_found: 'Группа судей не найдена',
  access_denied: 'Доступ запрещен',
  invalid_address: 'Некорректный адрес',
  user_exists: 'Пользователь уже существует',
  user_not_found: 'Пользователь не найден',
  file_too_large: 'Файл слишком большой',
  invalid_file_type: 'Недопустимый тип файла',
  accepted_required: 'Необходимо согласие с правилами',
  address_not_found: 'Адрес не найден',
  awaiting_confirmation: 'Ожидается подтверждение',
  email_unconfirmed: 'Электронная почта не подтверждена',
  password_change_required:
    'Необходимо сменить пароль перед продолжением работы',
  EBADCSRFTOKEN: 'Сессия устарела. Обновите страницу.',
  invalid_current_password: 'Неверный текущий пароль',
  file_required: 'Не выбран файл',
  active_ticket_exists: 'Есть активное обращение данного типа',
  registration_incomplete: 'Регистрация не завершена',
  status_unknown: 'Неизвестный статус',
  not_found: 'Не найдено',
  course_not_found: 'Курс не назначен',
  invalid_vehicle: 'Введите корректно марку и модель',
  invalid_number: 'Введите корректный госномер',
  vehicle_qc1:
    'Попробуйте ввести марку или номер иначе или оставить только марку',
  vehicle_not_found: 'Транспортное средство не найдено',
  vehicle_limit: 'Достигнут лимит транспортных средств',
  // Availability
  availability_day_locked: 'День недоступен для редактирования',
  availability_limited_96h:
    'За 96 часов до дня изменения ограничены: доступен только «Свободен»',
  invalid_partial_time: 'Укажите корректное время для частичной доступности',
  invalid_status: 'Некорректный статус',
  // External sync / integrations
  external_db_unavailable: 'Внешняя система недоступна. Попробуйте позже.',
  external_sync_failed:
    'Не удалось сохранить изменения во внешней системе. Попробуйте позже.',
  metrics_error:
    'Не удалось получить метрики. Попробуйте позже или обратитесь к администратору.',
  sync_trigger_failed: 'Не удалось запустить синхронизацию. Попробуйте позже.',
  taxation_trigger_failed: 'Не удалось запустить проверку налогообложения.',
  job_not_restartable: 'Эту задачу нельзя перезапустить вручную.',
  invalid_job: 'Неизвестная задача',
  // Match agreements / participation
  forbidden_not_match_member:
    'Недоступно: вы не участник этого матча. Требуется привязка к команде.',
  match_teams_not_set:
    'Данные о командах для этого матча ещё не установлены. Обратитесь к администратору лиги.',
  match_not_found: 'Матч не найден',
  team_not_in_match: 'Команда не относится к этому матчу',
  player_not_in_team: 'Некорректный список игроков для этой команды',
  team_id_required: 'Не указана команда',
  player_ids_must_be_array: 'Некорректный формат списка игроков',
  player_ids_must_be_array_of_strings: 'Некорректные идентификаторы игроков',
  forbidden_not_team_member:
    'Недостаточно прав для редактирования состава команды',
  too_many_goalkeepers: 'В составе на матч не может быть более двух вратарей',
  too_many_field_players: 'Нельзя выбрать более 20 полевых игроков',
  too_few_goalkeepers: 'Минимум 1 вратарь в заявке',
  too_few_field_players: 'Минимум 5 полевых игроков в заявке',
  // Double protocol (составы 1 и 2)
  squad_number_required:
    'Для каждого выбранного игрока укажите состав (1 или 2)',
  too_few_or_many_goalkeepers:
    'В каждом составе должно быть от 1 до 2 вратарей',
  invalid_field_players_for_double:
    'В каждом составе должно быть от 12 до 13 полевых игроков',
  too_many_players_in_squad: 'В каждом составе нельзя выбрать более 15 игроков',
  too_many_goalkeepers_both:
    'Можно указать только одного вратаря для обоих составов',
  too_few_coaches: 'Минимум 2 тренера в заявке',
  too_many_officials: 'Нельзя выбрать более 8 официальных представителей',
  head_coach_required: 'Необходимо назначить главного тренера команды',
  too_many_coaches_per_squad:
    'В каждом составе нельзя выбрать более 4 тренеров',
  gk_both_requires_three:
    'Для отметки «Оба состава» необходимо выбрать минимум трёх вратарей',
  // Leadership
  captain_required: 'Необходимо указать капитана команды',
  too_many_captains: 'Можно выбрать только одного капитана',
  too_many_assistants: 'Можно выбрать не более двух ассистентов капитана',
  captain_must_be_field_player: 'Капитаном может быть только полевой игрок',
  assistant_must_be_field_player: 'Ассистентом может быть только полевой игрок',
  captain_cannot_be_assistant: 'Капитан не может быть ассистентом одновременно',
  too_many_head_coaches: 'Можно выбрать только одного главного тренера',
  staff_role_required: 'Выберите должность для всех выбранных представителей',
  staff_ids_must_be_array: 'Некорректный формат списка представителей',
  staff_ids_must_be_array_of_strings:
    'Некорректные идентификаторы представителей',
  staff_not_in_team: 'Некорректный представитель команды',
  match_role_required: 'Выберите амплуа для всех выбранных игроков',
  match_number_required: 'Укажите номер для всех выбранных игроков',
  duplicate_match_numbers: 'Игровые номера в матче должны быть уникальными',
  conflict_lineup_version:
    'Состав был изменён с другого устройства. Обновили данные. Повторяем сохранение…',
  conflict_staff_version:
    'Список представителей был изменён с другого устройства. Обновили данные. Повторяем сохранение…',
  validation_error: 'Проверьте корректность введённых данных',
  rate_limited:
    'Слишком много запросов. Пожалуйста, подождите и попробуйте снова.',
};

export function translateError(code) {
  if (!code) return '';
  return ERROR_MESSAGES[code] || 'Ошибка запроса';
}
