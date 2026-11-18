/**
 * errors.js — the one error type the generator throws: a code the caller can
 * branch on, a message fit to show a person, and an HTTP-style status.
 * (`isTagError` lets an app treat these like its own errors without importing
 * this class.)
 */
export class TagError extends Error {
  constructor(code, message, status = 400, extra = {}) {
    super(message);
    this.name = 'TagError';
    this.code = code;
    this.status = status;
    this.isTagError = true;
    Object.assign(this, extra);
  }
}
