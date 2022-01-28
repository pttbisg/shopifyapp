"use strict";

require("@babel/polyfill");
const dotenv = require("dotenv");
require("isomorphic-fetch");
const { default: createShopifyAuth } = require("@shopify/koa-shopify-auth");
const { verifyRequest } = require("@shopify/koa-shopify-auth");
const { default: Shopify, ApiVersion } = require("@shopify/shopify-api");
const Koa = require("koa");
const next = require("next");
const Router = require("koa-router");
const axios = require("axios");
const shopifyHook = require("./services/customWebhook");

const BackendlessHandler = require("./services/backendless");
const sessionStorage = new BackendlessHandler();

dotenv.config();
const port = parseInt(process.env.PORT, 10) || 8081;
const dev = process.env.NODE_ENV !== "production";
const app = next({
  dev,
});
const handle = app.getRequestHandler();

Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: process.env.SCOPES.split(","),
  HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
  API_VERSION: ApiVersion.July21,
  IS_EMBEDDED_APP: true,
  // This should be replaced with your preferred storage strategy
  SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
  // SESSION_STORAGE: new Shopify.Session.CustomSessionStorage(
  //   sessionStorage.storeCallback,
  //   sessionStorage.loadCallback,
  //   sessionStorage.deleteCallback
  // ),
});

// Storing the currently active shops in memory will force them to re-login when your server restarts. You should
// persist this object in your app.
const ACTIVE_SHOPIFY_SHOPS = {};

const server = new Koa();
const router = new Router();

app.prepare().then(async () => {
  server.keys = [Shopify.Context.API_SECRET_KEY];

  server.use(
    createShopifyAuth({
      accessMode: "offline",

      async afterAuth(ctx) {
        // Access token and shop available in ctx.state.shopify
        const { shop, accessToken, scope } = ctx.state.shopify;
        const host = ctx.query.host;

        ACTIVE_SHOPIFY_SHOPS[shop] = scope;

        let res = await shopifyHook.registerWebhook({
          accessToken,
          address:
            "arn:aws:events:ap-southeast-1::event-source/aws.partner/shopify.com/6402507/shopify-live",
          apiVersion: "2022-01",
          shop,
          topic: "ORDERS_CREATE",
        });

        if (!res.success) {
          console.log(
            `Failed to register ORDERS_CREATE webhook: ${res.result}`
          );
        }

        res = await shopifyHook.registerWebhook({
          accessToken,
          address:
            "arn:aws:events:ap-southeast-1::event-source/aws.partner/shopify.com/6402507/shopify-live",
          apiVersion: "2022-01",
          shop,
          topic: "ORDERS_UPDATED",
        });

        if (!res.success) {
          console.log(
            `Failed to register ORDERS_UPDATED webhook: ${res.result}`
          );
        }

        // Redirect to app with shop parameter upon auth
        ctx.redirect(`/?shop=${shop}&host=${host}`);
      },
    })
  );

  const handleRequest = async (ctx) => {
    await handle(ctx.req, ctx.res);
    ctx.respond = false;
    ctx.res.statusCode = 200;
  };

  router.get("/", async (ctx) => {
    const shop = ctx.query.shop;

    // This shop hasn't been seen yet, go through OAuth to create a session
    if (ACTIVE_SHOPIFY_SHOPS[shop] === undefined) {
      ctx.redirect(`/auth?shop=${shop}`);
    } else {
      await handleRequest(ctx);
    }
  });

  router.post("/webhooks/orders_create", async (ctx) => {
    try {
      await Shopify.Webhooks.Registry.process(ctx.req, ctx.res);

      console.log(`Webhook processed: orders_create, returned status code 200`);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
    }
  });

  router.post("/webhooks/orders_updated", async (ctx) => {
    try {
      await Shopify.Webhooks.Registry.process(ctx.req, ctx.res);

      console.log(
        `Webhook processed: orders_updated, returned status code 200`
      );
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
    }
  });

  router.post(
    "/graphql",
    verifyRequest({ returnHeader: true }),
    async (ctx, next) => {
      await Shopify.Utils.graphqlProxy(ctx.req, ctx.res);
    }
  );

  const healthcheckRequest = async (ctx) => {
    try {
      console.log(ctx.path);
      if (
        ctx.path === "/healthcheck/readiness" ||
        ctx.path === "/healthcheck/liveness"
      ) {
        ctx.status = 200;
        ctx.body = {
          message: "OK",
        };

        return;
      }
    } catch (err) {
      throw err;
    }
  };

  router.get("(/_next/static/.*)", handleRequest); // Static content is clear
  router.get("/_next/webpack-hmr", handleRequest); // Webpack content is clear
  router.get("(.*)", healthcheckRequest, verifyRequest(), handleRequest); // Everything else must have sessions

  server.use(router.allowedMethods());
  server.use(router.routes());

  server.listen(port, process.env.HEROKU_HOST || "0.0.0.0", () => {
    console.log(`> Ready on ${process.env.HOST}:${port}`);
  });
});

module.exports = {
  app: server,
};
