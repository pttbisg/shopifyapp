"use strict";

const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

// const ACTIVE_SHOPIFY_SHOPS = {};
const TABLE = {
  ShopifySession: "Shopify_Session",
};

class BackendlessHandler {
  async storeCallback(session) {
    try {
      // ACTIVE_SHOPIFY_SHOPS[session.id] = JSON.stringify(session);
      const payload = {
        method: "POST",
        url: `https://api.backendless.com/${process.env.BACKENDLESS_APP_ID_PROD}/${process.env.BACKENDLESS_APP_KEY_PROD}/data/${TABLE.ShopifySession}`,
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          id: session.id,
          session: JSON.stringify(session),
        },
      };

      const result = await axios(payload);

      return true;
    } catch (err) {
      console.log(err);
      throw new Error(err);
    }
  }
  async loadCallback(id) {
    try {
      // const result = ACTIVE_SHOPIFY_SHOPS[id];
      const payload = {
        method: "GET",
        url: `https://api.backendless.com/${process.env.BACKENDLESS_APP_ID_PROD}/${process.env.BACKENDLESS_APP_KEY_PROD}/data/${TABLE.ShopifySession}?where=id='${id}'`,
        headers: {
          "Content-Type": "application/json",
        },
      };

      const result = await axios(payload);

      return JSON.parse(result.data[0].session);
    } catch (err) {
      throw new Error(err);
    }
  }

  async deleteCallback(id) {
    try {
      // delete ACTIVE_SHOPIFY_SHOPS[id];
      const payload = {
        method: "DELETE",
        url: `https://api.backendless.com/${process.env.BACKENDLESS_APP_ID_PROD}/${process.env.BACKENDLESS_APP_KEY_PROD}/data/${TABLE.ShopifySession}?where=id='${id}'`,
        headers: {
          "Content-Type": "application/json",
        },
      };

      const result = await axios(payload);

      return true;
    } catch (err) {
      throw new Error(err);
    }
  }
}

module.exports = BackendlessHandler;
