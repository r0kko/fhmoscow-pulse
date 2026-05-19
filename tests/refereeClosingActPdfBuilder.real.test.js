import { expect, test } from '@jest/globals';
import { PDFDocument as PdfDocument } from 'pdf-lib';

import buildRefereeClosingActPdf from '../src/services/docBuilders/refereeClosingAct.js';

const customer = {
  name: 'РОО "Федерация хоккея Москвы"',
  short_name: 'ФХМ',
  inn: '7708046206',
  kpp: '770101001',
  address: '101000, Москва, Кривоколенный переулок, д. 9',
};

const performer = {
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
    address: '117997, Москва, ул. Вавилова, д. 19',
  },
};

const contract = {
  number: '26.03/1024',
  document_date: '2026-03-12',
};

function makeItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    line_no: index + 1,
    service_datetime: `0${(index % 8) + 1}.03.2026, ${String(
      10 + (index % 10)
    ).padStart(2, '0')}:00`,
    match_label: `ХК Молния ${index + 1} - ХК Иремель ${index + 2}`,
    competition_name: 'Первенство Москвы',
    role_name: index % 3 === 0 ? 'Судья при оштрафованных' : 'Главный судья',
    tariff_label: 'RPOT',
    amount_rub: '2900.00',
    total_amount_rub: '2900.00',
  }));
}

function makePayload(itemsCount) {
  return {
    customer,
    performer,
    contract,
    totals: {
      total_amount_rub: String(itemsCount * 2900),
      total_amount_words: 'Пять тысяч восемьсот рублей 00 копеек',
      vat_label: 'Без налога (НДС)',
      items_count: itemsCount,
    },
    items: makeItems(itemsCount),
    fhmo_signer: {
      full_name: 'Дробот Алексей Андреевич',
      position: 'Ведущий специалист по судейству',
      department: 'РОО',
      organization: 'Федерация хоккея Москвы',
    },
  };
}

async function pageCount(buffer) {
  const pdf = await PdfDocument.load(buffer);
  return pdf.getPageCount();
}

test('real closing act draft with five rows fits on one page', async () => {
  const buffer = await buildRefereeClosingActPdf(makePayload(5), {
    number: '26.03/1100',
    documentDate: '2026-03-12',
    docId: 'doc-draft-five',
    signatures: [],
  });

  expect(await pageCount(buffer)).toBe(1);
});

test('real closing act draft with eight rows avoids orphan final page', async () => {
  const buffer = await buildRefereeClosingActPdf(makePayload(8), {
    number: '26.03/1101',
    documentDate: '2026-03-12',
    docId: 'doc-draft-eight',
    signatures: [],
  });

  expect(await pageCount(buffer)).toBeLessThanOrEqual(2);
});

test('real signed closing act keeps signatures in the document flow', async () => {
  const buffer = await buildRefereeClosingActPdf(makePayload(5), {
    number: '26.03/1102',
    documentDate: '2026-03-12',
    docId: 'doc-signed-five',
    signatures: [
      {
        party: 'FHMO',
        sign_id: 'sign-fhmo',
        user_id: 'user-fhmo',
        created_at: '2026-03-13T10:00:00.000Z',
        full_name: 'Дробот Алексей Андреевич',
        position: 'Ведущий специалист по судейству',
        department: 'РОО',
        organization: 'Федерация хоккея Москвы',
      },
      {
        party: 'REFEREE',
        sign_id: 'sign-referee',
        user_id: 'user-referee',
        created_at: '2026-03-13T12:35:00.000Z',
        full_name: 'Тестов Никита Анатольевич',
      },
    ],
  });

  expect(await pageCount(buffer)).toBeLessThanOrEqual(2);
});

test('real long closing act remains multi-page', async () => {
  const buffer = await buildRefereeClosingActPdf(makePayload(32), {
    number: '26.03/1103',
    documentDate: '2026-03-12',
    docId: 'doc-long',
    signatures: [],
  });

  expect(await pageCount(buffer)).toBeGreaterThan(1);
});
