"use strict";

const dotenv = require("dotenv");

dotenv.config();

const ACTIVE_SHOPIFY_SHOPS = {};

class BackendlessHandler {
  async storeCallback(session) {
    try {
      ACTIVE_SHOPIFY_SHOPS[session.id] = JSON.stringify(session);

      return true;
    } catch (err) {
      console.log(err);
      throw new Error(err);
    }
  }
  async loadCallback(id) {
    try {
      const result = ACTIVE_SHOPIFY_SHOPS[id];

      if (result) {
        return JSON.parse(result);
      }

      return undefined;
    } catch (err) {
      throw new Error(err);
    }
  }

  async deleteCallback(id) {
    try {
      delete ACTIVE_SHOPIFY_SHOPS[id];

      return true;
    } catch (err) {
      throw new Error(err);
    }
  }
}

module.exports = BackendlessHandler;
