import fileService from '../services/fileService.js';
import fileMapper from '../mappers/fileMapper.js';
import medicalCertificateService from '../services/medicalCertificateService.js';
import { sendError } from '../utils/api.js';
import { hasAdminRole } from '../utils/roles.js';

async function isAdmin(user) {
  const roles = await user.getRoles();
  return hasAdminRole(roles);
}

async function list(req, res) {
  try {
    const cert = await medicalCertificateService.getById(req.params.id);
    const admin = await isAdmin(req.user);
    if (cert.user_id !== req.user.id && !admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
    const files = await fileService.listForCertificate(cert.id);
    const result = [];
    for (const f of files) {
      const url = await fileService.getDownloadUrl(f.File);
      result.push(fileMapper.toPublic(f, url));
    }
    return res.json({ files: result });
  } catch (err) {
    return sendError(res, err, 404);
  }
}

async function listMe(req, res) {
  const cert = await medicalCertificateService.getByUser(req.user.id);
  if (!cert) return res.status(404).json({ error: 'certificate_not_found' });
  req.params.id = cert.id;
  return list(req, res);
}

async function upload(req, res) {
  try {
    const attachment = await fileService.uploadForCertificate(
      req.params.id,
      req.file,
      req.body.type,
      req.user.id
    );
    const url = await fileService.getDownloadUrl(attachment.File);
    return res.status(201).json({ file: fileMapper.toPublic(attachment, url) });
  } catch (err) {
    return sendError(res, err, 400);
  }
}

async function remove(req, res) {
  try {
    const cert = await medicalCertificateService.getById(req.params.id);
    const admin = await isAdmin(req.user);
    if (cert.user_id !== req.user.id && !admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
    await fileService.remove(req.params.fileId, req.user.id);
    return res.status(204).send();
  } catch (err) {
    return sendError(res, err, 400);
  }
}

export default { listMe, list, upload, remove };
