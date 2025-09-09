import documentContractService from '../services/documentContractService.js';
import documentService from '../services/documentService.js';
import { sendError } from '../utils/api.js';

export default {
  async listJudges(_req, res) {
    try {
      const judges = await documentContractService.listJudges();
      return res.json({ judges });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async precheck(req, res) {
    try {
      const data = await documentContractService.precheck(req.params.id);
      if (!data) return res.status(404).json({ error: 'user_not_found' });
      return res.json({ precheck: data });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async generateApplication(req, res) {
    try {
      // Server-side guard: ensure basic checks still pass at the moment of generation
      const pre = await documentContractService.precheck(req.params.id);
      if (!pre) return res.status(404).json({ error: 'user_not_found' });
      const c = pre.checks || {};
      if (
        !(
          c.ageOk &&
          c.simpleESign?.has &&
          c.taxation?.isNotPerson &&
          c.documents?.all
        )
      ) {
        return res.status(400).json({ error: 'precheck_failed', details: pre });
      }

      const result = await documentService.createContractApplicationDocument(
        req.params.id,
        req.user.id
      );
      return res.json(result);
    } catch (err) {
      return sendError(res, err);
    }
  },
};
