import asyncJobService from '../services/asyncJobService.js';
import { sendError } from '../utils/api.js';

const controller = {
  async getJob(req, res) {
    try {
      const data = await asyncJobService.getAsyncJob(req.params.jobId);
      return res.json(data);
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async listItems(req, res) {
    try {
      const data = await asyncJobService.listAsyncJobItems(
        req.params.jobId,
        req.query
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async retryFailed(req, res) {
    try {
      const data = await asyncJobService.retryFailedAsyncJob(
        req.params.jobId,
        req.user?.id
      );
      return res.status(202).json(data);
    } catch (err) {
      return sendError(res, err, 409);
    }
  },

  async cancel(req, res) {
    try {
      const data = await asyncJobService.cancelAsyncJob(
        req.params.jobId,
        req.user?.id
      );
      return res.status(202).json(data);
    } catch (err) {
      return sendError(res, err, 409);
    }
  },
};

export default controller;
