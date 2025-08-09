import documentService from '../services/documentService.js';
import { sendError } from '../utils/api.js';

export default {
  async list(_req, res) {
    try {
      const documents = await documentService.listAll();
      res.json({ documents });
    } catch (err) {
      sendError(res, err);
    }
  },
  async downloadConsent(req, res) {
    try {
      const pdf = await documentService.generatePersonalDataConsent(
        req.params.id
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="consent.pdf"'
      );
      return res.end(pdf);
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
