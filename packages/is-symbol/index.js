'use strict';

const toStr = Object.prototype.toString;
const hasSymbolToStringTag =
  typeof Symbol === 'function' && typeof Symbol.toStringTag === 'symbol';

module.exports = function isSymbol(value) {
  if (typeof value === 'symbol') return true;
  if (!value) return false;
  if (typeof value !== 'object') return false;
  if (hasSymbolToStringTag) {
    try {
      return typeof value.valueOf() === 'symbol';
    } catch (_error) {
      return false;
    }
  }
  return toStr.call(value) === '[object Symbol]';
};
