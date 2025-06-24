import dadata from '../services/dadataService.js';

export default {
  async suggestFio(req, res) {
    const suggestions = await dadata.suggestFio(req.body.query, req.body.parts);
    return res.json({ suggestions });
  },

  async cleanFio(req, res) {
    const result = await dadata.cleanFio(req.body.fio);
    return res.json({ result });
  },

  async suggestFmsUnit(req, res) {
    const suggestions = await dadata.suggestFmsUnit(
      req.body.query,
      req.body.filters
    );
    return res.json({ suggestions });
  },

  async cleanPassport(req, res) {
    const result = await dadata.cleanPassport(req.body.passport);
    return res.json({ result });
  },
};
