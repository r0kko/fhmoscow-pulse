import courseService from '../services/courseService.js';
import courseMapper from '../mappers/courseMapper.js';

export default {
  async me(req, res) {
    const { course } = await courseService.getUserWithCourse(req.user.id);
    if (course) {
      return res.json({ course: courseMapper.toPublic(course) });
    }
    return res.status(404).json({ error: 'course_not_found' });
  },
};
