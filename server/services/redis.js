"use strict";

import { promisifyAll } from "bluebird";
const redis = require("redis");
const dotenv = require("dotenv");

dotenv.config();

promisifyAll(redis);

class RedisStoreHandler {
  constructor() {
    this.client = redis.createClient({
      port: parseInt(process.env.REDIS_PORT) || 6379,
      host: process.env.REDIS_HOST || "localhost",
      auth_pass: process.env.REDIS_PASS,
    });
  }

  async storeCallback(session) {
    try {
      this.client = redis.createClient({
        port: parseInt(process.env.REDIS_PORT) || 6379,
        host: process.env.REDIS_HOST || "localhost",
        auth_pass: process.env.REDIS_PASS,
      });

      await this.client.setAsync(session.id, JSON.stringify(session));

      return true;
    } catch (err) {
      console.log(err);
      throw new Error(err);
    }
  }
  async loadCallback(id) {
    try {
      this.client = redis.createClient({
        port: parseInt(process.env.REDIS_PORT) || 6379,
        host: process.env.REDIS_HOST || "localhost",
        auth_pass: process.env.REDIS_PASS,
      });

      const result = await this.client.getAsync(id);

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
      this.client = redis.createClient({
        port: parseInt(process.env.REDIS_PORT) || 6379,
        host: process.env.REDIS_HOST || "localhost",
        auth_pass: process.env.REDIS_PASS,
      });

      await this.client.delAsync(id);

      return true;
    } catch (err) {
      throw new Error(err);
    }
  }
}

module.exports = RedisStoreHandler;
