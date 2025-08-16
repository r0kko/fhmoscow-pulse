import {Op} from 'sequelize';
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
import {applyFonts, applyFirstPageHeader, applyFooter} from '../utils/pdf.js';

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
    return [user.last_name, user.first_name, user.patronymic].filter(Boolean).join(' ');
}

/* istanbul ignore next */
async function buildPersonalDataConsentPdf(user, meta = {}) {
    const chunks = [];
    const doc = new PDFDocument({
        size: 'A4',
        margins: {top: 30, bottom: 80, left: 30, right: 30},
        bufferPages: true,
        info: {Title: 'Согласие на обработку персональных данных'},
    });
    doc.on('data', (d) => chunks.push(d));
    const done = new Promise((resolve) => doc.on('end', () => resolve()));

  const fonts = applyFonts(doc); // returns { regular, bold }
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const clean = (v) => (v ? String(v).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() : v);
  const NBSP = '\u00A0';
  const protectTypography = (s) =>
      typeof s === 'string'
          ? s
                // Keep prepositions/conjunctions with the next word (Russian typographic norm)
                .replace(/\b([ВвКкСсУуОоИи])\s/g, `$1${NBSP}`)
                // Bind numero sign with the number
                .replace(/\s№\s*/g, `${NBSP}№ `)
              : s;
  const seg = (text, bold = false) => ({text: protectTypography(text ?? ''), bold});
  const tokenize = (text) =>
      (text || '').split(/(\s+)/).filter((t) => t.length > 0);
  const measure = (doc, fonts, token, bold) => {
      const prev = doc._font;
      try { doc.font(bold ? fonts.bold : fonts.regular); } catch { void 0; }
      const w = doc.widthOfString(token);
      if (prev) { try { doc.font(prev.name || prev); } catch { void 0; } }
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
          while (line.length && /^\s+$/.test(line[line.length - 1].text)) line.pop();
          lines.push({items: line, width: lineWidth});
          line = [];
          lineWidth = 0;
      };
      // Build tokens with style
      const styledTokens = [];
      segments.forEach((s) => {
          tokenize(s.text).forEach((t) => styledTokens.push({text: t, bold: s.bold}));
      });
      let i = 0;
      while (i < styledTokens.length) {
          const {text, bold} = styledTokens[i];
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
              line.push({text, bold, width: tokenWidth});
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
              line.push({text: part + '-', bold, width: partWidth});
              lineWidth += partWidth;
              pushLine();
              // Replace current token with remainder and continue
              styledTokens[i] = {text: rest, bold};
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
          const stretchPoints = !last ? ln.items.filter((it) => isStretchableSpace(it.text)).length : 0;
          const extraPerSpace = stretchPoints > 0 ? extra / stretchPoints : 0;
          ln.items.forEach((it) => {
              try { doc.font(it.bold ? fonts.bold : fonts.regular); } catch { void 0; }
              doc.text(it.text, x, y, {lineBreak: false});
              x += it.width + (isStretchableSpace(it.text) && !last ? extraPerSpace : 0);
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
    } catch { /* empty */
    }
    doc.fontSize(14).text(heading, {align: 'center'});
    // Subtitle under the heading
    try {
        doc.moveDown(0.2);
        doc.fillColor('#666666');
        const savedFont = doc._font ? doc._font.name : null;
        try {
            doc.font('SB-Italic');
        } catch { /* keep current */
        }
        doc.fontSize(10).text('для спортивного судьи Федерации хоккея Москвы', {align: 'center'});
        if (savedFont) doc.font(savedFont);
        doc.fillColor('black');
    } catch { /* noop */
    }
    try {
        doc.font(fonts.regular);
    } catch { /* empty */
    }
    doc.moveDown(1);
    doc.fontSize(11);

    // Gather user details from DB
    const [passports, userAddresses, innRec, snilsRec] = await Promise.all([
        (Models.Passport?.findAll?.bind(Models.Passport) || (() => Promise.resolve([])))({
            where: {user_id: user.id},
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
        (Models.UserAddress?.findAll?.bind(Models.UserAddress) || (() => Promise.resolve([])))(
            {
                where: {user_id: user.id},
                include: [
                    {model: Models.Address, attributes: ['result', 'postal_code']},
                    {model: Models.AddressType, attributes: ['alias', 'name']},
                ],
            }
        ),
        (Models.Inn?.findOne?.bind(Models.Inn) || (() => Promise.resolve(null)))({
            where: {user_id: user.id},
            attributes: ['number'],
        }),
        (Models.Snils?.findOne?.bind(Models.Snils) || (() => Promise.resolve(null)))({
            where: {user_id: user.id},
            attributes: ['number'],
        }),
    ]);

  const passport = passports?.[0];
    const reg = (userAddresses || []).find((ua) => ua.AddressType?.alias === 'REGISTRATION');
    const regAdr = reg?.Address;

    const pSeries = passport?.series || '____';
    const pNumber = passport?.number || '_______';
  const pIssuer = clean(passport?.issuing_authority) || '____________________________';
  const pIssuerCode = clean(passport?.issuing_authority_code) || '_________';
  const pIssueDate = formatDateHuman(passport?.issue_date).replace('____ г.', '____ г.');
  const placeOfBirth = clean(passport?.place_of_birth) || '____________________';
  const regAddress = clean(regAdr?.result) || '_______________________________________________';
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
            seg('. Настоящим свободно, своей волей и в своем интересе даю свое согласие '),
            seg('РОО «Федерация хоккея Москвы», ', true),
            seg('ОГРН 1037739762610, ', true),
            seg('ИНН 7708046206', true),
            seg(', расположенной по адресу: 101000, г. Москва, Кривоколенный пер., д. 9, стр. 1 (далее – '),
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

    doc.font(fonts.bold).text('Настоящее согласие предоставляется исключительно в целях:', {align: 'left'});
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
        'исполнения Оператором своих уставных целей и требований законодательства Российской Федерации в сфере физической культуры и спорта.'
    ];
    goals.forEach((g) => {
        doc.text(` • ${g}`, {align: 'left'});
    });
    doc.moveDown();

    doc.font(fonts.bold).text('В рамках данного документа подтверждаю свое полное и безоговорочное согласие на обработку следующих видов данных:', {align: 'left'});
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
        'Другие виды: иные персональные данные, сообщенные мною Оператору в связи с выполнением функций судьи, — в объёме, необходимом для достижения целей обработки.'
    ];
    dataItems.forEach((item) => {
        const [label, rest] = item.split(':');
        if (rest !== undefined) {
            doc.text(' • ', {continued: true});
            doc.font(fonts.bold).text(`${label}: `, {continued: true});
            doc.font(fonts.regular).text(` ${rest.trim()}`, {align: 'justify'});
        } else {
            doc.text(` • ${item}`, {align: 'justify'});
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
        {align: 'justify'}
    );
    doc.moveDown(0.5);
    doc.text(
        'Оператор обеспечивает запись, систематизацию, накопление, хранение, уточнение (обновление, изменение) и извлечение персональных данных граждан Российской Федерации с использованием баз данных, находящихся на территории Российской Федерации (ч. 5 ст. 18 Закона № 152 ФЗ).',
        { align: 'justify' }
    );
    doc.moveDown(0.5);
    doc.text(
        'Обработка персональных данных может осуществляться как автоматизированным способом (в информационных системах, например, в базе данных Федерации хоккея Москвы), так и неавтоматизированным способом (на бумажных носителях). В рамках выполнения указанных действий мои данные могут быть внесены в информационно-аналитические системы хоккейных организаций (включая защищенную облачную систему Федерации хоккея России или Министерства спорта РФ, при необходимости передачи данных туда).',
        {align: 'justify'}
    );
    doc.moveDown(0.5);
    doc.text(
        'Оператор вправе поручить обработку моих персональных данных третьим лицам при соблюдении требований законодательства о персональных данных. В таких случаях заключается договор поручения обработки (ч. 3 ст. 6 Закона № 152 ФЗ), предусматривающий конфиденциальность и меры по безопасности персональных данных.',
        {align: 'justify'}
    );
    doc.moveDown();

    const transfers = [
        'компетентным организациям и органам в сфере спорта: в Федерацию хоккея России (ФХР) и ее структурные подразделения (например, Всероссийскую коллегию судей) — для учета меня в единой базе спортивных судей, подтверждения категории, допуска к всероссийским соревнованиям и др.; в Министерство спорта РФ или уполномоченные региональные органы — для оформления приказов о присвоении судейской категории, статистической отчетности и иных предусмотренных законом процедур;',
        'оргкомитетам и организаторам соревнований, спортивным клубам — в части, необходимой для моего допуска и аккредитации на конкретные соревнования (например, передача Ф.И.О. и категории судьи в заявку турнира, проверка в списках аккредитованных лиц);',
        'страховым компаниям — при наступлении страхового случая на соревнованиях (в пределах, необходимых для оформления страховых выплат по полису, если такой полис имеется у судьи);',
        'службам экстренной помощи и медицины — при чрезвычайной ситуации, когда необходимо сообщить мои данные (например, сведения о медицинском допуске).'
    ];
    doc.font(fonts.bold).text('Я даю свое согласие на передачу (предоставление) моих персональных данных третьим лицам в следующих случаях:', { align: 'justify' });
    doc.moveDown(0.5);
    transfers.forEach((t) => doc.font(fonts.regular).text(` • ${t}`, { align: 'left' }));
    doc.moveDown(0.5);
    doc.text(
        'Передачи осуществляются ограниченному кругу лиц в рамках исполнения моих функций судьи и требований законодательства. Иные передачи осуществляются только при наличии оснований, предусмотренных Законом № 152 ФЗ.',
        { align: 'justify' }
    );
    doc.moveDown();

    doc.font(fonts.bold).text('Согласие на распространение персональных данных', { align: 'center' });
    doc.moveDown();
    doc.font(fonts.regular).text(
        'Настоящий раздел выражает мое отдельное волеизъявление на распространение персональных данных неопределенному кругу лиц. Я разрешаю распространение только следующего перечня сведений:',
        { align: 'justify' }
    );
    const publicity = [
        'фамилия, имя, отчество;',
        'судейская квалификационная категория (разряд) и спортивное звание (при наличии);',
        'город (регион) проживания;',
        'портретная фотография.'
    ];
    publicity.forEach((p) => doc.text(` • ${p}`, { align: 'justify' }));

    doc.moveDown(0.5);
    doc.text('При этом я устанавливаю условия и запреты на обработку указанных персональных данных неограниченным кругом лиц:', { align: 'justify' });
    const publicityLimits = [
        'разрешено размещение указанной информации только на официальном сайте Оператора и в его официальных аккаунтах в социальных сетях (например, ВКонтакте и Telegram), а также в печатных и электронных СМИ для освещения спортивных мероприятий;',
        'запрещается передача (кроме предоставления доступа) указанных персональных данных неограниченному кругу лиц для рекламных, маркетинговых и иных несвязанных с судейской деятельностью целей;',
        'запрещается иная обработка указанных персональных данных неограниченным кругом лиц, кроме получения доступа к ним на указанных ресурсах Оператора.'
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
        doc.fontSize(10).fillColor('#666666').text('Подпись (согласие на распространение ПД):', leftX, y);
        const lineWidth = 180;
        const rightX = doc.page.width - doc.page.margins.right - lineWidth;
        const lineY = y + 12;
        doc.save().moveTo(rightX, lineY).lineTo(rightX + lineWidth, lineY).lineWidth(1).stroke('#666666').restore();
        doc.fillColor('black').fontSize(11);
        doc.moveDown();
    } catch { /* noop */ }

    doc.font(fonts.regular).text(
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
        'направить заявление об отзыве в форме электронного документа, подписанного электронной подписью (например, через сервис «Контур.Сайн») либо с использованием информационной системы уполномоченного органа по защите прав субъектов персональных данных — в случаях, предусмотренных законом.'
    ];
    doc.font(fonts.regular).text('Мне известно, что я могу в любое время отозвать настоящее согласие, направив Оператору соответствующее заявление. Отзыв согласия не требует обоснования с моей стороны. Для отзыва согласия я могу воспользоваться одним из следующих способов:', {align: 'justify'});
    revoke.forEach((r) => doc.text(` • ${r}`, {align: 'justify'}));
    doc.moveDown(0.5);
    doc.text(
        'Оператор прекращает обработку моих персональных данных не позднее чем в течение 30 дней с момента получения отзыва  (за исключением хранения обезличенных статистических данных или случаев, когда обработка без согласия допускается законом – например, если данные уже обобщены в обезличенном виде для статистики). Оператор также уведомит меня о прекращении обработки по моему запросу. Я ознакомлен(а) с тем, что отзыв согласия не имеет обратной силы и не затрагивает законность обработки, осуществленной до получения отзыва.',
        {align: 'justify'}
    );
    doc.moveDown();

    doc.text(
        'Мне разъяснены права, предусмотренные законом «О персональных данных», включая право требовать уточнения, блокирования или уничтожения моих персональных данных при их неполноте, устаревании или незаконной обработке, а также право на получение информации о своих персональных данных и факте их обработки (ст. 14 Закона № 152 ФЗ). В случае моего обращения Оператор предоставляет соответствующие сведения в течение 30 дней. Контакты Оператора для запросов: тел. +7 495 621 35 95, email: fhmoscow@mail.ru.',
        {align: 'justify'}
    );
    doc.moveDown();

    doc.text(
        'Своими действиями по подписанию настоящего документа (в том числе проставлением простой электронной подписи в сервисе «Контур.Сайн») я подтверждаю, что внимательно прочитал(а) и понял(а) содержание данного согласия и согласен(на) с его условиями. Настоящее согласие подписано мной свободно, своей волей и в своем интересе.',
        {align: 'justify'}
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
        doc.save().moveTo(rightX, lineY).lineTo(rightX + lineWidth, lineY).lineWidth(1).stroke('#666666').restore();
        doc.font(fonts.regular).fontSize(8).fillColor('#666666').text('Подпись', rightX + lineWidth / 2 - 20, lineY + 4);
        doc.fillColor('black');
        doc.moveDown(3);
    } catch {
        const signLine2 = '__________________________          __________________________';
        const signLabels2 = 'Подпись                                Дата';
        doc.text(signLine2, {align: 'left'});
        doc.text(signLabels2, {align: 'left'});
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

async function create(data, userId) {
    let statusId = data.statusId;
    if (!statusId) {
        const status = await DocumentStatus.findOne({
            where: {alias: 'CREATED'},
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
        where: {recipient_id: userId},
        include: [
            {model: DocumentType, attributes: ['name', 'alias', 'generated']},
            {model: SignType, attributes: ['name', 'alias']},
            {model: File, attributes: ['id', 'key']},
            {model: DocumentStatus, attributes: ['name', 'alias']},
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
                ? {name: d.SignType.name, alias: d.SignType.alias}
                : null,
            status: d.DocumentStatus
                ? {name: d.DocumentStatus.name, alias: d.DocumentStatus.alias}
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
            {model: DocumentType, attributes: ['name', 'alias', 'generated']},
            {model: SignType, attributes: ['name', 'alias']},
            {
                model: User,
                as: 'recipient',
                attributes: ['last_name', 'first_name', 'patronymic'],
            },
            {model: DocumentStatus, attributes: ['name', 'alias']},
            {model: File, attributes: ['id', 'key']},
        ],
        order: [['created_at', 'DESC']],
    });
    return Promise.all(
        docs.map(async (d) => ({
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
                ? {name: d.DocumentStatus.name, alias: d.DocumentStatus.alias}
                : null,
            file: d.File
                ? {id: d.File.id, url: await fileService.getDownloadUrl(d.File)}
                : null,
            createdAt: d.created_at,
        }))
    );
}

async function sign(user, documentId) {
    const doc = await Document.findByPk(documentId);
    if (!doc) {
        throw new ServiceError('document_not_found', 404);
    }
    const count = await DocumentUserSign.count({
        where: {document_id: documentId, deleted_at: {[Op.is]: null}},
    });
    if (count >= 2) {
        throw new ServiceError('document_sign_limit', 400);
    }
    const existing = await DocumentUserSign.findOne({
        where: {document_id: documentId, user_id: user.id},
    });
    if (existing) {
        throw new ServiceError('document_already_signed', 400);
    }
    const userSign = await UserSignType.findOne({where: {user_id: user.id}});
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
        where: {alias: 'SIGNED'},
        attributes: ['id'],
    });
    if (signedStatus) {
        await doc.update({status_id: signedStatus.id, updated_by: user.id});
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
            where: {alias: 'SIMPLE_ELECTRONIC'},
            attributes: ['id'],
        });
        if (signType) {
            await UserSignType.destroy({where: {user_id: user.id}});
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
            {model: SignType, attributes: ['alias', 'name']},
            {
                model: User,
                as: 'recipient',
                attributes: ['email', 'last_name', 'first_name', 'patronymic'],
            },
            {model: DocumentStatus, attributes: ['alias']},
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
        where: {alias: 'AWAITING_SIGNATURE'},
        attributes: ['id', 'name', 'alias'],
    });
    if (!status) {
        throw new ServiceError('document_status_not_found', 500);
    }
    await doc.update({status_id: status.id, updated_by: actorId});
    if (doc.recipient?.email) {
        await emailService.sendDocumentAwaitingSignatureEmail(doc.recipient, doc);
    }
    return {name: status.name, alias: status.alias};
}

async function uploadSignedFile(documentId, file, actorId) {
    if (!file) {
        throw new ServiceError('file_required', 400);
    }
    const doc = await Document.findByPk(documentId, {
        include: [
            {model: SignType, attributes: ['alias']},
            {model: DocumentStatus, attributes: ['alias']},
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
        where: {alias: 'SIGNED'},
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
    const url = await fileService.getDownloadUrl(newFile);
    return {
        status: {name: signedStatus.name, alias: signedStatus.alias},
        file: {id: newFile.id, url},
    };
}

async function regenerate(documentId, actorId) {
    const doc = await Document.findByPk(documentId, {
        include: [
            {model: DocumentType, attributes: ['name', 'generated', 'alias']},
            {model: DocumentStatus, attributes: ['alias']},
            {model: User, as: 'recipient', attributes: ['id', 'last_name', 'first_name', 'patronymic', 'birth_date']},
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
    await doc.update({file_id: newFile.id, updated_by: actorId});
    if (oldFileId) {
        await fileService.removeFile(oldFileId);
    }
    const url = await fileService.getDownloadUrl(newFile);
    return {file: {id: newFile.id, url}};
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
            where: {alias: 'PERSONAL_DATA_CONSENT'},
            attributes: ['id', 'name'],
        }),
        DocumentType.findOne({
            where: {alias: 'ELECTRONIC_INTERACTION_AGREEMENT'},
            attributes: ['id', 'name'],
        }),
        DocumentStatus.findOne({where: {alias: 'CREATED'}, attributes: ['id']}),
    ]);
    if (!consentType || !agreementType || !status) return;
    const exists = await Document.findOne({
        where: {recipient_id: user.id, document_type_id: consentType.id},
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
        where: {recipient_id: user.id, document_type_id: agreementType.id},
    });
    if (!existsAgreement) {
        const pdf = await createPdfBuffer(agreementType.name);
        const file = await fileService.saveGeneratedPdf(
            pdf,
            `${agreementType.name}.pdf`,
            user.id
        );
        await Document.create({
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
    await doc.update({updated_by: actorId});
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
                    attributes: ['id', 'last_name', 'first_name', 'patronymic', 'birth_date'],
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
            where: {alias: 'PERSONAL_DATA_CONSENT'},
            attributes: ['id'],
        });
        if (consentType) {
            doc = await Document.findOne({
                where: {recipient_id: idOrUserId, document_type_id: consentType.id},
                include: [
                    {
                        model: User,
                        as: 'recipient',
                        attributes: ['id', 'last_name', 'first_name', 'patronymic', 'birth_date'],
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
        return buildPersonalDataConsentPdf(user, {userId: user.id});
    },
};
