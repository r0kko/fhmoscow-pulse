import accountingService from '../services/refereeAccountingService.js';
import map from '../mappers/refereeAccountingMapper.js';
import ServiceError from '../errors/ServiceError.js';
import { sendError } from '../utils/api.js';

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return defaultValue;
}

function csvEscape(value) {
  if (value == null) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function actionAccrual(req, res) {
  try {
    const actionAlias = req.body?.action_alias;
    const comment = req.body?.comment;
    const data = await accountingService.applyRefereeAccrualAction(
      req.params.id,
      actionAlias,
      req.user?.id,
      comment
    );
    return res.json({
      document: map.toPublicAccrualDocument(data.document),
      audit_events: (data.audit_events || []).map(map.toPublicAuditEvent),
    });
  } catch (err) {
    return sendError(res, err, 404);
  }
}

const controller = {
  async getRefData(_req, res) {
    try {
      const data = await accountingService.getAccountingRefData();
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async getTournamentPaymentsDashboard(req, res) {
    try {
      const data = await accountingService.getTournamentPaymentsDashboard({
        tournamentId: req.params.tournamentId,
        onDate: req.query?.on_date,
      });
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listTournamentTariffs(req, res) {
    try {
      const {
        page = '1',
        limit = '100',
        fare_code,
        stage_group_id,
        referee_role_id,
        status,
        on_date,
      } = req.query;
      const data = await accountingService.listRefereeTariffRules({
        tournamentId: req.params.tournamentId,
        page: Number.parseInt(page, 10),
        limit: Number.parseInt(limit, 10),
        fareCode: fare_code,
        stageGroupId: stage_group_id,
        refereeRoleId: referee_role_id,
        status,
        onDate: on_date,
      });
      return res.json({
        tariff_rules: data.rows.map(map.toPublicTariffRule),
        total: data.count,
        page: data.page,
        limit: data.limit,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async createTournamentTariff(req, res) {
    try {
      const created = await accountingService.createRefereeTariffRule(
        req.params.tournamentId,
        req.body,
        req.user?.id
      );
      return res
        .status(201)
        .json({ tariff_rule: map.toPublicTariffRule(created) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async updateTournamentTariff(req, res) {
    try {
      const updated = await accountingService.updateRefereeTariffRule(
        req.params.tournamentId,
        req.params.id,
        req.body,
        req.user?.id
      );
      if (updated?.deleted) {
        return res.json(updated);
      }
      return res.json({ tariff_rule: map.toPublicTariffRule(updated) });
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async fileTournamentTariff(req, res) {
    try {
      const updated = await accountingService.fileRefereeTariffRule(
        req.params.tournamentId,
        req.params.id,
        req.user?.id
      );
      return res.json({ tariff_rule: map.toPublicTariffRule(updated) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async retireTournamentTariff(req, res) {
    try {
      const updated = await accountingService.retireRefereeTariffRule(
        req.params.tournamentId,
        req.params.id,
        req.user?.id
      );
      if (updated?.deleted) {
        return res.json(updated);
      }
      return res.json({ tariff_rule: map.toPublicTariffRule(updated) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async activateTournamentTariff(req, res) {
    try {
      const updated = await accountingService.activateRefereeTariffRule(
        req.params.tournamentId,
        req.params.id,
        req.user?.id
      );
      return res.json({ tariff_rule: map.toPublicTariffRule(updated) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async listGroundTravelRates(req, res) {
    try {
      const { page = '1', limit = '100', status, on_date } = req.query;
      const data = await accountingService.listGroundTravelRates({
        groundId: req.params.id,
        page: Number.parseInt(page, 10),
        limit: Number.parseInt(limit, 10),
        status,
        onDate: on_date,
      });
      return res.json({
        travel_rates: data.rows.map(map.toPublicTravelRate),
        total: data.count,
        page: data.page,
        limit: data.limit,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async createGroundTravelRate(req, res) {
    try {
      const created = await accountingService.createGroundTravelRate(
        req.params.id,
        req.body,
        req.user?.id
      );
      return res
        .status(201)
        .json({ travel_rate: map.toPublicTravelRate(created) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async updateGroundTravelRate(req, res) {
    try {
      const updated = await accountingService.updateGroundTravelRate(
        req.params.id,
        req.params.rateId,
        req.body,
        req.user?.id
      );
      if (updated?.deleted) {
        return res.json(updated);
      }
      return res.json({ travel_rate: map.toPublicTravelRate(updated) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async generateTournamentAccruals(req, res) {
    try {
      const data = await accountingService.generateAccruals({
        tournamentId: req.params.tournamentId,
        fromDate: req.body?.from_date,
        toDate: req.body?.to_date,
        apply: parseBoolean(req.body?.apply, false),
        source: 'MANUAL',
        actorId: req.user?.id,
      });
      return res.json({
        ...data,
        accruals: (data.accruals || []).map((item) =>
          item?.id ? map.toPublicAccrualDocument(item) : item
        ),
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listTournamentAccruals(req, res) {
    try {
      const {
        page = '1',
        limit = '50',
        status,
        source,
        number,
        fare_code,
        referee_role_id,
        stage_group_id,
        ground_id,
        date_from,
        date_to,
        amount_from,
        amount_to,
        search,
      } = req.query;

      const data = await accountingService.listRefereeAccrualDocuments({
        tournamentId: req.params.tournamentId,
        page: Number.parseInt(page, 10),
        limit: Number.parseInt(limit, 10),
        status,
        source,
        number,
        fareCode: fare_code,
        refereeRoleId: referee_role_id,
        stageGroupId: stage_group_id,
        groundId: ground_id,
        dateFrom: date_from,
        dateTo: date_to,
        amountFrom: amount_from,
        amountTo: amount_to,
        search,
      });

      return res.json({
        accruals: data.rows.map(map.toPublicAccrualDocument),
        total: data.count,
        page: data.page,
        limit: data.limit,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async getTournamentAccrualDocument(req, res) {
    try {
      const data = await accountingService.getRefereeAccrualDocument(
        req.params.id
      );
      if (
        String(data?.document?.tournament_id || '') !==
        String(req.params.tournamentId || '')
      ) {
        throw new ServiceError('accrual_document_not_found', 404);
      }
      return res.json({
        document: map.toPublicAccrualDocument(data.document),
        audit_events: (data.audit_events || []).map(map.toPublicAuditEvent),
      });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async listGlobalAccruals(req, res) {
    try {
      const {
        page = '1',
        limit = '50',
        tournament_id,
        status,
        source,
        number,
        fare_code,
        referee_role_id,
        stage_group_id,
        ground_id,
        date_from,
        date_to,
        amount_from,
        amount_to,
        search,
      } = req.query;

      const data = await accountingService.listRefereeAccrualDocuments({
        tournamentId: tournament_id || null,
        page: Number.parseInt(page, 10),
        limit: Number.parseInt(limit, 10),
        status,
        source,
        number,
        fareCode: fare_code,
        refereeRoleId: referee_role_id,
        stageGroupId: stage_group_id,
        groundId: ground_id,
        dateFrom: date_from,
        dateTo: date_to,
        amountFrom: amount_from,
        amountTo: amount_to,
        search,
      });

      return res.json({
        accruals: data.rows.map(map.toPublicAccrualDocument),
        total: data.count,
        page: data.page,
        limit: data.limit,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async getAccrualDocument(req, res) {
    try {
      const data = await accountingService.getRefereeAccrualDocument(
        req.params.id
      );
      return res.json({
        document: map.toPublicAccrualDocument(data.document),
        audit_events: (data.audit_events || []).map(map.toPublicAuditEvent),
      });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  actionAccrual,

  async bulkAccrualAction(req, res) {
    try {
      const data = await accountingService.applyRefereeAccrualActionBulk({
        ids: req.body?.ids,
        actionAlias: req.body?.action_alias,
        actorId: req.user?.id,
        comment: req.body?.comment,
      });
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async deleteAccrual(req, res) {
    try {
      const data = await accountingService.deleteRefereeAccrualDocument(
        req.params.id,
        req.body,
        req.user?.id
      );
      return res.json({
        document: map.toPublicAccrualDocument(data.document),
        audit_events: (data.audit_events || []).map(map.toPublicAuditEvent),
      });
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async bulkDeleteAccruals(req, res) {
    try {
      const data = await accountingService.bulkDeleteRefereeAccrualDocuments({
        ids: req.body?.ids,
        reasonCode: req.body?.reason_code,
        comment: req.body?.comment,
        actorId: req.user?.id,
      });
      return res.json(data);
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async reviewAccrual(req, res) {
    return res.status(410).json({ error: 'accrual_legacy_action_deprecated' });
  },

  async approveAccrual(req, res) {
    req.body = { ...(req.body || {}), action_alias: 'APPROVE' };
    return actionAccrual(req, res);
  },

  async postAccrual(req, res) {
    return res.status(410).json({ error: 'accrual_legacy_action_deprecated' });
  },

  async voidAccrual(req, res) {
    return res.status(410).json({ error: 'accrual_legacy_action_deprecated' });
  },

  async adjustAccrual(req, res) {
    try {
      const data = await accountingService.createRefereeAccrualAdjustment(
        req.params.id,
        req.body,
        req.user?.id
      );
      return res.json({
        document: map.toPublicAccrualDocument(data.document),
        audit_events: (data.audit_events || []).map(map.toPublicAuditEvent),
      });
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async exportAccrualsCsv(req, res) {
    try {
      const {
        tournament_id,
        status,
        source,
        number,
        fare_code,
        referee_role_id,
        stage_group_id,
        ground_id,
        date_from,
        date_to,
        amount_from,
        amount_to,
        search,
      } = req.query;
      const payload = await accountingService.exportRefereeAccrualsCsv({
        tournamentId: tournament_id || null,
        status,
        source,
        number,
        fareCode: fare_code,
        refereeRoleId: referee_role_id,
        stageGroupId: stage_group_id,
        groundId: ground_id,
        dateFrom: date_from,
        dateTo: date_to,
        amountFrom: amount_from,
        amountTo: amount_to,
        search,
        limit: 5000,
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="referee-accruals-rub.csv"'
      );
      const lines = [payload.headers.map(csvEscape).join(',')];
      for (const row of payload.rows) {
        lines.push(row.map(csvEscape).join(','));
      }
      return res.send(lines.join('\n'));
    } catch (err) {
      return sendError(res, err);
    }
  },
};

export default controller;
