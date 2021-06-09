"use strict";

const sls = require("serverless-http");
const app = require("./server/server").app;

module.exports.server = sls(app, {
  binary: ["*/*"],
});
