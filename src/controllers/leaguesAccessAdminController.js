import leaguesAccessService from '../services/leaguesAccessService.js';
import { sendError } from '../utils/api.js';

export default {
  async getCurrentMeta(req, res) {
    try {
      const { competition_alias, season_id, season_mode, competition_type_id } =
        req.query;
      const data = await leaguesAccessService.getCurrentMeta({
        seasonId: season_id || null,
        seasonMode: season_mode || 'current',
        competitionTypeId: competition_type_id || null,
        competitionAlias: competition_alias || 'PRO',
      });
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async list(req, res) {
    try {
      const { competition_alias, season_id, season_mode, competition_type_id } =
        req.query;
      const data = await leaguesAccessService.listAccesses({
        search: req.query.search || '',
        seasonId: season_id || null,
        seasonMode: season_mode || 'current',
        competitionTypeId: competition_type_id || null,
        competitionAlias: competition_alias || 'PRO',
      });
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listCandidates(req, res) {
    try {
      const { competition_alias, season_id, season_mode, competition_type_id } =
        req.query;
      const data = await leaguesAccessService.listCandidates({
        search: req.query.search || '',
        seasonId: season_id || null,
        seasonMode: season_mode || 'current',
        competitionTypeId: competition_type_id || null,
        competitionAlias: competition_alias || 'PRO',
      });
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async grant(req, res) {
    try {
      const data = await leaguesAccessService.grantAccess(
        req.body,
        req.user.id
      );
      return res.json({ access: data });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async revoke(req, res) {
    try {
      await leaguesAccessService.revokeAccess(req.params.id, req.user.id);
      return res.json({ ok: true });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
