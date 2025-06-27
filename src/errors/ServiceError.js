export default class ServiceError extends Error {
  constructor(code, status = 400, message) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}
