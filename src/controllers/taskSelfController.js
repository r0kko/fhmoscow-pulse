import taskService from '../services/taskService.js';
import taskMapper from '../mappers/taskMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const tasks = await taskService.listByUser(req.user.id);
      return res.json({ tasks: tasks.map(taskMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
