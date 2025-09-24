'use strict';

module.exports = function isCallable(value) {
  if (value == null) return false;
  if (typeof value === 'function') return true;
  if (typeof value !== 'object') return false;
  try {
    return (
      typeof value.call === 'function' && typeof value.apply === 'function'
    );
  } catch (_error) {
    return false;
  }
};
