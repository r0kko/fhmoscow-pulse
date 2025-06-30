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

  async suggestAddress(req, res) {
    const suggestions = await dadata.suggestAddress(req.body.query);
    return res.json({ suggestions });
  },

  async cleanAddress(req, res) {
    const result = await dadata.cleanAddress(req.body.address);
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

  async findBank(req, res) {
    const bank = await dadata.findBankByBic(req.body.bic);
    return res.json({ bank });
  },

  async findOrganization(req, res) {
    const organization = await dadata.findOrganizationByInn(req.body.inn);
    return res.json({ organization });
  },
};
