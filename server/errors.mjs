/** Error carrying an API code. Sent as HTTP 400 {ok:false,code,message}. */
export class ApiError extends Error {
  constructor(code, message, status = 400) {
    super(message ?? code);
    this.code = code;
    this.status = status;
  }
}

/** Map a thrown error to {status, body}. core.* rule errors use errcode P0001. */
export function toResponse(err) {
  if (err instanceof ApiError) {
    return { status: err.status, body: { ok: false, code: err.code, message: err.message } };
  }
  if (err && err.code === 'P0001') {
    return { status: 400, body: { ok: false, code: err.message, message: err.message } };
  }
  console.error(err);
  return { status: 500, body: { ok: false, code: 'SERVER_ERROR', message: 'Something went wrong.' } };
}
