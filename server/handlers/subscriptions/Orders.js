const {default: Shopify} = require('@shopify/shopify-api');
const axios = require('axios');

/**
 * @typedef WebhookRegistryObject
 * @property shop
 * @property accessToken
 * @property topic
 * @property path*
 * @property {function} webhookHandler
 */
class Orders {
  shop;
  accessToken;

  constructor(shop, accessToken) {
    this.shop = shop;
    this.accessToken = accessToken;
  }

  /**
   *
   * @param {WebhookRegistryObject} webhookRegistryObject
   * @private
   */
  _webhookRegistry = async (webhookRegistryObject) => {
    const {shop, accessToken, topic, path,  webhookHandler} = webhookRegistryObject;
    const registryResponse = await Shopify.Webhooks.Registry.register({
      shop,
      accessToken,
      topic,
      path,
      webhookHandler
    });

    if (!registryResponse.success) {
      console.log(
        `Failed to register ${topic} webhook: ${registryResponse.result}`
      );
    } else {
      console.log(`registered ${topic} webhook`);
    }
    return registryResponse;
  }

  registerOrderCreateHook = async () => {
    const webhookRegistryObject = {
      shop: this.shop,
      accessToken: this.accessToken,
      topic: "ORDERS_CREATE",
      path: "/orders/create",
      webhookHandler: async function (topic, shop, body) {
        body = JSON.parse(body);
        body.topic = topic;
        body.shop_name = shop;

        const res = await axios({
          method: "POST",
          url: process.env.LAMBDA_CREATE_ORDER,
          data: body,
        });

        console.log(res.data);
      }
    }
    await this._webhookRegistry(webhookRegistryObject);
  }

  registerOrderUpdateHook = async () => {
    const webhookRegistryObject = {
      shop: this.shop,
      accessToken: this.accessToken,
      topic: "ORDERS_UPDATED",
      path: "/webhooks/orders/update",
      webhookHandler: async function (topic, shop, body) {
        body = JSON.parse(body);
        body.topic = topic;
        body.shop_name = shop;

        const res = await axios({
          method: "POST",
          url: process.env.LAMBDA_UPDATE_ORDER,
          data: body,
        });

        console.log(res.data);
      }
    }
    await this._webhookRegistry(webhookRegistryObject);
  }
}

module.exports = Orders;
