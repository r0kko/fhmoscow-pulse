import refereeAssignmentService from '../services/refereeAssignmentService.js';
import { sendError } from '../utils/api.js';

export default {
  async listMyDates(req, res) {
    try {
      const data = await refereeAssignmentService.listAssignmentDatesForUser(
        req.user.id
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listMyAssignments(req, res) {
    try {
      const { date } = req.query;
      const data = await refereeAssignmentService.listAssignmentsForUser(
        req.user.id,
        date
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async confirmDayAssignments(req, res) {
    try {
      const data = await refereeAssignmentService.confirmAssignmentsForDate(
        req.body?.date,
        req.user.id
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async getMyMatchDetails(req, res) {
    try {
      const data = await refereeAssignmentService.getMatchDetailsForUser(
        req.params.id,
        req.user.id
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },
};
