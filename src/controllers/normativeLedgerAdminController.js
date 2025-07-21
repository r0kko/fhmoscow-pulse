import normativeLedgerService from '../services/normativeLedgerService.js';

export default {
  async list(req, res) {
    const { season_id } = req.query;
    const data = await normativeLedgerService.list({ season_id });
    res.json({ ledger: data });
  },
};
