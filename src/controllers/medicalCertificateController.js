import medicalCertificateService from '../services/medicalCertificateService.js';
import medicalCertificateMapper from '../mappers/medicalCertificateMapper.js';

export default {
  async me(req, res) {
    const cert = await medicalCertificateService.getByUser(req.user.id);
    if (cert) {
      return res.json({ certificate: medicalCertificateMapper.toPublic(cert) });
    }
    return res.status(404).json({ error: 'certificate_not_found' });
  },

  async history(req, res) {
    const list = await medicalCertificateService.listByUser(req.user.id);
    return res.json({
      certificates: list.map(medicalCertificateMapper.toPublic),
    });
  },
};
