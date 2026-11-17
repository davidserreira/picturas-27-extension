// Media uploads through the gateway (Phase 2, ADR-01,
// Docs/fase2/adr/ADR-01-carregamento-em-fluxo.md).
//
// The gateway used to read the whole file into memory (multer) before checking
// the JWT, and then sent a second copy to the projects service with axios. Now
// the JWT is checked first and the multipart body is passed on to projects
// unchanged, as it arrives, so the gateway holds only stream buffers.
//
// What the client sees does not change: the answer is sent only once the
// client has sent the whole body (as when the gateway read it all first), with
// the status codes and bodies that forwardAxiosError produced.
const https = require("https");

// Runs `fn` once the client has sent the whole request body; whatever is still
// on its way is read and dropped. If the client goes away, `fn` never runs.
function afterBody(req, fn) {
  if (req.complete) return fn();
  req.once("end", fn);
  req.resume();
}

// Runs a middleware that may answer by itself (auth.checkToken, which answers
// with res.status(...).jsonp(...)) and holds that answer until the body is in.
function answerAfterBody(middleware) {
  return (req, res, next) => {
    const held = {
      code: 200,
      status(code) { this.code = code; return this; },
      jsonp(body) {
        afterBody(req, () => res.status(this.code).jsonp(body));
        return this;
      },
    };
    middleware(req, held, next);
  };
}

// Same answer as forwardAxiosError in routes/projects.js.
function sendError(res, status, data, version) {
  if (version) res.set("X-Project-Version", version);
  console.error("[API-GW]", status, "mensagem fallback", { data });
  return res.status(status).jsonp(data);
}

// axios parsed every answer body as JSON when it could (forcedJSONParsing).
function parseBody(buffer) {
  const text = buffer.toString();
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

// Express handler that streams POST /:user/:project/<endpoint> to projects.
function streamToProjects({ projectsURL, agent, endpoint }) {
  return function (req, res) {
    const ownerId = req.query.owner || req.params.user;
    const callerId = req.authUserId || req.params.user;
    const share = req.query.share ? `?share=${encodeURIComponent(req.query.share)}` : "";

    const headers = {
      "Content-Type": req.headers["content-type"],
      Authorization: req.headers["authorization"],
      "X-Project-Version": req.headers["x-project-version"],
      "X-Caller-Id": callerId,
    };
    // Without a length the body goes chunked, as Node does by default.
    if (req.headers["content-length"]) headers["Content-Length"] = req.headers["content-length"];
    for (const k of Object.keys(headers)) if (headers[k] === undefined) delete headers[k];

    let settled = false;
    const upstream = https.request(projectsURL + `${ownerId}/${req.params.project}/${endpoint}${share}`, {
      method: "POST",
      agent,
      headers,
    });

    upstream.on("response", (answer) => {
      const chunks = [];
      answer.on("data", (c) => chunks.push(c));
      answer.on("end", () => {
        if (settled) return;
        settled = true;
        // projects may answer before reading the whole body (428, 404, ...).
        req.unpipe(upstream);
        if (!upstream.writableFinished) upstream.destroy();
        const version = answer.headers["x-project-version"];
        afterBody(req, () => {
          if (answer.statusCode >= 200 && answer.statusCode < 300) {
            if (version) res.set("X-Project-Version", version);
            return res.sendStatus(204);
          }
          return sendError(res, answer.statusCode, parseBody(Buffer.concat(chunks)) || "mensagem fallback", version);
        });
      });
    });

    upstream.on("error", (err) => {
      if (settled) return;
      settled = true;
      req.unpipe(upstream);
      afterBody(req, () =>
        sendError(res, 500, err.code === "ECONNREFUSED" ? "Projects service unavailable" : "mensagem fallback"),
      );
    });

    // The client went away before the end of the body: cancel the request to
    // projects, which in turn cancels its upload to storage.
    req.once("close", () => {
      if (!req.complete) upstream.destroy(new Error("Upload aborted by the client"));
    });

    req.pipe(upstream);
  };
}

module.exports = { streamToProjects, answerAfterBody, afterBody };
