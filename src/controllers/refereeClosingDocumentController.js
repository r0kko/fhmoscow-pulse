import closingService from '../services/refereeClosingDocumentService.js';
import { sendError } from '../utils/api.js';

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
      return res.status(201).json({
        documents: data.rows,
        total: data.total,
      });
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
        req.user?.id
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err, 409);
    }
  },

  async sendClosingDocumentsBatch(req, res) {
    try {
      const data = await closingService.sendClosingDocumentsBatch(
        req.params.tournamentId,
        req.body,
        req.user?.id
      );
      return res.json(data);
    } catch (err) {
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
