import path from 'path';

import { Op } from 'sequelize';
import PDFDocument from 'pdfkit';

import {
  Document,
  DocumentType,
  SignType,
  File,
  DocumentUserSign,
  UserSignType,
  DocumentStatus,
  User,
} from '../models/index.js';
import * as Models from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import { applyFonts, applyFirstPageHeader, applyFooter } from '../utils/pdf.js';

import fileService from './fileService.js';
import emailService from './emailService.js';

function formatDateHuman(date) {
  if (!date) return '«__» __________ ____ г.';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '«__» __________ ____ г.';
  const day = String(d.getDate()).padStart(2, '0');
  const months = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `«${day}» ${month} ${year} г.`;
}

function fio(user) {
  if (!user) return '';
  return [user.last_name, user.first_name, user.patronymic]
    .filter(Boolean)
    .join(' ');
}

/* istanbul ignore next */
async function buildPersonalDataConsentPdf(user, meta = {}) {
  const chunks = [];
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 30, bottom: 80, left: 30, right: 30 },
    bufferPages: true,
    info: { Title: 'Согласие на обработку персональных данных' },
  });
  doc.on('data', (d) => chunks.push(d));
  const done = new Promise((resolve) => doc.on('end', () => resolve()));

  const fonts = applyFonts(doc); // returns { regular, bold }
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const clean = (v) =>
    v
      ? String(v)
          .replace(/[\r\n]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : v;
  const NBSP = '\u00A0';
  const protectTypography = (s) =>
    typeof s === 'string'
      ? s
          // Keep prepositions/conjunctions with the next word (Russian typographic norm)
          .replace(/\b([ВвКкСсУуОоИи])\s/g, `$1${NBSP}`)
          // Bind numero sign with the number
          .replace(/\s№\s*/g, `${NBSP}№ `)
      : s;
  const seg = (text, bold = false) => ({
    text: protectTypography(text ?? ''),
    bold,
  });
  const tokenize = (text) =>
    (text || '').split(/(\s+)/).filter((t) => t.length > 0);
  const measure = (doc, fonts, token, bold) => {
    const prev = doc._font;
    try {
      doc.font(bold ? fonts.bold : fonts.regular);
    } catch {
      void 0;
    }
    const w = doc.widthOfString(token);
    if (prev) {
      try {
        doc.font(prev.name || prev);
      } catch {
        void 0;
      }
    }
    return w;
  };
  const layoutJustifiedStyledParagraph = (doc, fonts, segments, width) => {
    const startX = doc.page.margins.left;
    let y = doc.y;
    const lines = [];
    let line = [];
    let lineWidth = 0;
    const isStretchableSpace = (t) => t === ' ';
    // const isSpace = (t) => /^\s+$/.test(t) && t !== NBSP;
    const pushLine = () => {
      // Trim ending spaces
      while (line.length && /^\s+$/.test(line[line.length - 1].text))
        line.pop();
      lines.push({ items: line, width: lineWidth });
      line = [];
      lineWidth = 0;
    };
    // Build tokens with style
    const styledTokens = [];
    segments.forEach((s) => {
      tokenize(s.text).forEach((t) =>
        styledTokens.push({ text: t, bold: s.bold })
      );
    });
    let i = 0;
    while (i < styledTokens.length) {
      const { text, bold } = styledTokens[i];
      const isWs = /^\s+$/.test(text);
      // Collapse multiple spaces
      if (isWs && (!line.length || /^\s+$/.test(line[line.length - 1]?.text))) {
        i++;
        continue;
      }
      const tokenWidth = measure(doc, fonts, text, bold);
      const maxWidth = width;
      const remaining = maxWidth - lineWidth;
      if (tokenWidth <= remaining || (!line.length && tokenWidth <= maxWidth)) {
        // Fits into current line
        line.push({ text, bold, width: tokenWidth });
        lineWidth += tokenWidth;
        i++;
      } else if (line.length) {
        // Start a new line and re-evaluate token
        pushLine();
      } else {
        // Single token longer than the whole line: split it
        // Find max chars that fit, add hyphen to first part
        let cut = 1;
        let part = text.slice(0, cut);
        let partWidth = measure(doc, fonts, part + '-', bold);
        while (cut < text.length && partWidth <= maxWidth) {
          cut++;
          part = text.slice(0, cut);
          partWidth = measure(doc, fonts, part + '-', bold);
        }
        // Step back one char to fit
        cut = Math.max(1, cut - 1);
        part = text.slice(0, cut);
        partWidth = measure(doc, fonts, part + '-', bold);
        const rest = text.slice(cut);
        line.push({ text: part + '-', bold, width: partWidth });
        lineWidth += partWidth;
        pushLine();
        // Replace current token with remainder and continue
        styledTokens[i] = { text: rest, bold };
      }
    }
    if (line.length) pushLine();
    // Draw lines with manual justification
    const lineHeight = doc.currentLineHeight(true);
    lines.forEach((ln, idx) => {
      const last = idx === lines.length - 1;
      let x = startX;
      const totalWidth = ln.items.reduce((s, it) => s + it.width, 0);
      const extra = Math.max(0, width - totalWidth);
      const stretchPoints = !last
        ? ln.items.filter((it) => isStretchableSpace(it.text)).length
        : 0;
      const extraPerSpace = stretchPoints > 0 ? extra / stretchPoints : 0;
      ln.items.forEach((it) => {
        try {
          doc.font(it.bold ? fonts.bold : fonts.regular);
        } catch {
          void 0;
        }
        doc.text(it.text, x, y, { lineBreak: false });
        x +=
          it.width + (isStretchableSpace(it.text) && !last ? extraPerSpace : 0);
      });
      y += lineHeight;
    });
    // Set cursor to next line start
    doc.x = startX;
    doc.y = y;
  };
  doc.font(fonts.regular);
  applyFirstPageHeader(doc);
  // Ensure content begins below the visual header band on the first page.
  try {
    const HEADER_TOP = 30; // matches header outer offset
    const HEADER_HEIGHT = 32; // logo height
    const HEADER_PADDING = 12; // breathing room under header
    const minY = HEADER_TOP + HEADER_HEIGHT + HEADER_PADDING;
    if (doc.y < minY) doc.y = minY;
  } catch {
    // ignore
  }

  const heading = 'Согласие на обработку персональных данных';
  try {
    doc.font(fonts.bold);
  } catch {
    /* empty */
  }
  doc.fontSize(14).text(heading, { align: 'center' });
  // Subtitle under the heading
  try {
    doc.moveDown(0.2);
    doc.fillColor('#666666');
    const savedFont = doc._font ? doc._font.name : null;
    try {
      doc.font('SB-Italic');
    } catch {
      /* keep current */
    }
    doc.fontSize(10).text('для спортивного судьи Федерации хоккея Москвы', {
      align: 'center',
    });
    if (savedFont) doc.font(savedFont);
    doc.fillColor('black');
  } catch {
    /* noop */
  }
  try {
    doc.font(fonts.regular);
  } catch {
    /* empty */
  }
  doc.moveDown(1);
  doc.fontSize(11);

  // Gather user details from DB
  const [passports, userAddresses, innRec, snilsRec] = await Promise.all([
    (
      Models.Passport?.findAll?.bind(Models.Passport) ||
      (() => Promise.resolve([]))
    )({
      where: { user_id: user.id },
      order: [['created_at', 'DESC']],
      attributes: [
        'series',
        'number',
        'issue_date',
        'issuing_authority',
        'issuing_authority_code',
        'place_of_birth',
      ],
    }),
    (
      Models.UserAddress?.findAll?.bind(Models.UserAddress) ||
      (() => Promise.resolve([]))
    )({
      where: { user_id: user.id },
      include: [
        { model: Models.Address, attributes: ['result', 'postal_code'] },
        { model: Models.AddressType, attributes: ['alias', 'name'] },
      ],
    }),
    (Models.Inn?.findOne?.bind(Models.Inn) || (() => Promise.resolve(null)))({
      where: { user_id: user.id },
      attributes: ['number'],
    }),
    (
      Models.Snils?.findOne?.bind(Models.Snils) || (() => Promise.resolve(null))
    )({
      where: { user_id: user.id },
      attributes: ['number'],
    }),
  ]);

  const passport = passports?.[0];
  const reg = (userAddresses || []).find(
    (ua) => ua.AddressType?.alias === 'REGISTRATION'
  );
  const regAdr = reg?.Address;

  const pSeries = passport?.series || '____';
  const pNumber = passport?.number || '_______';
  const pIssuer =
    clean(passport?.issuing_authority) || '____________________________';
  const pIssuerCode = clean(passport?.issuing_authority_code) || '_________';
  const pIssueDate = formatDateHuman(passport?.issue_date).replace(
    '____ г.',
    '____ г.'
  );
  const placeOfBirth =
    clean(passport?.place_of_birth) || '____________________';
  const regAddress =
    clean(regAdr?.result) || '_______________________________________________';
  const regPostal = regAdr?.postal_code ? `${regAdr.postal_code}, ` : '';
  const birthDate = formatDateHuman(user?.birth_date);
  const innNumber = innRec?.number || '______________';
  const snilsNumber = snilsRec?.number || '______________';

  // 1. Субъект — единый абзац, собираемый из сегментов с аккуратными пробелами
  layoutJustifiedStyledParagraph(
    doc,
    fonts,
    [
      seg('Я, '),
      seg(fio(user) || '____________________', true),
      seg(', дата рождения '),
      seg(birthDate, true),
      seg(', место рождения '),
      seg(placeOfBirth, true),
      seg(', паспорт: серия '),
      seg(pSeries, true),
      seg(' № '),
      seg(pNumber, true),
      seg(', выдан '),
      seg(`${pIssuer} `, true),
      seg(pIssueDate, true),
      seg(', код подразделения '),
      seg(pIssuerCode, true),
      seg(', зарегистрирован(а) по адресу: '),
      seg(`${regPostal}${regAddress}`, true),
      seg(', ИНН '),
      seg(innNumber, true),
      seg(', СНИЛС '),
      seg(snilsNumber, true),
      seg(
        '. Настоящим свободно, своей волей и в своем интересе даю свое согласие '
      ),
      seg('РОО «Федерация хоккея Москвы», ', true),
      seg('ОГРН 1037739762610, ', true),
      seg('ИНН 7708046206', true),
      seg(
        ', расположенной по адресу: 101000, г. Москва, Кривоколенный пер., д. 9, стр. 1 (далее – '
      ),
      seg('Оператор', true),
      seg('), на обработку моих '),
      seg('персональных данных', true),
      seg(' в соответствии с нижеизложенными '),
      seg('условиями', true),
      seg('.'),
    ],
    contentWidth
  );
  doc.moveDown();
  doc.text(
    'Настоящее согласие предоставляется в соответствии с Федеральным законом от 27.07.2006 № 152 ФЗ «О персональных данных» и иными применимыми нормативными правовыми актами. Согласие дано свободно, своей волей и в своих интересах, является конкретным, информированным, предметным и однозначным (ст. 9 Закона № 152 ФЗ).',
    { align: 'justify' }
  );
  doc.moveDown();

  doc
    .font(fonts.bold)
    .text('Настоящее согласие предоставляется исключительно в целях:', {
      align: 'left',
    });
  doc.moveDown(0.5);
  doc.font(fonts.regular);
  const goals = [
    'ведения моего учета как спортивного судьи и назначения на матчи и соревнования (формирование заявок, подготовка и публикация протоколов игр);',
    'организации и проведения учебных мероприятий, семинаров и тренировочных сборов, контроля посещаемости и результатов обучения;',
    'проверки и оценки знаний и навыков, приема экзаменов/зачетов и оформления документов о сдаче нормативов (физической и теоретической подготовки) в рамках требований КТСС;',
    'присвоения, подтверждения и учета судейской квалификационной категории (разряда), включая подготовку представлений и приказов;',
    'ведения реестра судей и статистики судейской деятельности, учета стажа и опыта, анализа работы для принятия кадровых и организационных решений;',
    'аккредитации и допуска к соревнованиям (включая проверку медицинских допусков и страховых полисов при необходимости);',
    'заключения, исполнения и прекращения гражданско‑правовых договоров (при наличии) и выплаты вознаграждения за судейство;',
    'информирования о мероприятиях, сборах, изменениях в регламентах и иной служебной информации, связанной с осуществлением мной функций судьи;',
    'исполнения Оператором своих уставных целей и требований законодательства Российской Федерации в сфере физической культуры и спорта.',
  ];
  goals.forEach((g) => {
    doc.text(` • ${g}`, { align: 'left' });
  });
  doc.moveDown();

  doc
    .font(fonts.bold)
    .text(
      'В рамках данного документа подтверждаю свое полное и безоговорочное согласие на обработку следующих видов данных:',
      { align: 'left' }
    );
  doc.moveDown();
  doc.font(fonts.regular);
  const dataItems = [
    'Идентификационные данные: фамилия, имя, отчество; дата и место рождения; гражданство;',
    'Паспортные данные: серия, номер, дата выдачи, наименование и код подразделения выдавшего органа; место рождения;',
    'Адреса и контакты: адрес регистрации; адрес фактического проживания (при необходимости); контактный телефон; адрес электронной почты;',
    'Дополнительные идентификаторы: страховой номер индивидуального лицевого счета (СНИЛС); индивидуальный номер налогоплательщика (ИНН);',
    'Образование и квалификация: сведения об образовании, о пройденных мною курсах, семинарах и тренировочных сборах; даты и результаты сдачи теоретических экзаменов;',
    'Судейская деятельность и опыт: спортивное звание/разряд (при наличии), квалификационная категория судьи; дата присвоения и номер приказа; перечень соревнований и стаж судейства; статистические показатели и оценки инспекторов (при наличии);',
    'Сведения, необходимые для допуска к судейской деятельности: результаты сдачи нормативов по физической подготовке; данные медицинских допусков и заключений врачей спортивной медицины; сведения о страховом полисе от несчастных случаев (если требуется);',
    'Фотография и видео: фотографические изображения и видеозаписи, сделанные в рамках соревнований или учебных мероприятий;',
    'Платежные реквизиты: банковские реквизиты для перечисления вознаграждения (при наличии гражданских договоров);',
    'Другие виды: иные персональные данные, сообщенные мною Оператору в связи с выполнением функций судьи, — в объёме, необходимом для достижения целей обработки.',
  ];
  dataItems.forEach((item) => {
    const [label, rest] = item.split(':');
    if (rest !== undefined) {
      doc.text(' • ', { continued: true });
      doc.font(fonts.bold).text(`${label}: `, { continued: true });
      doc.font(fonts.regular).text(` ${rest.trim()}`, { align: 'justify' });
    } else {
      doc.text(` • ${item}`, { align: 'justify' });
    }
  });
  doc.moveDown();
  doc.text(
    'Отдельно подтверждаю согласие на обработку специальных категорий персональных данных — сведений о состоянии здоровья, в объёме, необходимом для допуска к судейской деятельности (ст. 10 Закона № 152 ФЗ).',
    { align: 'justify' }
  );
  doc.moveDown();

  doc.text(
    'Я предоставляю Оператору право осуществлять с моими персональными данными следующие действия (операции): ' +
      'сбор, запись, систематизацию, накопление, хранение (в том числе включение в электронные базы данных и реестры Оператора), ' +
      'уточнение (обновление, изменение при необходимости), извлечение, использование, передачу (предоставление, распространение, доступ), ' +
      'обезличивание, блокирование, удаление, уничтожение моих персональных данных.',
    { align: 'justify' }
  );
  doc.moveDown(0.5);
  doc.text(
    'Оператор обеспечивает запись, систематизацию, накопление, хранение, уточнение (обновление, изменение) и извлечение персональных данных граждан Российской Федерации с использованием баз данных, находящихся на территории Российской Федерации (ч. 5 ст. 18 Закона № 152 ФЗ).',
    { align: 'justify' }
  );
  doc.moveDown(0.5);
  doc.text(
    'Обработка персональных данных может осуществляться как автоматизированным способом (в информационных системах, например, в базе данных Федерации хоккея Москвы), так и неавтоматизированным способом (на бумажных носителях). В рамках выполнения указанных действий мои данные могут быть внесены в информационно-аналитические системы хоккейных организаций (включая защищенную облачную систему Федерации хоккея России или Министерства спорта РФ, при необходимости передачи данных туда).',
    { align: 'justify' }
  );
  doc.moveDown(0.5);
  doc.text(
    'Оператор вправе поручить обработку моих персональных данных третьим лицам при соблюдении требований законодательства о персональных данных. В таких случаях заключается договор поручения обработки (ч. 3 ст. 6 Закона № 152 ФЗ), предусматривающий конфиденциальность и меры по безопасности персональных данных.',
    { align: 'justify' }
  );
  doc.moveDown();

  const transfers = [
    'компетентным организациям и органам в сфере спорта: в Федерацию хоккея России (ФХР) и ее структурные подразделения (например, Всероссийскую коллегию судей) — для учета меня в единой базе спортивных судей, подтверждения категории, допуска к всероссийским соревнованиям и др.; в Министерство спорта РФ или уполномоченные региональные органы — для оформления приказов о присвоении судейской категории, статистической отчетности и иных предусмотренных законом процедур;',
    'оргкомитетам и организаторам соревнований, спортивным клубам — в части, необходимой для моего допуска и аккредитации на конкретные соревнования (например, передача Ф.И.О. и категории судьи в заявку турнира, проверка в списках аккредитованных лиц);',
    'страховым компаниям — при наступлении страхового случая на соревнованиях (в пределах, необходимых для оформления страховых выплат по полису, если такой полис имеется у судьи);',
    'службам экстренной помощи и медицины — при чрезвычайной ситуации, когда необходимо сообщить мои данные (например, сведения о медицинском допуске).',
  ];
  doc
    .font(fonts.bold)
    .text(
      'Я даю свое согласие на передачу (предоставление) моих персональных данных третьим лицам в следующих случаях:',
      { align: 'justify' }
    );
  doc.moveDown(0.5);
  transfers.forEach((t) =>
    doc.font(fonts.regular).text(` • ${t}`, { align: 'left' })
  );
  doc.moveDown(0.5);
  doc.text(
    'Передачи осуществляются ограниченному кругу лиц в рамках исполнения моих функций судьи и требований законодательства. Иные передачи осуществляются только при наличии оснований, предусмотренных Законом № 152 ФЗ.',
    { align: 'justify' }
  );
  doc.moveDown();

  doc.font(fonts.bold).text('Согласие на распространение персональных данных', {
    align: 'center',
  });
  doc.moveDown();
  doc
    .font(fonts.regular)
    .text(
      'Настоящий раздел выражает мое отдельное волеизъявление на распространение персональных данных неопределенному кругу лиц. Я разрешаю распространение только следующего перечня сведений:',
      { align: 'justify' }
    );
  const publicity = [
    'фамилия, имя, отчество;',
    'судейская квалификационная категория (разряд) и спортивное звание (при наличии);',
    'город (регион) проживания;',
    'портретная фотография.',
  ];
  publicity.forEach((p) => doc.text(` • ${p}`, { align: 'justify' }));

  doc.moveDown(0.5);
  doc.text(
    'При этом я устанавливаю условия и запреты на обработку указанных персональных данных неограниченным кругом лиц:',
    { align: 'justify' }
  );
  const publicityLimits = [
    'разрешено размещение указанной информации только на официальном сайте Оператора и в его официальных аккаунтах в социальных сетях (например, ВКонтакте и Telegram), а также в печатных и электронных СМИ для освещения спортивных мероприятий;',
    'запрещается передача (кроме предоставления доступа) указанных персональных данных неограниченному кругу лиц для рекламных, маркетинговых и иных несвязанных с судейской деятельностью целей;',
    'запрещается иная обработка указанных персональных данных неограниченным кругом лиц, кроме получения доступа к ним на указанных ресурсах Оператора.',
  ];
  publicityLimits.forEach((l) => doc.text(` • ${l}`, { align: 'justify' }));

  doc.moveDown(0.5);
  doc.text(
    'Оператор обязан в срок не позднее трех рабочих дней с момента получения настоящего согласия опубликовать информацию об условиях обработки и о наличии запретов и условий на обработку неограниченным кругом лиц персональных данных, разрешенных мною для распространения.',
    { align: 'justify' }
  );
  doc.moveDown(0.5);
  doc.text(
    'Я вправе в любое время потребовать прекращения передачи (распространения, предоставления, доступа) ранее разрешенных к распространению персональных данных. Передача (распространение, предоставление, доступ) должна быть прекращена Оператором и любым иным лицом, обрабатывающим такие персональные данные, не позднее трех рабочих дней с момента получения моего требования. Требование должно содержать мои Ф.И.О., контактную информацию и перечень персональных данных, обработка которых подлежит прекращению. Настоящее согласие на распространение действует до его отдельного отзыва (см. п. 7 ниже).',
    { align: 'justify' }
  );

  doc.moveDown();
  try {
    const leftX = doc.page.margins.left;
    const y = doc.y;
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text('Подпись (согласие на распространение ПД):', leftX, y);
    const lineWidth = 180;
    const rightX = doc.page.width - doc.page.margins.right - lineWidth;
    const lineY = y + 12;
    doc
      .save()
      .moveTo(rightX, lineY)
      .lineTo(rightX + lineWidth, lineY)
      .lineWidth(1)
      .stroke('#666666')
      .restore();
    doc.fillColor('black').fontSize(11);
    doc.moveDown();
  } catch {
    /* noop */
  }

  doc
    .font(fonts.regular)
    .text(
      'Общее согласие действует до достижения целей обработки, указанных в п. 1, либо до его отзыва мной — что наступит раньше. Отдельное согласие на распространение действует до его отдельного отзыва.',
      { align: 'justify' }
    );
  doc.moveDown(0.5);
  doc.text(
    'Подписанное мной согласие хранится Оператором в течение 3 (трёх) лет после прекращения его действия или его отзыва — в соответствии с Перечнем типовых управленческих архивных документов (приказ Росархива от 20.12.2019 № 236, позиция 441).',
    { align: 'justify' }
  );
  doc.moveDown();

  const revoke = [
    'направить письменное заявление об отзыве собственноручно, на бумажном носителе, по адресу местонахождения Оператора: 101000, г. Москва, Кривоколенный пер., д. 9, стр. 1. Заявление может быть передано лично (под подпись уполномоченного представителя Оператора) или отправлено почтовым отправлением с уведомлением;',
    'направить заявление об отзыве в форме электронного документа, подписанного электронной подписью (например, через сервис «Контур.Сайн») либо с использованием информационной системы уполномоченного органа по защите прав субъектов персональных данных — в случаях, предусмотренных законом.',
  ];
  doc
    .font(fonts.regular)
    .text(
      'Мне известно, что я могу в любое время отозвать настоящее согласие, направив Оператору соответствующее заявление. Отзыв согласия не требует обоснования с моей стороны. Для отзыва согласия я могу воспользоваться одним из следующих способов:',
      { align: 'justify' }
    );
  revoke.forEach((r) => doc.text(` • ${r}`, { align: 'justify' }));
  doc.moveDown(0.5);
  doc.text(
    'Оператор прекращает обработку моих персональных данных не позднее чем в течение 30 дней с момента получения отзыва  (за исключением хранения обезличенных статистических данных или случаев, когда обработка без согласия допускается законом – например, если данные уже обобщены в обезличенном виде для статистики). Оператор также уведомит меня о прекращении обработки по моему запросу. Я ознакомлен(а) с тем, что отзыв согласия не имеет обратной силы и не затрагивает законность обработки, осуществленной до получения отзыва.',
    { align: 'justify' }
  );
  doc.moveDown();

  doc.text(
    'Мне разъяснены права, предусмотренные законом «О персональных данных», включая право требовать уточнения, блокирования или уничтожения моих персональных данных при их неполноте, устаревании или незаконной обработке, а также право на получение информации о своих персональных данных и факте их обработки (ст. 14 Закона № 152 ФЗ). В случае моего обращения Оператор предоставляет соответствующие сведения в течение 30 дней. Контакты Оператора для запросов: тел. +7 495 621 35 95, email: fhmoscow@mail.ru.',
    { align: 'justify' }
  );
  doc.moveDown();

  doc.text(
    'Своими действиями по подписанию настоящего документа (в том числе проставлением простой электронной подписи в сервисе «Контур.Сайн») я подтверждаю, что внимательно прочитал(а) и понял(а) содержание данного согласия и согласен(на) с его условиями. Настоящее согласие подписано мной свободно, своей волей и в своем интересе.',
    { align: 'justify' }
  );

  // Качественное поле подписи с ФИО и датой
  doc.moveDown(2);
  const todaySign = formatDateHuman(new Date());
  try {
    const leftX = doc.page.margins.left;
    const y = doc.y;
    doc.fontSize(11);
    doc.font(fonts.bold).text(fio(user) || '____________________', leftX, y);
    doc.font(fonts.bold).text(todaySign, leftX, y + 16);
    const lineWidth = 180;
    const rightX = doc.page.width - doc.page.margins.right - lineWidth;
    const lineY = y + 25;
    doc
      .save()
      .moveTo(rightX, lineY)
      .lineTo(rightX + lineWidth, lineY)
      .lineWidth(1)
      .stroke('#666666')
      .restore();
    doc
      .font(fonts.regular)
      .fontSize(8)
      .fillColor('#666666')
      .text('Подпись', rightX + lineWidth / 2 - 20, lineY + 4);
    doc.fillColor('black');
    doc.moveDown(3);
  } catch {
    const signLine2 =
      '__________________________          __________________________';
    const signLabels2 = 'Подпись                                Дата';
    doc.text(signLine2, { align: 'left' });
    doc.text(signLabels2, { align: 'left' });
  }

  // Footer: page numbers and code
  const range = doc.bufferedPageRange();
  const barcodeText = meta.docId || null;
  const numberText = meta.number || null;
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    // best-effort: render barcode if lib available, otherwise text

    await applyFooter(doc, {
      page: i + 1,
      total: range.count,
      barcodeText,
      numberText,
    });
  }

  doc.end();
  await done;
  return Buffer.concat(chunks);
}

/* istanbul ignore next */
async function buildElectronicInteractionAgreementPdf(user, meta = {}) {
  const chunks = [];
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 30, bottom: 80, left: 30, right: 30 },
    bufferPages: true,
    info: { Title: 'Соглашение об электронном взаимодействии' },
  });
  doc.on('data', (d) => chunks.push(d));
  const done = new Promise((resolve) => doc.on('end', () => resolve()));

  const fonts = applyFonts(doc);
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const clean = (v) =>
    v
      ? String(v)
          .replace(/[\r\n]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : v;
  const NBSP = '\u00A0';
  const protectTypography = (s) =>
    typeof s === 'string'
      ? s
          .replace(/\b([ВвКкСсУуОоИи])\s/g, `$1${NBSP}`)
          .replace(/\s№\s*/g, `${NBSP}№ `)
      : s;
  const seg = (text, bold = false) => ({
    text: protectTypography(text ?? ''),
    bold,
  });
  const tokenize = (text) =>
    (text || '').split(/(\s+)/).filter((t) => t.length > 0);
  const measure = (doc, fonts, token, bold) => {
    const prev = doc._font;
    try {
      doc.font(bold ? fonts.bold : fonts.regular);
    } catch {
      /* noop */
    }
    const w = doc.widthOfString(token);
    if (prev) {
      try {
        doc.font(prev.name || prev);
      } catch {
        /* noop */
      }
    }
    return w;
  };
  const layoutJustifiedStyledParagraph = (doc, fonts, segments, width) => {
    const startX = doc.page.margins.left;
    let y = doc.y;
    const lines = [];
    let line = [];
    let lineWidth = 0;
    const isStretchableSpace = (t) => t === ' ';
    const pushLine = () => {
      while (line.length && /^\s+$/.test(line[line.length - 1].text))
        line.pop();
      lines.push({ items: line, width: lineWidth });
      line = [];
      lineWidth = 0;
    };
    const styledTokens = [];
    segments.forEach((s) => {
      tokenize(s.text).forEach((t) =>
        styledTokens.push({ text: t, bold: s.bold })
      );
    });
    let i = 0;
    while (i < styledTokens.length) {
      const { text, bold } = styledTokens[i];
      const isWs = /^\s+$/.test(text);
      if (isWs && (!line.length || /^\s+$/.test(line[line.length - 1]?.text))) {
        i++;
        continue;
      }
      const tokenWidth = measure(doc, fonts, text, bold);
      const maxWidth = width;
      const remaining = maxWidth - lineWidth;
      if (tokenWidth <= remaining || (!line.length && tokenWidth <= maxWidth)) {
        line.push({ text, bold, width: tokenWidth });
        lineWidth += tokenWidth;
        i++;
      } else if (line.length) {
        pushLine();
      } else {
        let cut = 1;
        let part = text.slice(0, cut);
        let partWidth = measure(doc, fonts, part + '-', bold);
        while (cut < text.length && partWidth <= maxWidth) {
          cut++;
          part = text.slice(0, cut);
          partWidth = measure(doc, fonts, part + '-', bold);
        }
        cut = Math.max(1, cut - 1);
        part = text.slice(0, cut);
        partWidth = measure(doc, fonts, part + '-', bold);
        const rest = text.slice(cut);
        line.push({ text: part + '-', bold, width: partWidth });
        lineWidth += partWidth;
        pushLine();
        styledTokens[i] = { text: rest, bold };
      }
    }
    if (line.length) pushLine();
    const lineHeight = doc.currentLineHeight(true);
    lines.forEach((ln, idx) => {
      const last = idx === lines.length - 1;
      let x = startX;
      const totalWidth = ln.items.reduce((s, it) => s + it.width, 0);
      const extra = Math.max(0, width - totalWidth);
      const stretchPoints = !last
        ? ln.items.filter((it) => isStretchableSpace(it.text)).length
        : 0;
      const extraPerSpace = stretchPoints > 0 ? extra / stretchPoints : 0;
      ln.items.forEach((it) => {
        try {
          doc.font(it.bold ? fonts.bold : fonts.regular);
        } catch {
          /* noop */
        }
        doc.text(it.text, x, y, { lineBreak: false });
        x +=
          it.width + (isStretchableSpace(it.text) && !last ? extraPerSpace : 0);
      });
      y += lineHeight;
    });
    doc.x = startX;
    doc.y = y;
  };

  doc.font(fonts.regular);
  applyFirstPageHeader(doc);
  try {
    const HEADER_TOP = 30;
    const HEADER_HEIGHT = 32;
    const HEADER_PADDING = 12;
    const minY = HEADER_TOP + HEADER_HEIGHT + HEADER_PADDING;
    if (doc.y < minY) doc.y = minY;
  } catch {
    /* empty */
  }

  const heading =
    'Соглашение об электронном взаимодействии\nс использованием простой электронной подписи';
  try {
    doc.font(fonts.bold);
  } catch {
    /* empty */
  }
  doc.fontSize(14).text(heading, { align: 'center' });
  try {
    doc.moveDown(0.2);
    doc.fillColor('#666666');
    const savedFont = doc._font ? doc._font.name : null;
    try {
      doc.font('SB-Italic');
    } catch {
      /* empty */
    }
    doc.fontSize(10).text('для спортивного судьи Федерации хоккея Москвы', {
      align: 'center',
    });
    if (savedFont) doc.font(savedFont);
    doc.fillColor('black');
  } catch {
    /* empty */
  }
  try {
    doc.font(fonts.regular);
  } catch {
    /* empty */
  }

  // Location/date line (single row: city left, date right)
  const docDate = meta.documentDate
    ? formatDateHuman(meta.documentDate)
    : '«__» __________ ____ г.';
  doc.moveDown(0.8);
  doc.fontSize(11);
  {
    const y = doc.y;
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    doc.text('г. Москва', left, y, { lineBreak: false });
    const dateWidth = doc.widthOfString(docDate);
    const xDate = right - dateWidth;
    doc.text(docDate, xDate, y, { lineBreak: true });
  }
  doc.moveDown(0.6);

  // Fetch user details
  const [passports, userAddresses, innRec, snilsRec, userDetails] =
    await Promise.all([
      (
        Models.Passport?.findAll?.bind(Models.Passport) ||
        (() => Promise.resolve([]))
      )({
        where: { user_id: user.id },
        order: [['created_at', 'DESC']],
        attributes: [
          'series',
          'number',
          'issue_date',
          'issuing_authority',
          'issuing_authority_code',
          'place_of_birth',
        ],
      }),
      (
        Models.UserAddress?.findAll?.bind(Models.UserAddress) ||
        (() => Promise.resolve([]))
      )({
        where: { user_id: user.id },
        include: [
          { model: Models.Address, attributes: ['result', 'postal_code'] },
          { model: Models.AddressType, attributes: ['alias', 'name'] },
        ],
      }),
      (Models.Inn?.findOne?.bind(Models.Inn) || (() => Promise.resolve(null)))({
        where: { user_id: user.id },
        attributes: ['number'],
      }),
      (
        Models.Snils?.findOne?.bind(Models.Snils) ||
        (() => Promise.resolve(null))
      )({ where: { user_id: user.id }, attributes: ['number'] }),
      (
        Models.User?.findByPk?.bind(Models.User) ||
        (() => Promise.resolve(null))
      )(user.id, { attributes: ['email', 'phone'] }),
    ]);

  const passport = passports?.[0];
  const reg = (userAddresses || []).find(
    (ua) => ua.AddressType?.alias === 'REGISTRATION'
  );
  const regAdr = reg?.Address;

  const pSeries = passport?.series || '____';
  const pNumber = passport?.number || '_______';
  const pIssuer =
    clean(passport?.issuing_authority) || '____________________________';
  const pIssuerCode = clean(passport?.issuing_authority_code) || '_________';
  const pIssueDate = formatDateHuman(passport?.issue_date).replace(
    '____ г.',
    '____ г.'
  );
  const placeOfBirth =
    clean(passport?.place_of_birth) || '____________________';
  const regAddress =
    clean(regAdr?.result) || '_______________________________________________';
  const regPostal = regAdr?.postal_code ? `${regAdr.postal_code}, ` : '';
  const birthDate = formatDateHuman(user?.birth_date);
  const innNumber = innRec?.number || '______________';
  const snilsNumber = snilsRec?.number || '______________';

  const fioShort = (() => {
    const ln = (user?.last_name || '').trim();
    const fi = (user?.first_name || '').trim();
    const pi = (user?.patronymic || '').trim();
    const a = fi ? fi[0].toUpperCase() + '.' : '_.';
    const b = pi ? ' ' + pi[0].toUpperCase() + '.' : ' _.';
    const tail = ln || 'Фамилия';
    return `${a}${b} ${tail}`.replace(/\s+/g, ' ').trim();
  })();

  // Preamble with parties and user details (justified, styled)
  layoutJustifiedStyledParagraph(
    doc,
    fonts,
    [
      seg(
        'Региональная общественная организация «Федерация хоккея Москвы» (ФХМ), именуемая в дальнейшем «Федерация», в лице президента Николишина Андрея Васильевича, действующего на основании Устава, и '
      ),
      seg(fio(user) || '____________________', true),
      seg(' (фамилия, имя, отчество полностью), дата рождения '),
      seg(birthDate, true),
      seg(', место рождения '),
      seg(placeOfBirth, true),
      seg(', паспорт: серия '),
      seg(pSeries, true),
      seg(' № '),
      seg(pNumber, true),
      seg(', выдан '),
      seg(`${pIssuer} `, true),
      seg(pIssueDate, true),
      seg(', зарегистрирован(а) по адресу: '),
      seg(`${regPostal}${regAddress}`, true),
      seg(', ИНН '),
      seg(innNumber, true),
      seg(', СНИЛС '),
      seg(snilsNumber, true),
      seg(
        ' — физическое лицо, планирующее заключить с Федерацией договор об осуществлении судейской деятельности (именуемому далее «Судья»), заключили настоящее Соглашения в порядке статьи 428 Гражданского кодекса РФ на нижеследующих условиях.'
      ),
    ],
    contentWidth
  );

  doc.moveDown();

  // Section 1
  doc.font(fonts.bold).text('1. Термины и определения');
  doc.moveDown(0.3);
  doc.font(fonts.regular);
  doc.text(
    '1.1. Судья – физическое лицо (самозанятое лицо, применяющее специальный налоговый режим «Налог на профессиональный доход», либо индивидуальный предприниматель), планирующее заключить или заключившее договор с Федерацией на осуществление обязанностей спортивного судьи (арбитра) по хоккею.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '1.2. Личный кабинет Судьи – защищённый раздел информационной системы Федерации (включая веб-платформу lk.fhmoscow.com), доступный Судье после авторизации и предназначенный для получения и подписания документов, обмена информацией, получения назначений на спортивные мероприятия и подтверждения таких назначений. Доступ к Личному кабинету осуществляется по уникальным учетным данным (логину и паролю) Судьи; действия, совершённые в Личном кабинете после входа под учетными данными Судьи, признаются совершенными лично Судьёй.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '1.3. Электронный документ – документированная информация, представленная в электронной форме, пригодной для восприятия человеком с помощью компьютеров, передаваемая и хранимая в информационно-телекоммуникационных сетях. Электронный документ в рамках настоящего Соглашения может быть создан, подписан и передан сторонами с использованием информационной системы Федерации или иных согласованных средств электронного взаимодействия.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '1.4. Электронная подпись (ЭП) – информация в электронной форме, присоединенная к Электронному документу либо иным образом связанная с ним, и используемая для определения лица, подписавшего этот документ. Виды электронных подписей, используемые Сторонами, определяются законодательством Российской Федерации и настоящим Соглашением.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '1.5. Простая электронная подпись (ПЭП) – вид Электронной подписи, который посредством использования кодов, паролей или иных средств подтверждает факт формирования подписи определенным лицом. В рамках настоящего Соглашения в качестве ПЭП могут использоваться, в том числе:',
    { align: 'justify' }
  );
  doc.text(
    ' • электронная подпись, формируемая средствами Личного кабинета (например, ввод Судьёй одноразового проверочного кода, направленного на подтвержденный номер телефона или адрес электронной почты Судьи, после ввода логина и пароля);'
  );
  doc.text(
    ' • электронная подпись, формируемая во внешнем сервисе электронного документооборота (например, сервис «Контур.Сайн»), включая усиленную неквалифицированную электронную подпись, признаваемую сторонами эквивалентом простой электронной подписи;'
  );
  doc.text(
    ' • факсимильное воспроизведение собственноручной подписи Судьи (скан-образ или фото подписи на бумажном документе), переданное посредством информационной системы Федерации или электронной почты. Стороны признают такой способ подписания допустимым аналогом собственноручной подписи в соответствии с частью 2 статьи 160 ГК РФ.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '1.6. Ключ простой электронной подписи – уникальный набор данных, известный Судье и используемый для создания и проверки ПЭП. В качестве Ключа ПЭП в системе Федерации используются персонализированные учетные данные Судьи (логин и пароль для доступа в Личный кабинет) и/или иные средства аутентификации, предоставленные Федерацией (например, одноразовый код подтверждения).',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '1.7. Стороны – Федерация и Судья, совместно упоминаемые в тексте Соглашения.',
    { align: 'justify' }
  );

  doc.moveDown();

  // Section 2
  doc.font(fonts.bold).text('2. Порядок электронного взаимодействия');
  doc.moveDown(0.3);
  doc.font(fonts.regular);
  doc.text(
    '2.1. Общие условия. Стороны осуществляют юридически значимое взаимодействие в рамках договорных отношений посредством электронного документооборота, используя Личный кабинет Судьи и простую электронную подпись. Стороны признают, что действия, совершаемые Судьёй через Личный кабинет (получение и отправка сообщений, подписание документов, подтверждение назначений на матчи и иные события), относятся к осуществлению Судьёй судейской деятельности в рамках заключенного с Федерацией договора. Электронное взаимодействие по настоящему Соглашению охватывает все функции и действия Судьи, связанные с исполнением им обязанностей спортивного судьи по указанному договору.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '2.2. Документы и операции. Стороны договорились, что с использованием средств электронного взаимодействия (в том числе ПЭП) могут совершаться любые действия и оформляться любые документы, связанные с деятельностью Судьи, за исключением случаев, когда электронная форма документов не допускается законодательством РФ или требованиями Федерации. В частности, с применением ПЭП могут подписываться или направляться следующие документы и сведения:',
    { align: 'justify' }
  );
  doc.text(
    ' • договоры и соглашения между Судьёй и Федерацией (включая договоры возмездного оказания услуг судейства, дополнительные соглашения к ним, приложения, изменения к договорам);'
  );
  doc.text(
    ' • акты выполненных работ (оказанных услуг), отчёты и иные документы, подтверждающие исполнение Судьёй своих обязанностей по договору;'
  );
  doc.text(
    ' • приказы, распоряжения или уведомления о назначении Судьи на спортивные мероприятия (матчи), а также подтверждения со стороны Судьи о готовности выполнить такое назначение;'
  );
  doc.text(
    ' • односторонние заявления, уведомления, заявки, сообщения, ответы на обращения, справки и иная переписка между Сторонами, связанная с исполнением или прекращением договорных отношений;'
  );
  doc.text(
    ' • иные документы, касающиеся организации и учета судейской деятельности Судьи в рамках сотрудничества с Федерацией.'
  );
  doc.moveDown(0.3);
  doc.text(
    'Электронные документы, оформленные и подписанные Сторонами с применением ПЭП в порядке настоящего Соглашения, признаются Сторонами равнозначными документам на бумажном носителе, подписанным собственноручной подписью. Такие электронные документы порождают права и обязанности Сторон подобно бумажным оригиналам и могут представляться в суд, государственные органы или иным третьим лицам. Стороны согласовали, что электронный документ, подписанный надлежащим образом с использованием ПЭП, имеет юридическую силу письменного документа (простая письменная форма сделки считается соблюдённой в соответствии с требованиями Гражданского кодекса РФ и Федерального закона от 06.04.2011 № 63-ФЗ «Об электронной подписи»).',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '2.3. Размещение Федерацией электронного документа или сообщения для Судьи в его Личном кабинете приравнивается к направлению данного документа Судье. Такой документ (уведомление) считается полученным Судьёй в момент его размещения в Личном кабинете, что фиксируется средствами информационной системы Федерации. Судья обязуется регулярно (не реже 5 раз в неделю) проверять поступление новых сообщений и документов в Личном кабинете. При необходимости Федерация может дополнительно уведомлять Судью о поступлении новых документов посредством смс-сообщения, электронной почты либо иными доступными способами, однако неполучение такого дополнительного уведомления не освобождает Судью от обязанности своевременно ознакомиться с документами в Личном кабинете.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '2.4. Получив через Личный кабинет информацию о назначении на спортивное мероприятие (матч) в качестве судьи, Судья должен в установленный срок подтвердить своё согласие (готовность) выполнить данное назначение либо уведомить об отказе, используя функционал Личного кабинета (например, нажатием соответствующей кнопки подтверждения назначения). Отметка о подтверждении назначения, сделанная Судьёй в Личном кабинете, считается официальным подтверждением со стороны Судьи и имеет обязательную силу. В случае если Судья не осуществил подтверждение или отказ через Личный кабинет в предусмотренный срок, Федерация вправе считать такое назначение отклонённым.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '2.5. Подписание электронных документов в рамках настоящего Соглашения осуществляется с использованием ПЭП Судьи и ПЭП уполномоченного представителя Федерации. Судья осуществляет вход в Личный кабинет под своими учетными данными (логином и паролем) и формирует ПЭП путем применения предусмотренных технических средств — например, ввода одноразового кода, направленного системой Федерации на привязанный номер телефона или e-mail Судьи. В случае использования внешнего сервиса для подписания (например, системы Контур.Сайн) Стороны обеспечивают создание и проверку электронных подписей в соответствии с регламентом такого сервиса (при необходимости Судья проходит процедуру получения усиленной неквалифицированной ЭП через сервис Контур.Сайн, которая далее применяется для подписания документов без дублирования на бумаге). Допускается также подписание Судьёй документа на бумажном носителе с последующим сканированием и загрузкой электронного образа документа в систему – такой документ считается подписанным Судьёй в момент проставления собственноручной подписи, а его электронный образ используется для обмена между Сторонами.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '2.6. Использование Судьёй своих персональных средств для аутентификации (учетных данных Личного кабинета, кода подтверждения и др.) при подписании Электронного документа однозначно свидетельствует о том, что документ подписан именно данным Судьёй. Проверка принадлежности ПЭП Судье осуществляется путем сопоставления введенных Судьёй идентификаторов (логина, пароля, кодов) с данными, зарегистрированными в системе Федерации. Стороны признают юридически значимым любое действие, совершенное под учетной записью Судьи после успешной аутентификации, и подтверждают, что такое действие совершено уполномоченным лицом – самим Судьёй.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '2.7. Электронные документы, подписанные ЭП, хранятся Федерацией в электронном архиве. Стороны договорились, что сведения об электронных документах и операциях, зафиксированные техническими средствами информационной системы Федерации (включая сами электронные документы, отметки о времени отправки и получения, системные логи), могут быть использованы как надлежащие письменные доказательства при рассмотрении споров между Сторонами, в том числе в суде, а также предоставлены по запросу компетентных государственных органов.',
    { align: 'justify' }
  );

  doc.moveDown();

  // Section 3
  doc.font(fonts.bold).text('3. Права и обязанности Сторон');
  doc.moveDown(0.3);
  doc.font(fonts.regular);
  doc.text(
    '3.1. Федерация обязуется обеспечить функционирование информационной системы и Личного кабинета Судьи, необходимого для электронного взаимодействия по настоящему Соглашению. Федерация принимает меры для поддержки работоспособности программно-аппаратных средств, защиты информации и электронных документов от несанкционированного доступа или изменений, а также для подтверждения подлинности и авторства электронных документов. Федерация обеспечивает, чтобы используемое программное обеспечение и оборудование соответствовало требованиям законодательства РФ в сфере защиты информации и персональных данных. В случае технических сбоев или недоступности Личного кабинета, Федерация должна в разумные сроки восстановить его работоспособность и при необходимости предоставить альтернативный способ обмена документами (например, посредством электронной почты или на бумажном носителе).',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '3.2. Федерация вправе запрашивать у Судьи необходимые сведения для подключения к системе электронного документооборота (например, актуальный номер мобильного телефона, адрес электронной почты и иные данные). При подозрении на нарушение безопасности электронной подписи или несанкционированное использование Личного кабинета Федерация вправе приостановить доступ Судьи к электронному взаимодействию (в частности, временно отключить возможность использования ПЭП) до выяснения обстоятельств. О таком приостановлении Федерация незамедлительно уведомляет Судью и предоставляет инструкции для восстановления доступа. Федерация также вправе отказаться принимать или исполнять документы, подписанные ПЭП Судьи, с даты прекращения действия настоящего Соглашения либо в случае выявления фактов утраты Судьёй доверия к безопасности своей ЭП (например, компрометации ключа ПЭП).',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '3.3. Судья обязуется использовать Личный кабинет и электронную подпись исключительно для целей, связанных с выполнением своих обязанностей по договору с Федерацией (судейство спортивных мероприятий). Судья несет ответственность за сохранность и конфиденциальность своих учетных данных (логина, пароля), ключей ПЭП, кодов подтверждения и иных средств, используемых для аутентификации и подписания документов. Судья не должен передавать указанные средства третьим лицам и обязан принимать меры по предотвращению несанкционированного доступа к своему Личному кабинету. В случае утраты или подозрения на компрометацию своих средств электронной подписи (утечка пароля, доступ посторонних к телефону или электронной почте и т.п.) Судья обязан немедленно уведомить об этом Федерацию и незамедлительно изменить соответствующие реквизиты (пароль) или воспользоваться иными предоставленными средствами защиты. До момента получения Федерацией уведомления от Судьи о компрометации средств ЭП все действия, совершенные с использованием учетных данных и ЭП Судьи, считаются совершенными Судьёй лично и породившими юридически значимые последствия для Судьи.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '3.4. Судья вправе требовать от Федерации надлежащего обеспечения процессов электронного документооборота, в том числе своевременного размещения документов в Личном кабинете, корректности направляемых документов, предоставления консультаций по вопросам использования Личного кабинета и ПЭП. Судья имеет право в любой момент запросить у Федерации предоставление ему копий документов на бумажном носителе, если это не препятствует своевременному исполнению обязательств (например, получить дубликат ранее подписанного электронного документа для личного архива). Также Судья вправе инициировать прекращение электронного взаимодействия в порядке, установленном разделом 5 настоящего Соглашения (отказаться от дальнейшего использования ПЭП), при условии надлежащего исполнения всех принятых на себя обязательств, возникших в период действия Соглашения.',
    { align: 'justify' }
  );

  doc.moveDown();

  // Section 4
  doc.font(fonts.bold).text('4. Конфиденциальность и защита информации');
  doc.moveDown(0.3);
  doc.font(fonts.regular);
  doc.text(
    '4.1. Стороны обязуются соблюдать требования законодательства Российской Федерации в области защиты информации и персональных данных, включая Федеральный закон от 27.07.2006 № 152-ФЗ «О персональных данных» и Федеральный закон от 27.07.2006 № 149-ФЗ «Об информации, информационных технологиях и о защите информации». Каждая из Сторон гарантирует соблюдение конфиденциальности персональных данных и иной охраняемой информации, полученной в ходе исполнения настоящего Соглашения. Обработка персональных данных Судьи, переданных Федерации для целей исполнения договора и настоящего Соглашения, осуществляется в соответствии с Политикой Федерации в отношении обработки персональных данных и исключительно в объеме, необходимом для реализации электронного взаимодействия.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '4.2. Судья дает согласие на использование и обработку своих персональных данных в информационной системе Федерации в целях обеспечения функционирования Личного кабинета, направления ему документов и уведомлений, а также подтверждает, что ознакомлен с правами субъекта персональных данных по ст. 14 Федерального закона № 152-ФЗ. Судья обязуется не раскрывать третьим лицам информацию, доступную ему через Личный кабинет (включая содержимое договоров, актов, назначений, персональные данные других участников процесса и т.п.), за исключением случаев, прямо предусмотренных законодательством или необходимых для исполнения обязанностей (например, предоставление отчётных документов по требованию налоговых органов).',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '4.3. Стороны принимают на себя обязательства по обеспечению конфиденциальности средств электронной подписи. В частности, Судья и Федерация обязаны сохранять в тайне и не раскрывать третьим лицам код(ы) подтверждения, пароли и иные секретные элементы, используемые для формирования и проверки ПЭП. Передача таких средств другим лицам либо использование их ненадлежащим образом запрещается. Стороны признают, что соблюдение указанных мер является необходимым условием безопасности электронного взаимодействия; нарушение этих требований рассматривается как существенное нарушение условий Соглашения.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '4.4. Федерация, являясь оператором информационной системы, обеспечивает реализацию необходимых правовых, организационных и технических мер защиты информации. В частности, Федерация защищает персональные данные Судьи от несанкционированного или случайного доступа, уничтожения, изменения, блокирования, копирования, распространения, а также от иных неправомерных действий. Доступ Судьи к Личному кабинету осуществляется через зашифрованное соединение; хранимые электронные документы снабжаются средствами криптографической защиты и квалифицированными отметками времени при необходимости. Федерация незамедлительно уведомляет Судью о случаях нарушения защиты его персональных данных или несанкционированного доступа к его Электронным документам, если таковые будут обнаружены, и принимает меры по устранению последствий нарушений.',
    { align: 'justify' }
  );

  doc.moveDown();

  // Section 5
  doc.font(fonts.bold).text('5. Срок действия и прекращение Соглашения');
  doc.moveDown(0.3);
  doc.font(fonts.regular);
  doc.text(
    '5.1. Настоящее Соглашение вступает в силу с момента его акцепта Судьёй (присоединения к Соглашению на условиях, изложенных в преамбуле) и действует в течение неопределенного срока (бессрочно). Прекращение (расторжение) договора между Судьёй и Федерацией о судейском обслуживании спортивных мероприятий автоматически влечёт прекращение настоящего Соглашения, за исключением тех обязательств, которые прямо продолжат своё действие в силу закона или условий настоящего Соглашения.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '5.2. Судья имеет право в любое время в одностороннем порядке отказаться от дальнейшего исполнения настоящего Соглашения, предварительно письменно уведомив об этом Федерацию не позднее чем за 30 (тридцать) календарных дней до предполагаемой даты прекращения. Уведомление об отказе от Соглашения подается в письменной форме на имя уполномоченного лица Федерации (с последующим направлением скан-копии через Личный кабинет или электронной почтой, либо путем вручения нарочным под расписку). По соглашению Сторон или при наличии уважительных причин возможно прекращение Соглашения по инициативе Судьи и в более короткий срок.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '5.3. Федерация имеет право отказаться от исполнения настоящего Соглашения в одностороннем порядке, уведомив об этом Судью не позднее чем за 30 (тридцать) дней до даты прекращения. Уведомление может быть направлено Судье в его Личном кабинете и продублировано иными доступными способами (почтовым отправлением, электронной почтой). Также Федерация вправе в одностороннем порядке прекратить действие Соглашения в отношении конкретного Судьи в случае нарушения последним условий раздела 4 (конфиденциальность и защита информации) либо существенного нарушения иных условий настоящего Соглашения.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '5.4. В случае отказа любой из Сторон от Соглашения в порядке, предусмотренном выше, действие Соглашения прекращается по истечении указанного уведомительного срока, если Стороны не согласовали иную дату. С момента прекращения действия Соглашения (полного расторжения его условий) электронное взаимодействие между Сторонами прекращается: Федерация более не принимает от Судьи документы, подписанные его ПЭП, и не размещает для него документов в электронной форме, а Судья утрачивает доступ к Личному кабинету (за исключением возможности просмотра или скачивания ранее подписанных документов, при условии технической возможности).',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '5.5. Прекращение (расторжение) настоящего Соглашения не освобождает Стороны от исполнения обязательств, возникших в период его действия, и не влечет отмены или недействительности электронных документов, подписанных в период действия Соглашения. Все права и обязанности Сторон по уже подписанным к моменту прекращения документам сохраняют силу и подлежат исполнению. В частности, отказ Судьи от настоящего Соглашения не освобождает его от необходимости надлежащим образом выполнить принятые ранее обязательства (например, пройти процедуры подписания уже предоставленного ему акта об оказании услуг, исполнить подтверждённое ранее назначение на матч и т.д.), если Стороны письменно не договорятся об ином порядке.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '5.6. Возобновление электронного взаимодействия после прекращения Соглашения допускается только путем заключения нового соглашения о ПЭП между Судьёй и Федерацией (либо подписания настоящего Соглашения в новой редакции).',
    { align: 'justify' }
  );

  doc.moveDown();

  // Section 6
  doc.font(fonts.bold).text('6. Заключительные положения');
  doc.moveDown(0.3);
  doc.font(fonts.regular);
  doc.text(
    '6.1. Настоящее Соглашение при акцепте Судьёй порождает те же правовые последствия, что и двустороннее письменное подписание на бумажном носителе. Стороны признают допустимость использования аналога собственноручной подписи и электронных подписей в соответствии с действующим законодательством РФ.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '6.2. Все споры и разногласия, связанные с исполнением настоящего Соглашения, разрешаются путем переговоров между Сторонами. При недостижении соглашения спор подлежит рассмотрению в судебном порядке по подсудности, установленной законодательством Российской Федерации. Заявления, претензии и иная официальная переписка между Сторонами в рамках исполнения Соглашения могут направляться в электронной форме (через Личный кабинет или на официальные электронные адреса Сторон) и будут признаваться действительными.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '6.3. В случае изменения законодательства или нормативных актов, затрагивающих отношения по настоящему Соглашению, Стороны будут руководствоваться действующим законодательством. Если какое-либо из положений Соглашения станет недействительным или невозможным к исполнению в силу изменений законодательства, это не затрагивает действительность остальных положений; Стороны при необходимости оформят соответствующее письменное изменение к Соглашению.',
    { align: 'justify' }
  );
  doc.moveDown(0.3);
  doc.text(
    '6.4. Настоящее Соглашение и отношения Сторон, не урегулированные им, подчиняются законодательству Российской Федерации. Стороны признают юридическую силу настоящего Соглашения в электронной форме. Оригинал текста Соглашения хранится в информационной системе Федерации. Судья в любой момент может скачать или запросить у Федерации экземпляр Соглашения на бумажном носителе, подписанный уполномоченным представителем Федерации.',
    { align: 'justify' }
  );

  // Requisites and signatures block (two columns)
  doc.moveDown(1);
  const colGap = 24;
  const colWidth = (contentWidth - colGap) / 2;
  const leftX = doc.page.margins.left;
  const rightX = leftX + colWidth + colGap;
  const startY = doc.y;

  const drawRequisites = (x, title, groups) => {
    const savedX = doc.x;
    const savedY = doc.y;
    try {
      doc.font(fonts.bold);
    } catch {
      /* empty */
    }
    doc.text(title, x, savedY, { width: colWidth, align: 'left' });
    try {
      doc.font(fonts.regular);
    } catch {
      /* empty */
    }
    // inline segments renderer with soft-wrapping within column width
    const drawSegments = (sx, sy, width, segments) => {
      const tokenize = (text) =>
        (text || '').split(/(\s+)/).filter((t) => t.length > 0);
      const measure = (token, bold) => {
        const prev = doc._font;
        try {
          doc.font(bold ? fonts.bold : fonts.regular);
        } catch {
          /* empty */
        }
        const w = doc.widthOfString(token);
        if (prev) {
          try {
            doc.font(prev.name || prev);
          } catch {
            /* empty */
          }
        }
        return w;
      };
      const lineHeight = doc.currentLineHeight(true);
      let x = sx;
      let y = sy;
      const tokens = [];
      (segments || []).forEach((seg) => {
        if (!seg || typeof seg.text !== 'string') return;
        tokenize(seg.text).forEach((t) =>
          tokens.push({ text: t, bold: !!seg.bold })
        );
      });
      let i = 0;
      while (i < tokens.length) {
        const { text, bold } = tokens[i];
        const isSpace = /^\s+$/.test(text);
        // collapse multiple spaces at line start
        if (isSpace && x === sx) {
          i++;
          continue;
        }
        const tw = measure(text, bold);
        const remaining = width - (x - sx);
        if (tw <= remaining || x === sx) {
          try {
            doc.font(bold ? fonts.bold : fonts.regular);
          } catch {
            /* empty */
          }
          doc.text(text, x, y, { lineBreak: false });
          x += tw;
          i++;
        } else {
          // need wrap; if a single long word and at line start, split with hyphen
          if (!isSpace && x === sx && text.length > 1) {
            let cut = 1;
            let part = text.slice(0, cut);
            let pw = measure(part + '-', bold);
            while (cut < text.length && pw <= width) {
              cut++;
              part = text.slice(0, cut);
              pw = measure(part + '-', bold);
            }
            cut = Math.max(1, cut - 1);
            part = text.slice(0, cut);
            pw = measure(part + '-', bold);
            const rest = text.slice(cut);
            try {
              doc.font(bold ? fonts.bold : fonts.regular);
            } catch {
              /* empty */
            }
            doc.text(part + '-', x, y, { lineBreak: false });
            // move to next line and continue with remainder
            x = sx;
            y += lineHeight;
            tokens[i] = { text: rest, bold };
          } else {
            // wrap to next line
            x = sx;
            y += lineHeight;
          }
        }
      }
      // finalize cursor
      doc.x = sx;
      doc.y = y + lineHeight;
    };
    // helpers to build label:value segments with bold value
    const mk = (label, value) => [
      { text: `${label}: ` },
      { text: String(value ?? ''), bold: true },
    ];

    (groups || []).forEach((group, idx) => {
      if (!group) return;
      // render each logical line in the group on a new line
      // group can be array of segments or array-of-arrays-of-segments
      const lines = Array.isArray(group[0]) ? group : [group];
      lines.forEach((line) => {
        const segs = Array.isArray(line) ? line : mk('', line);
        drawSegments(x, doc.y, colWidth, segs);
      });
      if (idx < groups.length - 1) doc.moveDown(0.4);
    });
    const endY = doc.y;
    doc.x = savedX;
    doc.y = endY;
    return endY;
  };

  // helpers for formatted line combos
  const maskRuPhone = (digits) => {
    if (!digits) return '';
    const d = String(digits).replace(/\D/g, '');
    if (!d) return '';
    let out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ') ';
    if (d.length >= 4) out += d.slice(4, 7);
    if (d.length >= 7) out += '-' + d.slice(7, 9);
    if (d.length >= 9) out += '-' + d.slice(9, 11);
    return out;
  };
  const userPhoneMasked = userDetails?.phone
    ? maskRuPhone(userDetails.phone)
    : '____________________';
  const leftItems = [
    // 1. Name
    [[{ text: 'РОО «Федерация хоккея Москвы»', bold: true }]],
    // 2. Email
    [[{ text: 'E-mail: ' }, { text: 'fhmoscow@mail.ru', bold: true }]],
    // 3. Phone
    [[{ text: 'Тел.: ' }, { text: '+7 (495) 621-35-95', bold: true }]],
    // 4. OGRN
    [[{ text: 'ОГРН: ' }, { text: '1037739762610', bold: true }]],
    // 5. INN
    [[{ text: 'ИНН: ' }, { text: '7708046206', bold: true }]],
    // 6. Address
    [
      [
        { text: 'Адрес: ' },
        {
          text: '101000, г. Москва, Кривоколенный пер., д. 9, стр. 1',
          bold: true,
        },
      ],
    ],
  ];
  const rightItems = [
    // 1. FIO
    [
      [
        { text: 'ФИО: ' },
        { text: fio(user) || '____________________', bold: true },
      ],
    ],
    // 2. Email
    [
      [
        { text: 'E-mail: ' },
        {
          text: userDetails?.email
            ? clean(userDetails.email)
            : '____________________',
          bold: true,
        },
      ],
    ],
    // 3. Phone
    [[{ text: 'Тел.: ' }, { text: userPhoneMasked, bold: true }]],
    // 4. Passport
    [
      [
        { text: 'Паспорт: ' },
        { text: 'серия ', bold: false },
        { text: pSeries, bold: true },
        { text: ' № ', bold: false },
        { text: pNumber, bold: true },
      ],
      [
        { text: 'Выдан: ' },
        { text: pIssuer, bold: true },
        { text: ', ', bold: false },
        { text: pIssueDate, bold: true },
        { text: ', код ', bold: false },
        { text: pIssuerCode, bold: true },
      ],
    ],
    // 5. Address
    [
      [
        { text: 'Адрес регистрации: ' },
        { text: `${regPostal}${regAddress}`, bold: true },
      ],
    ],
    // 6. INN
    [[{ text: 'ИНН: ' }, { text: innNumber, bold: true }]],
    // 7. SNILS
    [[{ text: 'СНИЛС: ' }, { text: snilsNumber, bold: true }]],
  ];

  // Draw columns and capture heights
  doc.y = startY;
  const leftEndY = drawRequisites(leftX, 'Реквизиты Федерации', leftItems);
  doc.y = startY;
  const rightEndY = drawRequisites(rightX, 'Данные Судьи', rightItems);
  const afterColsY = Math.max(leftEndY, rightEndY);
  doc.y = afterColsY + 12;

  // Signature lines (two columns)
  const sigLineAt = (x, y, role, nameHint) => {
    const baseY = y;
    // Optional role (kept empty by caller now)
    if (role) {
      try {
        doc.font(fonts.bold);
      } catch {
        /* empty */
      }
      doc.text(role, x, baseY, { width: colWidth, align: 'left' });
    }
    try {
      doc.font(fonts.regular);
    } catch {
      /* empty */
    }
    // Align the signature baseline with the name hint baseline
    const textH = doc.currentLineHeight(true);
    const lineY = baseY + textH - 2; // a tad below to look visually centered
    const lineWidth = colWidth * 0.6;
    try {
      doc
        .save()
        .lineWidth(0.7)
        .moveTo(x, lineY)
        .lineTo(x + lineWidth, lineY)
        .stroke()
        .restore();
    } catch {
      /* empty */
    }
    const hint = nameHint || '';
    const hx = x + lineWidth + 8;
    // place hint so its baseline visually sits on the line
    const hintTop = lineY - textH + 2;
    doc.text(hint, hx, hintTop, { lineBreak: false });
    // bottom of block
    return Math.max(lineY + 8, hintTop + textH + 4);
  };

  const sigY = doc.y;
  const leftSigBottom = sigLineAt(leftX, sigY, '', 'А. В. Николишин');
  const rightSigBottom = sigLineAt(rightX, sigY, '', fioShort);
  doc.y = Math.max(leftSigBottom, rightSigBottom);

  // Footer across pages
  const range = doc.bufferedPageRange();
  const barcodeText = meta.docId || null;
  const numberText = meta.number || null;
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    await applyFooter(doc, {
      page: i + 1,
      total: range.count,
      barcodeText,
      numberText,
    });
  }

  doc.end();
  await done;
  return Buffer.concat(chunks);
}

async function create(data, userId) {
  let statusId = data.statusId;
  if (!statusId) {
    const status = await DocumentStatus.findOne({
      where: { alias: 'CREATED' },
      attributes: ['id'],
    });
    if (!status) {
      throw new ServiceError('document_status_not_found', 500);
    }
    statusId = status.id;
  }
  let fileId = data.fileId;
  if (!fileId && data.file) {
    const file = await fileService.uploadDocument(data.file, userId);
    fileId = file.id;
  }
  if (!fileId) {
    throw new ServiceError('file_required', 400);
  }

  const doc = await Document.create({
    recipient_id: data.recipientId,
    document_type_id: data.documentTypeId,
    status_id: statusId,
    file_id: fileId,
    sign_type_id: data.signTypeId,
    name: data.name,
    description: data.description,
    document_date: data.documentDate || new Date(),
    created_by: userId,
    updated_by: userId,
  });
  const recipient = await User.findByPk(data.recipientId, {
    attributes: ['email', 'last_name', 'first_name', 'patronymic'],
  });
  if (recipient?.email) {
    await emailService.sendDocumentCreatedEmail(recipient, doc);
  }
  return doc;
}

async function listByUser(userId) {
  const docs = await Document.findAll({
    where: { recipient_id: userId },
    include: [
      { model: DocumentType, attributes: ['name', 'alias', 'generated'] },
      { model: SignType, attributes: ['name', 'alias'] },
      { model: File, attributes: ['id', 'key'] },
      { model: DocumentStatus, attributes: ['name', 'alias'] },
      {
        model: DocumentUserSign,
        attributes: ['id', 'user_id', 'created_at'],
        required: false,
      },
    ],
    order: [['created_at', 'DESC']],
  });
  return Promise.all(
    docs.map(async (d) => ({
      id: d.id,
      number: d.number,
      name: d.name,
      description: d.description,
      documentDate: d.document_date,
      documentType: d.DocumentType
        ? {
            name: d.DocumentType.name,
            alias: d.DocumentType.alias,
            generated: d.DocumentType.generated,
          }
        : null,
      signType: d.SignType
        ? { name: d.SignType.name, alias: d.SignType.alias }
        : null,
      status: d.DocumentStatus
        ? { name: d.DocumentStatus.name, alias: d.DocumentStatus.alias }
        : null,
      file: d.File
        ? {
            id: d.File.id,
            url: await fileService.getDownloadUrl(d.File),
          }
        : null,
      signs: d.DocumentUserSigns.map((s) => ({
        id: s.id,
        userId: s.user_id,
        createdAt: s.created_at,
      })),
    }))
  );
}

async function listAll() {
  const docs = await Document.findAll({
    include: [
      { model: DocumentType, attributes: ['name', 'alias', 'generated'] },
      { model: SignType, attributes: ['name', 'alias'] },
      {
        model: User,
        as: 'recipient',
        attributes: ['last_name', 'first_name', 'patronymic'],
      },
      { model: DocumentStatus, attributes: ['name', 'alias'] },
      { model: File, attributes: ['id', 'key'] },
    ],
    order: [['created_at', 'DESC']],
  });
  return Promise.all(
    docs.map(async (d) => {
      const fio = `${d.recipient.last_name} ${d.recipient.first_name}${
        d.recipient.patronymic ? ` ${d.recipient.patronymic}` : ''
      }`.trim();
      let baseName =
        `${d.DocumentType ? d.DocumentType.name : 'Документ'} · ${fio}`.trim();
      baseName = baseName.replace(/[\\/:*?"<>|]/g, ' ');
      /* istanbul ignore next */ const ext = d.File
        ? path.extname(d.File.key)
        : '';
      const downloadName = `${baseName}${ext || ''}`;
      /* istanbul ignore next */ const filePayload = d.File
        ? {
            id: d.File.id,
            url: await fileService.getDownloadUrl(d.File, {
              filename: downloadName,
            }),
          }
        : null;
      return {
        id: d.id,
        number: d.number,
        name: d.name,
        documentDate: d.document_date,
        documentType: d.DocumentType
          ? {
              id: d.document_type_id,
              name: d.DocumentType.name,
              alias: d.DocumentType.alias,
              generated: d.DocumentType.generated,
            }
          : null,
        signType: d.SignType
          ? {
              id: d.sign_type_id,
              name: d.SignType.name,
              alias: d.SignType.alias,
            }
          : null,
        recipient: {
          lastName: d.recipient.last_name,
          firstName: d.recipient.first_name,
          patronymic: d.recipient.patronymic,
        },
        status: d.DocumentStatus
          ? { name: d.DocumentStatus.name, alias: d.DocumentStatus.alias }
          : null,
        file: filePayload,
        createdAt: d.created_at,
      };
    })
  );
}

async function sign(user, documentId) {
  const doc = await Document.findByPk(documentId);
  if (!doc) {
    throw new ServiceError('document_not_found', 404);
  }
  const count = await DocumentUserSign.count({
    where: { document_id: documentId, deleted_at: { [Op.is]: null } },
  });
  if (count >= 2) {
    throw new ServiceError('document_sign_limit', 400);
  }
  const existing = await DocumentUserSign.findOne({
    where: { document_id: documentId, user_id: user.id },
  });
  if (existing) {
    throw new ServiceError('document_already_signed', 400);
  }
  const userSign = await UserSignType.findOne({ where: { user_id: user.id } });
  if (!userSign || userSign.sign_type_id !== doc.sign_type_id) {
    throw new ServiceError('sign_type_mismatch', 400);
  }
  await DocumentUserSign.create({
    document_id: documentId,
    user_id: user.id,
    sign_type_id: userSign.sign_type_id,
    created_by: user.id,
    updated_by: user.id,
  });
  const signedStatus = await DocumentStatus.findOne({
    where: { alias: 'SIGNED' },
    attributes: ['id'],
  });
  if (signedStatus) {
    await doc.update({ status_id: signedStatus.id, updated_by: user.id });
    const recipient = await User.findByPk(doc.recipient_id, {
      attributes: ['email', 'last_name', 'first_name', 'patronymic'],
    });
    if (recipient?.email) {
      await emailService.sendDocumentSignedEmail(recipient, doc);
    }
  }

  const docType = await DocumentType.findByPk(doc.document_type_id, {
    attributes: ['alias'],
  });
  if (docType?.alias === 'ELECTRONIC_INTERACTION_AGREEMENT') {
    const signType = await SignType.findOne({
      where: { alias: 'SIMPLE_ELECTRONIC' },
      attributes: ['id'],
    });
    if (signType) {
      await UserSignType.destroy({ where: { user_id: user.id } });
      await UserSignType.create({
        user_id: user.id,
        sign_type_id: signType.id,
        sign_created_date: new Date(),
        created_by: user.id,
        updated_by: user.id,
      });
    }
  }
}

async function requestSignature(documentId, actorId) {
  const doc = await Document.findByPk(documentId, {
    include: [
      { model: SignType, attributes: ['alias', 'name'] },
      {
        model: User,
        as: 'recipient',
        attributes: ['email', 'last_name', 'first_name', 'patronymic'],
      },
      { model: DocumentStatus, attributes: ['alias'] },
    ],
  });
  if (!doc) {
    throw new ServiceError('document_not_found', 404);
  }
  if (
    !doc.SignType ||
    !['HANDWRITTEN', 'KONTUR_SIGN'].includes(doc.SignType.alias)
  ) {
    throw new ServiceError('document_sign_type_invalid', 400);
  }
  if (doc.DocumentStatus?.alias !== 'CREATED') {
    throw new ServiceError('document_status_invalid', 400);
  }
  const status = await DocumentStatus.findOne({
    where: { alias: 'AWAITING_SIGNATURE' },
    attributes: ['id', 'name', 'alias'],
  });
  if (!status) {
    throw new ServiceError('document_status_not_found', 500);
  }
  await doc.update({ status_id: status.id, updated_by: actorId });
  if (doc.recipient?.email) {
    await emailService.sendDocumentAwaitingSignatureEmail(doc.recipient, doc);
  }
  return { name: status.name, alias: status.alias };
}

async function uploadSignedFile(documentId, file, actorId) {
  if (!file) {
    throw new ServiceError('file_required', 400);
  }
  const doc = await Document.findByPk(documentId, {
    include: [
      { model: SignType, attributes: ['alias'] },
      { model: DocumentStatus, attributes: ['alias'] },
    ],
  });
  if (!doc) {
    throw new ServiceError('document_not_found', 404);
  }
  if (
    !doc.SignType ||
    !['HANDWRITTEN', 'KONTUR_SIGN'].includes(doc.SignType.alias)
  ) {
    throw new ServiceError('document_sign_type_invalid', 400);
  }
  if (doc.DocumentStatus?.alias !== 'AWAITING_SIGNATURE') {
    throw new ServiceError('document_status_invalid', 400);
  }
  const signedStatus = await DocumentStatus.findOne({
    where: { alias: 'SIGNED' },
    attributes: ['id', 'name', 'alias'],
  });
  if (!signedStatus) {
    throw new ServiceError('document_status_not_found', 500);
  }
  const oldFileId = doc.file_id;
  const newFile = await fileService.uploadDocument(file, actorId);
  await doc.update({
    file_id: newFile.id,
    status_id: signedStatus.id,
    updated_by: actorId,
  });
  if (oldFileId) {
    await fileService.removeFile(oldFileId);
  }
  const recipient = await User.findByPk(doc.recipient_id, {
    attributes: ['email', 'last_name', 'first_name', 'patronymic'],
  });
  if (recipient?.email) {
    await emailService.sendDocumentSignedEmail(recipient, doc);
  }
  const fioSigned = `${recipient.last_name} ${recipient.first_name}${
    recipient.patronymic ? ` ${recipient.patronymic}` : ''
  }`.trim();
  // Preserve original extension
  const extSigned = path.extname(newFile.key || '');
  let baseNameSigned = `${doc.name || 'Документ'} · ${fioSigned}`.trim();
  baseNameSigned = baseNameSigned.replace(/[\\/:*?"<>|]/g, ' ');
  const url = await fileService.getDownloadUrl(newFile, {
    filename: `${baseNameSigned}${extSigned || ''}`,
  });
  return {
    status: { name: signedStatus.name, alias: signedStatus.alias },
    file: { id: newFile.id, url },
  };
}

async function regenerate(documentId, actorId) {
  const doc = await Document.findByPk(documentId, {
    include: [
      { model: DocumentType, attributes: ['name', 'generated', 'alias'] },
      { model: DocumentStatus, attributes: ['alias'] },
      {
        model: User,
        as: 'recipient',
        attributes: [
          'id',
          'last_name',
          'first_name',
          'patronymic',
          'birth_date',
        ],
      },
    ],
  });
  if (!doc) {
    throw new ServiceError('document_not_found', 404);
  }
  if (!doc.DocumentType?.generated) {
    throw new ServiceError('document_type_not_generated', 400);
  }
  if (!['CREATED', 'AWAITING_SIGNATURE'].includes(doc.DocumentStatus?.alias)) {
    throw new ServiceError('document_status_invalid', 400);
  }
  let pdf;
  if (doc.DocumentType.alias === 'PERSONAL_DATA_CONSENT') {
    pdf = await buildPersonalDataConsentPdf(doc.recipient, {
      docId: doc.id,
      number: doc.number,
      documentDate: doc.document_date,
    });
    /* istanbul ignore next */
  } else if (doc.DocumentType.alias === 'ELECTRONIC_INTERACTION_AGREEMENT') {
    pdf = await buildElectronicInteractionAgreementPdf(doc.recipient, {
      docId: doc.id,
      number: doc.number,
      documentDate: doc.document_date,
    });
  } else {
    pdf = await createPdfBuffer(doc.name);
  }
  const newFile = await fileService.saveGeneratedPdf(
    pdf,
    `${doc.name}.pdf`,
    actorId
  );
  const oldFileId = doc.file_id;
  await doc.update({ file_id: newFile.id, updated_by: actorId });
  if (oldFileId) {
    await fileService.removeFile(oldFileId);
  }
  const fio = `${doc.recipient.last_name} ${doc.recipient.first_name}${
    doc.recipient.patronymic ? ` ${doc.recipient.patronymic}` : ''
  }`.trim();
  let baseName =
    `${doc.DocumentType ? doc.DocumentType.name : 'Документ'} · ${fio}`.trim();
  baseName = baseName.replace(/[\\/:*?"<>|]/g, ' ');
  const url = await fileService.getDownloadUrl(newFile, {
    filename: `${baseName}.pdf`,
  });
  return { file: { id: newFile.id, url } };
}

function createPdfBuffer(text) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', (d) => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.text(text);
    doc.end();
  });
}

async function generateInitial(user, signTypeId) {
  const [consentType, agreementType, status] = await Promise.all([
    DocumentType.findOne({
      where: { alias: 'PERSONAL_DATA_CONSENT' },
      attributes: ['id', 'name'],
    }),
    DocumentType.findOne({
      where: { alias: 'ELECTRONIC_INTERACTION_AGREEMENT' },
      attributes: ['id', 'name'],
    }),
    DocumentStatus.findOne({ where: { alias: 'CREATED' }, attributes: ['id'] }),
  ]);
  if (!consentType || !agreementType || !status) return;
  const exists = await Document.findOne({
    where: { recipient_id: user.id, document_type_id: consentType.id },
  });
  if (!exists) {
    // First pass: create a minimal PDF to obtain a document UUID and number
    const pdf = await buildPersonalDataConsentPdf(user, {});
    const file = await fileService.saveGeneratedPdf(
      pdf,
      `${consentType.name}.pdf`,
      user.id
    );
    const created = await Document.create({
      recipient_id: user.id,
      document_type_id: consentType.id,
      status_id: status.id,
      file_id: file.id,
      sign_type_id: signTypeId,
      name: consentType.name,
      document_date: new Date(),
      created_by: user.id,
      updated_by: user.id,
    });
    // Second pass: regenerate with the known document id/number and replace file
    try {
      const regenerated = await regenerate(created.id, user.id);
      void regenerated;
    } catch {
      // if regeneration fails, keep the initial file
    }
  }
  const existsAgreement = await Document.findOne({
    where: { recipient_id: user.id, document_type_id: agreementType.id },
  });
  /* istanbul ignore next */
  if (!existsAgreement) {
    // First pass: create a minimal PDF to obtain a document UUID and number
    const initial = await createPdfBuffer(agreementType.name);
    const file = await fileService.saveGeneratedPdf(
      initial,
      `${agreementType.name}.pdf`,
      user.id
    );
    const createdAgreement = await Document.create({
      recipient_id: user.id,
      document_type_id: agreementType.id,
      status_id: status.id,
      file_id: file.id,
      sign_type_id: signTypeId,
      name: agreementType.name,
      document_date: new Date(),
      created_by: user.id,
      updated_by: user.id,
    });
    // Second pass: regenerate with the known document id/number and replace file
    try {
      const regenerated = await regenerate(createdAgreement.id, user.id);
      void regenerated;
    } catch {
      // keep the initial file if regeneration fails
    }
  }
}

async function update(documentId, data, actorId) {
  const doc = await Document.findByPk(documentId);
  if (!doc) {
    throw new ServiceError('document_not_found', 404);
  }
  const updates = {};
  if (data.signTypeId) {
    const signType = await SignType.findByPk(data.signTypeId);
    if (!signType) {
      throw new ServiceError('sign_type_not_found', 404);
    }
    updates.sign_type_id = data.signTypeId;
  }
  if (Object.keys(updates).length === 0) return doc;
  updates.updated_by = actorId;
  await doc.update(updates);
  return doc;
}

async function remove(documentId, actorId) {
  const doc = await Document.findByPk(documentId);
  if (!doc) {
    throw new ServiceError('document_not_found', 404);
  }
  await doc.update({ updated_by: actorId });
  const fileId = doc.file_id;
  await doc.destroy();
  if (fileId) {
    await fileService.removeFile(fileId);
  }
}

export default {
  create,
  listByUser,
  listAll,
  sign,
  requestSignature,
  uploadSignedFile,
  regenerate,
  generateInitial,
  update,
  remove,
  async generatePersonalDataConsent(idOrUserId) {
    // Try as document id first
    let doc = await Document.findByPk(idOrUserId, {
      include: [
        {
          model: User,
          as: 'recipient',
          attributes: [
            'id',
            'last_name',
            'first_name',
            'patronymic',
            'birth_date',
          ],
        },
      ],
    });
    if (doc) {
      return buildPersonalDataConsentPdf(doc.recipient, {
        docId: doc.id,
        number: doc.number,
      });
    }
    // Treat as user id: try existing consent doc
    const consentType = await DocumentType.findOne({
      where: { alias: 'PERSONAL_DATA_CONSENT' },
      attributes: ['id'],
    });
    if (consentType) {
      doc = await Document.findOne({
        where: { recipient_id: idOrUserId, document_type_id: consentType.id },
        include: [
          {
            model: User,
            as: 'recipient',
            attributes: [
              'id',
              'last_name',
              'first_name',
              'patronymic',
              'birth_date',
            ],
          },
        ],
      });
      if (doc) {
        return buildPersonalDataConsentPdf(doc.recipient, {
          docId: doc.id,
          number: doc.number,
        });
      }
    }
    // Fallback: ad-hoc by user id without document
    const user = await User.findByPk(idOrUserId, {
      attributes: ['id', 'last_name', 'first_name', 'patronymic', 'birth_date'],
    });
    if (!user) throw new ServiceError('user_not_found', 404);
    return buildPersonalDataConsentPdf(user, { userId: user.id });
  },
  /* istanbul ignore next */
  async generateElectronicInteractionAgreement(idOrUserId) {
    // Try as document id first
    let doc = await Document.findByPk(idOrUserId, {
      include: [
        {
          model: User,
          as: 'recipient',
          attributes: [
            'id',
            'last_name',
            'first_name',
            'patronymic',
            'birth_date',
          ],
        },
        { model: DocumentType, attributes: ['alias'] },
      ],
    });
    if (doc) {
      return buildElectronicInteractionAgreementPdf(doc.recipient, {
        docId: doc.id,
        number: doc.number,
        documentDate: doc.document_date,
      });
    }
    // Treat as user id: try existing agreement doc
    const agreementType = await DocumentType.findOne({
      where: { alias: 'ELECTRONIC_INTERACTION_AGREEMENT' },
      attributes: ['id'],
    });
    if (agreementType) {
      doc = await Document.findOne({
        where: { recipient_id: idOrUserId, document_type_id: agreementType.id },
        include: [
          {
            model: User,
            as: 'recipient',
            attributes: [
              'id',
              'last_name',
              'first_name',
              'patronymic',
              'birth_date',
            ],
          },
        ],
      });
      if (doc) {
        return buildElectronicInteractionAgreementPdf(doc.recipient, {
          docId: doc.id,
          number: doc.number,
          documentDate: doc.document_date,
        });
      }
    }
    // Fallback: ad-hoc by user id without document
    const user = await User.findByPk(idOrUserId, {
      attributes: ['id', 'last_name', 'first_name', 'patronymic', 'birth_date'],
    });
    if (!user) throw new ServiceError('user_not_found', 404);
    return buildElectronicInteractionAgreementPdf(user, { userId: user.id });
  },
};
