const { Method, Header } = require("@shopify/network");
const axios = require("axios");

module.exports.registerWebhook = async function registerWebhook({
  address,
  topic,
  accessToken,
  shop,
  apiVersion,
}) {
  const response = await axios({
    method: "POST",
    url: `https://${shop}/admin/api/${apiVersion}/graphql.json`,
    headers: {
      "X-Shopify-Access-Token": accessToken,
      [Header.ContentType]: "application/graphql",
    },
    data: buildQuery(topic, address),
  });

  const result = await response.data;

  console.log(result.data);
  console.log(result.data.eventBridgeWebhookSubscriptionCreate.userErrors);

  if (
    result.data &&
    result.data.eventBridgeWebhookSubscriptionCreate &&
    result.data.eventBridgeWebhookSubscriptionCreate.webhookSubscription
  ) {
    return { success: true, result: result.data };
  } else {
    return { success: false, result: result.data };
  }
};

const buildQuery = (topic, arn) => {
  return `
      mutation {
        eventBridgeWebhookSubscriptionCreate(
          topic: ${topic},
          webhookSubscription: { 
            arn: "${arn}"
            format: JSON 
          }
          ) {
            webhookSubscription {
              id
            }
            userErrors {
              message
            }
          }
        }  
        `;
};
