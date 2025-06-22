import dadata from '../services/dadataService.js';

export default {
  async suggestFio(req, res) {
    const suggestions = await dadata.suggestFio(req.body.query);
    return res.json({ suggestions });
  },

  async cleanFio(req, res) {
    const result = await dadata.cleanFio(req.body.fio);
    return res.json({ result });
  },
};
