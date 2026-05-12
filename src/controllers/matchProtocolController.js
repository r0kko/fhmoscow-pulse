import matchProtocolService from '../services/matchProtocolService.js';
import { sendError } from '../utils/api.js';
import {
  ensureParticipantOrThrow,
  resolveMatchAccessContext,
} from '../utils/matchAccess.js';

function buildAttachmentDisposition(filename) {
  const raw = String(filename || 'match-protocol.pdf')
    .replace(/[\r\n]/g, ' ')
    .replace(/"/g, String.fromCharCode(39));
  const asciiFallback =
    raw
      .replace(/[^\x20-\x7E]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'match-protocol.pdf';
  const encoded = encodeURIComponent(raw)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

const controller = {
  async download(req, res) {
    try {
      const context = await resolveMatchAccessContext({
        matchOrId: req.params.id,
        userId: req.user?.id || null,
      });
      if (!context.isAdmin) ensureParticipantOrThrow(context);
      const result = await matchProtocolService.downloadMatchProtocol(
        req.params.id,
        req.user?.id || null,
        req.id || null
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        buildAttachmentDisposition(result.filename)
      );
      return res.end(result.buffer);
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};

export default controller;
