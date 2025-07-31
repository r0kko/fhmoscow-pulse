import normativeTicketService from '../services/normativeTicketService.js';
import { sendError } from '../utils/api.js';

export default {
  async approve(req, res) {
    try {
      const result = await normativeTicketService.approve(
        req.params.id,
        req.user.id
      );
      return res.json({ result_id: result.id });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
  async reject(req, res) {
    try {
      await normativeTicketService.reject(req.params.id, req.user.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
