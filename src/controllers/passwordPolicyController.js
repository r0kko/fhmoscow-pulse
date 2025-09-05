import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_PATTERN_STR,
} from '../config/auth.js';

export default {
  async get(req, res) {
    return res.json({
      min_length: PASSWORD_MIN_LENGTH,
      max_length: PASSWORD_MAX_LENGTH,
      requires: ['letters', 'digits', 'no_whitespace'],
      recommends: ['uppercase', 'special_characters', 'length>=12'],
      banned_examples: [
        'password',
        '12345678',
        'qwerty',
        'qwerty123',
        '111111',
      ],
      pattern: PASSWORD_PATTERN_STR,
    });
  },
};
