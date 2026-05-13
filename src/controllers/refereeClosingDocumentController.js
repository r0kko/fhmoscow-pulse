import logger from '../../logger.js';
import closingService from '../services/refereeClosingDocumentService.js';
import { sendError } from '../utils/api.js';

function logClosingSendError(stage, req, err) {
  const payload = {
    stage,
    requestId: req.id || null,
    tournamentId: req.params?.tournamentId || null,
    closingDocumentId: req.params?.id || null,
    actorId: req.user?.id || null,
    code: err?.code || err?.message || 'closing_document_send_failed',
    message: err?.message || '',
  };
  const status = Number(err?.status || err?.statusCode || 500);
  logger[status >= 500 ? 'error' : 'warn'](
    'Referee closing document send request failed',
    payload
  );
}

const controller = {
  async listClosingTournaments(req, res) {
    try {
      const { page = '1', limit = '20', search = '' } = req.query;
      const data = await closingService.listClosingTournaments({
        page: Number.parseInt(page, 10),
        limit: Number.parseInt(limit, 10),
        search,
      });
      return res.json({
        tournaments: data.rows,
        total: data.total,
        page: data.page,
        limit: data.limit,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async getTournamentClosingProfile(req, res) {
    try {
      const data = await closingService.getTournamentClosingProfile(
        req.params.tournamentId
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async updateTournamentClosingProfile(req, res) {
    try {
      const data = await closingService.updateTournamentClosingProfile(
        req.params.tournamentId,
        req.body,
        req.user?.id
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async previewClosingDocuments(req, res) {
    try {
      const data = await closingService.previewClosingDocuments(
        req.params.tournamentId,
        req.body
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async createClosingDocuments(req, res) {
    try {
      const data = await closingService.createClosingDocuments(
        req.params.tournamentId,
        req.body,
        req.user?.id
      );
      return res.status(202).json(data);
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async listClosingDocuments(req, res) {
    try {
      const { page = '1', limit = '20', status = '', search = '' } = req.query;
      const data = await closingService.listClosingDocuments(
        req.params.tournamentId,
        {
          page: Number.parseInt(page, 10),
          limit: Number.parseInt(limit, 10),
          status,
          search,
        }
      );
      return res.json({
        documents: data.rows,
        total: data.total,
        page: data.page,
        limit: data.limit,
        summary: data.summary,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async getClosingDocument(req, res) {
    try {
      const data = await closingService.getClosingDocument(
        req.params.tournamentId,
        req.params.id
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async sendClosingDocument(req, res) {
    try {
      const data = await closingService.sendClosingDocument(
        req.params.tournamentId,
        req.params.id,
        req.user?.id,
        { requestId: req.id || null }
      );
      return res.status(202).json(data);
    } catch (err) {
      logClosingSendError('single_send', req, err);
      return sendError(res, err, 409);
    }
  },

  async sendClosingDocumentsBatch(req, res) {
    try {
      const data = await closingService.sendClosingDocumentsBatch(
        req.params.tournamentId,
        req.body,
        req.user?.id,
        { requestId: req.id || null }
      );
      return res.status(202).json(data);
    } catch (err) {
      logClosingSendError('batch_send', req, err);
      return sendError(res, err, 409);
    }
  },

  async cancelClosingDocument(req, res) {
    try {
      const data = await closingService.cancelClosingDocument(
        req.params.tournamentId,
        req.params.id,
        req.user?.id
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err, 409);
    }
  },

  async deleteClosingDocument(req, res) {
    try {
      const data = await closingService.deleteClosingDocument(
        req.params.tournamentId,
        req.params.id,
        req.user?.id
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err, 409);
    }
  },
};

export default controller;
