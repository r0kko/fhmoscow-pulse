'use strict';

const toString = Object.prototype.toString;

module.exports = function isDateObject(value) {
  if (value == null) return false;
  if (typeof value === 'object' || typeof value === 'function') {
    try {
      if (toString.call(value) !== '[object Date]') return false;
      if (typeof value.getTime !== 'function') return false;
      return !Number.isNaN(value.getTime());
    } catch (_error) {
      return false;
    }
  }
  return false;
};
