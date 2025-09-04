import { expect, test } from '@jest/globals';
import { renderTrainingInvitationEmail } from '../src/templates/trainingInvitationEmail.js';
import { renderTrainingRegistrationEmail } from '../src/templates/trainingRegistrationEmail.js';
import { renderTrainingRoleChangedEmail } from '../src/templates/trainingRoleChangedEmail.js';
import { renderTrainingRegistrationCancelledEmail } from '../src/templates/trainingRegistrationCancelledEmail.js';
import { renderTrainingRegistrationSelfCancelledEmail } from '../src/templates/trainingRegistrationSelfCancelledEmail.js';

const training = {
  start_at: '2025-06-01T10:00:00Z',
  TrainingType: { name: 'Семинар', for_camp: false, online: false },
  Ground: { Address: { result: 'Адрес' }, yandex_url: 'http://maps' },
};

test('training invitation renders location variants', () => {
  const inv1 = renderTrainingInvitationEmail(training);
  expect(inv1.subject).toContain('Приглашение');
  const inv2 = renderTrainingInvitationEmail({
    ...training,
    TrainingType: { online: true },
    url: 'http://meet',
  });
  expect(inv2.text).toContain('Онлайн по ссылке');
});

test('registration/role emails render admin/user variants', () => {
  const reg1 = renderTrainingRegistrationEmail(
    training,
    { name: 'Участник' },
    true
  );
  const reg2 = renderTrainingRegistrationEmail(training, null, false);
  expect(reg1.text).toContain('Администратор записал вас');
  expect(reg2.text).toContain('Вы успешно записались');
  const role1 = renderTrainingRoleChangedEmail(
    training,
    { alias: 'Teacher' },
    true
  );
  const role2 = renderTrainingRoleChangedEmail(training, null, false);
  expect(role1.text).toContain('Администратор изменил вашу роль');
  expect(role2.text).toContain('Вы изменили свою роль');
});

test('cancellation emails', () => {
  const c1 = renderTrainingRegistrationCancelledEmail(training);
  const c2 = renderTrainingRegistrationSelfCancelledEmail(training);
  expect(c1.subject).toContain('отменена');
  expect(c2.subject).toContain('отменена');
});
