import PDFDocument from 'pdfkit';

import { User, Sex } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

function formatDate(str) {
  if (!str) return '';
  const [year, month, day] = str.split('-');
  return `${day}.${month}.${year}`;
}

async function generatePersonalDataConsent(userId) {
  const user = await User.findByPk(userId, { include: [Sex] });
  if (!user) throw new ServiceError('user_not_found', 404);
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  doc.registerFont('DejaVu', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
  doc.font('DejaVu');
  doc
    .fontSize(14)
    .text('Согласие на обработку персональных данных', { align: 'center' });
  doc.moveDown();
  const fullName = [user.last_name, user.first_name, user.patronymic]
    .filter(Boolean)
    .join(' ');
  doc
    .fontSize(12)
    .text(
      `Я, ${fullName}, ${formatDate(
        user.birth_date
      )} года рождения, даю согласие Федерации хоккея Москвы на обработку моих персональных данных в соответствии с законодательством Российской Федерации.`
    );
  doc.moveDown();
  doc.text('Подпись: ______________________', { align: 'right' });
  doc.moveDown();
  doc.text('Дата: ______________________', { align: 'right' });

  const chunks = [];
  return new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export default { generatePersonalDataConsent };
