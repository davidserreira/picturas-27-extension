var express = require("express");
var router = express.Router();

const axios = require("axios");

const https = require("https");
const fs = require("fs");

const auth = require("../auth/auth");

const key = fs.readFileSync(__dirname + "/../certs/selfsigned.key");
const cert = fs.readFileSync(__dirname + "/../certs/selfsigned.crt");

const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // (NOTE: this will disable client verification)
  cert: cert,
  key: key,
});

const projectsURL = "https://projects:9001/";

/**
 * Forwards a request to the projects service and relays its answer as is,
 * including the error structure { code, message }.
 * `data` may be a stream, in which case it is piped without being buffered.
 */
function forward(req, res, method, path, data, headers = {}) {
  axios({
    method,
    url: projectsURL + path,
    data,
    httpsAgent,
    headers: {
      Authorization: req.headers["authorization"],
      "X-Caller-Id": req.authUserId,
      ...headers,
    },
    maxBodyLength: Infinity,
    maxRedirects: 0,
    validateStatus: () => true,
  })
    .then((resp) => {
      if (resp.status === 204) return res.sendStatus(204);
      return res.status(resp.status).jsonp(resp.data);
    })
    .catch((err) => {
      console.error("[API-GW] videos", method, path, err.message);
      if (res.headersSent) return;
      return res.status(502).jsonp({
        code: "SERVICE_UNAVAILABLE",
        message: "O serviço de vídeo não está disponível. Tente novamente.",
      });
    });
}

function videosPath(req, suffix = "") {
  return `${req.params.user}/${req.params.project}/videos${suffix}`;
}

/**
 * Get the videos of a project
 * @body Empty
 * @returns { "videos": [Video], "usage": { used, limit }, "limits": Object, "profile": String }
 */
router.get("/:user/:project/videos", auth.checkToken, function (req, res, next) {
  forward(req, res, "get", videosPath(req));
});

/**
 * Get a specific video
 * @body Empty
 * @returns The required video
 */
router.get("/:user/:project/videos/:video", auth.checkToken, function (req, res, next) {
  forward(req, res, "get", videosPath(req, `/${req.params.video}`));
});

/**
 * Get the url of an available video
 * @body Empty
 * @returns { "url": String }
 */
router.get("/:user/:project/videos/:video/url", auth.checkToken, function (req, res, next) {
  forward(req, res, "get", videosPath(req, `/${req.params.video}/url`));
});

/**
 * Start importing a video
 * @body { "name": String, "size": Number, "fingerprint": String }
 * @returns { "video": Video, "chunkSize": Number }
 */
router.post("/:user/:project/videos", auth.checkToken, function (req, res, next) {
  forward(req, res, "post", videosPath(req), req.body);
});

/**
 * Send the next part of a video being imported
 * @query offset: number of bytes already sent
 * @body Raw bytes (application/octet-stream), streamed to the projects service
 * @returns { "received": Number }
 */
router.put("/:user/:project/videos/:video/chunk", auth.checkToken, function (req, res, next) {
  const offset = encodeURIComponent(req.query.offset ?? "");

  forward(req, res, "put", videosPath(req, `/${req.params.video}/chunk?offset=${offset}`), req, {
    "Content-Type": "application/octet-stream",
    "Content-Length": req.headers["content-length"],
  });
});

/**
 * Import actions: complete the upload, resume it, mark it as interrupted or cancel it
 * @body Empty, except for resume: { "name": String, "size": Number, "fingerprint": String }
 * @returns { "video": Video }
 */
router.post(
  "/:user/:project/videos/:video/:action(complete|resume|interrupt|cancel)",
  auth.checkToken,
  function (req, res, next) {
    forward(
      req,
      res,
      "post",
      videosPath(req, `/${req.params.video}/${req.params.action}`),
      req.body,
    );
  },
);

/**
 * Delete a video
 * @body Empty
 * @returns Empty
 */
router.delete("/:user/:project/videos/:video", auth.checkToken, function (req, res, next) {
  forward(req, res, "delete", videosPath(req, `/${req.params.video}`));
});

module.exports = router;
