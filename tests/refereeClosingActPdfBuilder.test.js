import { beforeEach, expect, jest, test } from '@jest/globals';

let textCalls = [];
let lastDoc = null;
let textRecords = [];

class FakePdfDocument {
  constructor({ margins } = {}) {
    this.handlers = {};
    this.page = {
      width: 595,
      height: 842,
      margins: margins || { top: 30, right: 30, bottom: 80, left: 30 },
    };
    this.pages = 1;
    this.x = this.page.margins.left;
    this.y = this.page.margins.top;
    this._fontSize = 10;
    this._font = { name: 'fake' };
    lastDoc = this;
  }

  on(event, cb) {
    this.handlers[event] = cb;
    return this;
  }

  font() {
    return this;
  }

  fontSize(size) {
    this._fontSize = size;
    return this;
  }

  fillColor() {
    return this;
  }

  lineWidth() {
    return this;
  }

  strokeColor() {
    return this;
  }

  moveTo() {
    return this;
  }

  lineTo() {
    return this;
  }

  stroke() {
    return this;
  }

  rect() {
    return this;
  }

  dash() {
    return this;
  }

  undash() {
    return this;
  }

  fill() {
    return this;
  }

  roundedRect() {
    return this;
  }

  save() {
    return this;
  }

  restore() {
    return this;
  }

  image() {
    return this;
  }

  opacity() {
    return this;
  }

  addPage() {
    this.pages += 1;
    this.x = this.page.margins.left;
    this.y = this.page.margins.top;
    return this;
  }

  switchToPage() {
    return this;
  }

  bufferedPageRange() {
    return { start: 0, count: this.pages };
  }

  currentLineHeight() {
    return Math.ceil((this._fontSize || 10) * 1.05);
  }

  widthOfString(text) {
    return [...String(text || '')].reduce((sum, char) => {
      if (/\s/.test(char)) return sum + (this._fontSize || 10) * 0.28;
      if (/[А-Яа-яЁё]/.test(char)) return sum + (this._fontSize || 10) * 0.58;
      return sum + (this._fontSize || 10) * 0.36;
    }, 0);
  }

  heightOfString(text, options = {}) {
    const width = Math.max(40, Number(options?.width || 120));
    const charWidth = Math.max(3, (this._fontSize || 10) * 0.52);
    const charsPerLine = Math.max(1, Math.floor(width / charWidth));
    const lines = String(text || '')
      .split('\n')
      .reduce(
        (acc, line) => acc + Math.max(1, Math.ceil(line.length / charsPerLine)),
        0
      );
    const lineGap = Number(options?.lineGap || 0);
    return lines * this.currentLineHeight() + Math.max(0, lines - 1) * lineGap;
  }

  text(value, a, b, c) {
    let text = value;
    let x = null;
    let y = null;
    let options = {};
    if (typeof a === 'number' && typeof b === 'number') {
      x = a;
      y = b;
      options = c || {};
    } else if (typeof a === 'object' && a) {
      options = a;
    } else if (typeof c === 'object' && c) {
      options = c;
    }
    if (typeof y === 'number') {
      this.y = y;
    }
    textCalls.push(String(text || ''));
    textRecords.push({
      text: String(text || ''),
      x,
      y,
      options,
      fontSize: this._fontSize,
    });
    this.y += this.heightOfString(text, options);
    return this;
  }

  moveDown(lines = 1) {
    this.y += this.currentLineHeight() * Number(lines || 1);
    return this;
  }

  end() {
    this.handlers.data?.(Buffer.from('pdf'));
    this.handlers.end?.();
  }
}

beforeEach(() => {
  jest.resetModules();
  textCalls = [];
  textRecords = [];
  lastDoc = null;
});

test('closing act builder renders accounting layout and keeps short act on one page', async () => {
  jest.unstable_mockModule('pdfkit', () => ({
    __esModule: true,
    default: FakePdfDocument,
  }));
  const applyFirstPageHeader = jest.fn();
  jest.unstable_mockModule('../src/utils/pdf.js', () => ({
    __esModule: true,
    applyFonts: () => ({ regular: 'regular', bold: 'bold' }),
    applyFirstPageHeader,
    applyFooter: async () => {},
    applyESignStamp: async () => {},
  }));

  const { default: buildRefereeClosingActPdf } =
    await import('../src/services/docBuilders/refereeClosingAct.js');

  const payload = {
    customer: {
      name: 'РОО "Федерация хоккея Москвы"',
      short_name: 'ФХМ',
      inn: '7708046206',
      kpp: '770101001',
      address: '101000, Москва, Кривоколенный переулок, д. 9',
    },
    performer: {
      full_name: 'Тестов Никита Анатольевич',
      inn: '132612908997',
      address: '109000, Москва, ул. Тестовая, д. 1, кв. 15',
      bank_account: {
        number: '40702810900000005555',
        bic: '044525225',
        bank_name: 'ПАО Сбербанк',
        correspondent_account: '30101810400000000225',
        inn: '7707083893',
        kpp: '773601001',
      },
    },
    contract: {
      title:
        'заявлением о присоединении к условиям договора оказания услуг по судейству хоккейных матчей',
      number: '26.03/1024',
      document_date: '2026-03-12',
    },
    totals: {
      total_amount_rub: '5800.00',
      total_amount_words: 'Пять тысяч восемьсот рублей 00 копеек',
      vat_label: 'Без налога (НДС)',
      items_count: 2,
    },
    items: [
      {
        line_no: 1,
        service_datetime: '01.03.2026, 12:00',
        match_label: 'ХК Молния - ХК Иремель',
        competition_name: 'Кубок Москвы',
        role_name: 'Главный судья',
        tariff_label: 'RPOT',
        amount_rub: '2900.00',
        total_amount_rub: '2900.00',
      },
      {
        line_no: 2,
        service_datetime: '01.03.2026, 13:30',
        match_label: 'ХК ИнтерРАО - ХК Аврора',
        competition_name: 'Кубок Москвы',
        role_name: 'Судья',
        tariff_label: 'RPOT',
        amount_rub: '2900.00',
        total_amount_rub: '2900.00',
      },
    ],
    fhmo_signer: {
      full_name: 'Дробот Алексей Андреевич',
    },
  };

  const buffer = await buildRefereeClosingActPdf(payload, {
    number: '26.03/1024',
    documentDate: '2026-03-12',
    docId: 'doc-1',
    signatures: [],
  });

  const renderedText = textCalls.join('\n');

  expect(Buffer.isBuffer(buffer)).toBe(true);
  expect(renderedText).toContain('Акт об оказании услуг');
  expect(renderedText).toContain('Спортивного судьи Федерации хоккея Москвы');
  expect(renderedText).toContain('Исполнитель');
  expect(renderedText).toContain('Заказчик');
  expect(renderedText).toContain('Дата и время');
  expect(renderedText).toContain('Амплуа');
  expect(renderedText).toContain('Тариф');
  expect(renderedText).toContain('Без налога (НДС)');
  expect(renderedText).toContain('Пять тысяч восемьсот рублей 00 копеек');
  expect(renderedText).toContain('Ожидает электронной подписи');
  expect(renderedText).toContain(
    'В соответствии с заявлением о присоединении к условиям договора оказания услуг по судейству'
  );
  expect(renderedText).not.toContain('Ожидает подписи');
  expect(renderedText).not.toContain('\u200b');
  expect(renderedText).toContain(
    'Вышеперечисленные услуги оказаны полностью и в срок.'
  );
  expect(renderedText).toContain('Заказчик');
  expect(renderedText).toContain('Исполнитель');
  expect(renderedText).not.toContain('Банковские реквизиты исполнителя');
  expect(renderedText).not.toContain('40702810900000005555');
  expect(renderedText).not.toContain('044525225');
  expect(renderedText).not.toContain('30101810400000000225');
  const introRecord = textRecords.find((entry) =>
    entry.text.startsWith('В соответствии с заявлением')
  );
  expect(introRecord?.options).toEqual(
    expect.objectContaining({
      width: 535,
      align: 'justify',
    })
  );
  const closingRecord = textRecords.find((entry) =>
    entry.text.startsWith(
      'Вышеперечисленные услуги оказаны полностью и в срок.'
    )
  );
  expect(closingRecord?.options).toEqual(
    expect.objectContaining({
      width: 535,
      align: 'justify',
    })
  );
  expect(lastDoc?.pages).toBe(1);
});

test('closing act builder supports long multi-page registries', async () => {
  jest.unstable_mockModule('pdfkit', () => ({
    __esModule: true,
    default: FakePdfDocument,
  }));
  jest.unstable_mockModule('../src/utils/pdf.js', () => ({
    __esModule: true,
    applyFonts: () => ({ regular: 'regular', bold: 'bold' }),
    applyFirstPageHeader: () => {},
    applyFooter: async () => {},
    applyESignStamp: async () => {},
  }));

  const { default: buildRefereeClosingActPdf } =
    await import('../src/services/docBuilders/refereeClosingAct.js');

  const items = Array.from({ length: 32 }, (_, index) => ({
    line_no: index + 1,
    service_datetime: `01.03.2026, ${String(10 + (index % 10)).padStart(2, '0')}:00`,
    match_label: `Команда ${index + 1} - Команда ${index + 2}`,
    competition_name: 'Первенство Москвы',
    role_name: 'Судья',
    tariff_label: 'RPOT',
    amount_rub: '1200.00',
    total_amount_rub: '1200.00',
  }));

  await buildRefereeClosingActPdf(
    {
      customer: { name: 'ФХМ', inn: '7708046206', address: 'Москва' },
      performer: { full_name: 'Тестовый Судья', inn: '123', address: 'Москва' },
      contract: { number: '26.03/1024', document_date: '2026-03-12' },
      totals: {
        total_amount_rub: '38400.00',
        total_amount_words: 'Тридцать восемь тысяч четыреста рублей 00 копеек',
        vat_label: 'Без налога (НДС)',
        items_count: items.length,
      },
      items,
    },
    {
      number: '26.03/1024',
      documentDate: '2026-03-12',
      docId: 'doc-2',
      signatures: [],
    }
  );

  const renderedText = textCalls.join('\n');
  expect(lastDoc?.pages).toBeGreaterThan(1);
  expect(renderedText.match(/Дата и время/g)?.length || 0).toBeGreaterThan(1);
  expect(renderedText.match(/Акт об оказании услуг/g)?.length || 0).toBe(1);
  expect(
    renderedText.match(/Спортивного судьи Федерации хоккея Москвы/g)?.length ||
      0
  ).toBe(1);
});

test('closing act builder keeps table rows greedy before moving final block', async () => {
  jest.unstable_mockModule('pdfkit', () => ({
    __esModule: true,
    default: FakePdfDocument,
  }));
  const applyFirstPageHeader = jest.fn();
  jest.unstable_mockModule('../src/utils/pdf.js', () => ({
    __esModule: true,
    applyFonts: () => ({ regular: 'regular', bold: 'bold' }),
    applyFirstPageHeader,
    applyFooter: async () => {},
    applyESignStamp: async () => {},
  }));

  const { default: buildRefereeClosingActPdf } =
    await import('../src/services/docBuilders/refereeClosingAct.js');

  const items = Array.from({ length: 8 }, (_, index) => ({
    line_no: index + 1,
    service_datetime: `0${index + 1}.02.2026, 10:00`,
    match_label: `ХК ${index + 1} - ХК ${index + 2}`,
    competition_name: 'IX Кубок "ИнтерРАО"',
    role_name: 'Главный',
    tariff_label: 'RBT',
    amount_rub: '7000.00',
    total_amount_rub: '7000.00',
  }));

  await buildRefereeClosingActPdf(
    {
      customer: { name: 'ФХМ', inn: '7708046206', address: 'Москва' },
      performer: {
        full_name: 'Якас Константин Сергеевич',
        inn: '504106533659',
        address: 'Московская обл, г Реутов',
      },
      contract: { number: '25.09/354', document_date: '2025-09-11' },
      totals: {
        total_amount_rub: '48200.00',
        total_amount_words: Array.from(
          { length: 60 },
          () => 'Сорок восемь тысяч двести рублей 00 копеек'
        ).join(', '),
        vat_label: 'Без налога (НДС)',
        items_count: items.length,
      },
      items,
      fhmo_signer: { full_name: 'Дробот Алексей Андреевич' },
    },
    {
      number: '26.05/133',
      documentDate: '2026-05-19',
      docId: 'doc-greedy-table',
      signatures: [],
    }
  );

  const renderedText = textCalls.join('\n');
  expect(lastDoc?.pages).toBeGreaterThan(1);
  expect(renderedText).not.toContain('Акт № 26.05/133 · итоги и подписи');
  expect(renderedText).not.toContain('продолжение');
  expect(renderedText.match(/Дата и время/g)?.length || 0).toBe(1);
  expect(renderedText).toContain('8');
  expect(applyFirstPageHeader).toHaveBeenCalledTimes(1);
});

test('closing act builder keeps signature lane stable after FHMO signing', async () => {
  const applyESignStamp = jest
    .fn()
    .mockResolvedValueOnce({ x: 30, y: 640, width: 220, height: 136 });
  jest.unstable_mockModule('pdfkit', () => ({
    __esModule: true,
    default: FakePdfDocument,
  }));
  jest.unstable_mockModule('../src/utils/pdf.js', () => ({
    __esModule: true,
    applyFonts: () => ({ regular: 'regular', bold: 'bold' }),
    applyFirstPageHeader: () => {},
    applyFooter: async () => {},
    applyESignStamp,
  }));

  const { default: buildRefereeClosingActPdf } =
    await import('../src/services/docBuilders/refereeClosingAct.js');

  const buffer = await buildRefereeClosingActPdf(
    {
      customer: {
        name: 'РОО "Федерация хоккея Москвы"',
        inn: '7708046206',
        address: '101000, Москва, Кривоколенный переулок, д. 9',
      },
      performer: {
        full_name: 'Ларин Вячеслав Дмитриевич',
        inn: '132612908997',
        address: '109000, Москва, ул. Тестовая, д. 1, кв. 15',
      },
      contract: {
        number: '25.09/341',
        document_date: '2025-09-11',
      },
      totals: {
        total_amount_rub: '14000.00',
        total_amount_words: 'Четырнадцать тысяч рублей 00 копеек',
        vat_label: 'Без налога (НДС)',
        items_count: 2,
      },
      items: [
        {
          line_no: 1,
          service_datetime: '05.02.2026, 13:00',
          match_label: 'ХК Аврора - ХК Молния',
          competition_name: 'IX Кубок "ИнтерРАО"',
          role_name: 'Главный',
          tariff_label: 'RPOT',
          amount_rub: '7000.00',
          total_amount_rub: '7000.00',
        },
      ],
      fhmo_signer: {
        full_name: 'Дробот Алексей Андреевич',
        position: 'Ведущий специалист по судейству',
        department: 'РОО',
        organization: 'Федерация хоккея Москвы',
      },
    },
    {
      number: '26.03/1071',
      documentDate: '2026-03-13',
      docId: 'doc-signed',
      signatures: [
        {
          party: 'FHMO',
          sign_id: 'sign-1',
          user_id: 'user-1',
          created_at: '2026-03-13T10:00:00.000Z',
          position: 'Ведущий специалист по судейству',
          department: 'РОО',
          organization: 'Федерация хоккея Москвы',
          full_name: 'Дробот Алексей Андреевич',
        },
      ],
    }
  );

  expect(Buffer.isBuffer(buffer)).toBe(true);
  expect(applyESignStamp).toHaveBeenCalledTimes(1);
  expect(applyESignStamp).toHaveBeenCalledWith(
    expect.any(FakePdfDocument),
    expect.objectContaining({
      fio: 'Дробот Алексей Андреевич',
      signerDepartment: 'РОО',
      signerOrganization: 'Федерация хоккея Москвы',
      signerPosition: 'Ведущий специалист по судейству',
    })
  );
});

test('closing act builder renders referee signature in compact lane without extra height budget', async () => {
  const applyESignStamp = jest.fn().mockResolvedValue({
    x: 300,
    y: 640,
    width: 220,
    height: 68,
  });
  jest.unstable_mockModule('pdfkit', () => ({
    __esModule: true,
    default: FakePdfDocument,
  }));
  jest.unstable_mockModule('../src/utils/pdf.js', () => ({
    __esModule: true,
    applyFonts: () => ({ regular: 'regular', bold: 'bold' }),
    applyFirstPageHeader: () => {},
    applyFooter: async () => {},
    applyESignStamp,
  }));

  const { default: buildRefereeClosingActPdf } =
    await import('../src/services/docBuilders/refereeClosingAct.js');

  await buildRefereeClosingActPdf(
    {
      customer: { name: 'ФХМ', inn: '7708046206', address: 'Москва' },
      performer: {
        full_name: 'Барулин Владислав Александрович',
        inn: '132612908997',
        address: 'Москва',
      },
      contract: { number: '26.03/1024', document_date: '2026-03-12' },
      totals: {
        total_amount_rub: '5800.00',
        total_amount_words: 'Пять тысяч восемьсот рублей 00 копеек',
        vat_label: 'Без налога (НДС)',
        items_count: 1,
      },
      items: [
        {
          line_no: 1,
          service_datetime: '01.03.2026, 12:00',
          match_label: 'ХК Молния - ХК Иремель',
          competition_name: 'Кубок Москвы',
          role_name: 'Главный судья',
          tariff_label: 'RPOT',
          amount_rub: '5800.00',
          total_amount_rub: '5800.00',
        },
      ],
    },
    {
      number: '26.03/2001',
      documentDate: '2026-03-13',
      docId: 'doc-ref-sign',
      signatures: [
        {
          party: 'REFEREE',
          sign_id: 'sign-ref',
          user_id: 'user-ref',
          created_at: '2026-03-13T12:35:00.000Z',
          full_name: 'Барулин Владислав Александрович',
        },
      ],
    }
  );

  expect(applyESignStamp).toHaveBeenCalledWith(
    expect.any(FakePdfDocument),
    expect.objectContaining({
      stampHeight: 68,
      showPageInfo: false,
      showSignerDepartment: false,
      showSignerOrganization: false,
      signerPosition: 'Спортивный судья',
    })
  );
});

test('closing act builder wraps ampula without splitting normal role words', async () => {
  jest.unstable_mockModule('pdfkit', () => ({
    __esModule: true,
    default: FakePdfDocument,
  }));
  jest.unstable_mockModule('../src/utils/pdf.js', () => ({
    __esModule: true,
    applyFonts: () => ({ regular: 'regular', bold: 'bold' }),
    applyFirstPageHeader: () => {},
    applyFooter: async () => {},
    applyESignStamp: async () => {},
  }));

  const { default: buildRefereeClosingActPdf } =
    await import('../src/services/docBuilders/refereeClosingAct.js');

  await buildRefereeClosingActPdf(
    {
      customer: { name: 'ФХМ', inn: '7708046206', address: 'Москва' },
      performer: {
        full_name: 'Тестовый Судья',
        inn: '123456789012',
        address: 'Москва',
      },
      contract: { number: '26.03/1024', document_date: '2026-03-12' },
      totals: {
        total_amount_rub: '5800.00',
        total_amount_words: 'Пять тысяч восемьсот рублей 00 копеек',
        vat_label: 'Без налога (НДС)',
        items_count: 1,
      },
      items: [
        {
          line_no: 1,
          service_datetime: '01.03.2026, 12:00',
          match_label: 'ХК Молния - ХК Иремель',
          competition_name: 'Кубок Москвы',
          role_name: 'Судья при оштрафованных',
          tariff_label: 'RPOT',
          amount_rub: '5800.00',
          total_amount_rub: '5800.00',
        },
      ],
    },
    {
      number: '26.03/3001',
      documentDate: '2026-03-13',
      docId: 'doc-role-fit',
      signatures: [],
    }
  );

  const firstRoleLine = textRecords.find((entry) => entry.text === 'Судья при');
  const secondRoleLine = textRecords.find(
    (entry) => entry.text === 'оштрафованных'
  );
  expect(firstRoleLine).toBeDefined();
  expect(secondRoleLine).toBeDefined();
  expect(secondRoleLine?.x).toBe(firstRoleLine?.x);
  expect(
    Number(secondRoleLine?.y) - Number(firstRoleLine?.y)
  ).toBeLessThanOrEqual(12);
  expect(secondRoleLine?.fontSize).toBeLessThanOrEqual(9);
  expect(textCalls.join('\n')).not.toContain('ош\nтрафованн\nых');
});

test('closing act builder keeps advertising pause coordinator role compact', async () => {
  jest.unstable_mockModule('pdfkit', () => ({
    __esModule: true,
    default: FakePdfDocument,
  }));
  jest.unstable_mockModule('../src/utils/pdf.js', () => ({
    __esModule: true,
    applyFonts: () => ({ regular: 'regular', bold: 'bold' }),
    applyFirstPageHeader: () => {},
    applyFooter: async () => {},
    applyESignStamp: async () => {},
  }));

  const { default: buildRefereeClosingActPdf } =
    await import('../src/services/docBuilders/refereeClosingAct.js');

  await buildRefereeClosingActPdf(
    {
      customer: { name: 'ФХМ', inn: '7708046206', address: 'Москва' },
      performer: {
        full_name: 'Тестовый Судья',
        inn: '123456789012',
        address: 'Москва',
      },
      contract: { number: '26.03/1024', document_date: '2026-03-12' },
      totals: {
        total_amount_rub: '5800.00',
        total_amount_words: 'Пять тысяч восемьсот рублей 00 копеек',
        vat_label: 'Без налога (НДС)',
        items_count: 1,
      },
      items: [
        {
          line_no: 1,
          service_datetime: '01.03.2026, 12:00',
          match_label: 'ХК Молния - ХК Иремель',
          competition_name: 'Кубок Москвы',
          role_name: 'Судья координатор рекламной паузы',
          tariff_label: 'RPOT',
          amount_rub: '5800.00',
          total_amount_rub: '5800.00',
        },
      ],
    },
    {
      number: '26.03/3002',
      documentDate: '2026-03-13',
      docId: 'doc-role-coordinator',
      signatures: [],
    }
  );

  const roleLines = textRecords.filter((entry) =>
    ['Судья', 'координатор', 'рекламной паузы'].includes(entry.text)
  );
  expect(roleLines.map((entry) => entry.text)).toEqual([
    'Судья',
    'координатор',
    'рекламной паузы',
  ]);
  expect(roleLines[2]?.x).toBe(roleLines[1]?.x);
  expect(Number(roleLines[2]?.y) - Number(roleLines[1]?.y)).toBeLessThanOrEqual(
    12
  );
  expect(roleLines[0]?.fontSize).toBeGreaterThanOrEqual(8.8);
  expect(textCalls.join('\n')).not.toContain('координатор\n\nрекламной');
});
