import documentService from '../services/documentService.js';
import userDocumentMapper from '../mappers/userDocumentMapper.js';

export default {
  async list(req, res) {
    const docs = await documentService.listByUser(req.user.id);
    return res.json({ documents: userDocumentMapper.toPublicArray(docs) });
  },
};
