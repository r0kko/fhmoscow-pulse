import cron from 'node-cron';
import { literal } from 'sequelize';

import { User, Inn, Taxation } from '../models/index.js';
import taxationService from '../services/taxationService.js';
import logger from '../../logger.js';

let running = false;

export async function runTaxationCheck() {
  if (running) return;
  running = true;
  try {
    const user = await User.findOne({
      include: [
        { model: Inn, required: true, attributes: ['number', 'created_at'] },
        { model: Taxation, required: false, attributes: ['check_date'] },
      ],
      order: [
        [literal('"Taxation"."check_date" IS NULL'), 'DESC'],
        [Taxation, 'check_date', 'ASC'],
        [Inn, 'created_at', 'ASC'],
      ],
    });

    if (user?.Inn?.number) {
      const data = await taxationService.fetchByInn(user.Inn.number);
      const { dadata, fns } = data.statuses || {};
      const dadataOk = dadata >= 200 && dadata < 300;
      const fnsOk = fns >= 200 && fns < 300;
      if (dadataOk && fnsOk) {
        await taxationService.updateByInn(user.id, user.Inn.number, null, data);
        logger.info(`Taxation cron updated user ${user.id}`);
      } else {
        logger.warn(
          'Taxation cron skipped user %s due to API failure %o',
          user.id,
          data.statuses
        );
      }
    } else {
      logger.debug('Taxation cron: no users to update');
    }
  } catch (err) {
    logger.error('Taxation cron failed: %s', err.stack || err);
  } finally {
    running = false;
  }
}

export default function startTaxationCron() {
  cron.schedule('*/4 * * * *', runTaxationCheck);
}
