// Live progress for long requests. When the client sends `?stream=1`, the response is
// NDJSON: one {"type":"progress",...} line per step as it happens, then a final
// {"type":"result",...} or {"type":"error",...} line. Without it, the route answers with
// plain JSON as before.
//
//   await respond(req, res, 201, (onProgress) => doWork(onProgress));

export const wantsStream = (req) => req.query.stream === '1';

export async function respond(req, res, status, work) {
  if (!wantsStream(req)) {
    res.status(status).json(await work(() => {}));
    return;
  }

  res.status(200);
  res.set({ 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache', 'x-accel-buffering': 'no' });
  res.flushHeaders();
  const send = (line) => {
    if (!res.writableEnded) res.write(`${JSON.stringify(line)}\n`);
  };
  try {
    const result = await work((stage, state, detail = {}) => send({ type: 'progress', stage, status: state, detail, at: Date.now() }));
    send({ type: 'result', status, ...result });
  } catch (error) {
    // Headers are already sent, so errors travel in the stream with the status they'd have had.
    if ((error.status ?? 500) >= 500) console.error(error);
    send({ type: 'error', status: error.status ?? 500, error: error.message || 'Internal server error' });
  } finally {
    res.end();
  }
}
