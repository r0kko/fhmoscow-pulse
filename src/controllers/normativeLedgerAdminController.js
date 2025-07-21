import normativeLedgerService from '../services/normativeLedgerService.js';

export default {
  async list(req, res) {
    const { season_id, page = '1', limit = '20' } = req.query;
    const { judges, groups, total } = await normativeLedgerService.list({
      season_id,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    res.json({ ledger: { judges, groups }, total });
  },
};
