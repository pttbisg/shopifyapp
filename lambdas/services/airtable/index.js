"use strict";

const axios = require("axios");
const axiosRetry = require("axios-retry");
const _ = require("lodash");

axiosRetry(axios, {
  retries: 100,
  retryDelay: axiosRetry.exponentialDelay,
});

const {
  SKUOutboundISGOrdersService,
  SKUMatchingService,
} = require("../backendless");
const { AIRTABLE } = require("./enum");

class AirtablePTTBOutboundMainShopifyOrdersService {
  constructor() {
    this.skuMatchingService = new SKUMatchingService();

    this.baseID = AIRTABLE.PTTBOutbound.ID;
    this.tableName = AIRTABLE.PTTBOutbound.TABLE.MainShopifyOrders;
  }

  async MigrateISGOrderSourceToASCMLogistics() {
    const isgOrders = await this.getISGOrderSourceFilterBySendToASCM(false);
    // console.log(isgOrders);

    const groupedISGOrders = this.groupISGOrderByName(isgOrders.records);
    // console.log(groupedISGOrders);

    const convertedGroupedISGOrders = [];
    for (let groupedISGOrder of groupedISGOrders) {
      groupedISGOrder = this.convertISGOrderToASCMLogisticsAirtable(
        groupedISGOrder
      );
      convertedGroupedISGOrders.push(groupedISGOrder);
    }
    // console.log(convertedGroupedISGOrders);

    let convertedGroupedISGOrderGroupOf10 = [];
    for (let i = 0; i < convertedGroupedISGOrders.length; i++) {
      convertedGroupedISGOrderGroupOf10.push(convertedGroupedISGOrders[i]);

      if (
        convertedGroupedISGOrderGroupOf10.length == 10 ||
        i == convertedGroupedISGOrders.length - 1
      ) {
        const ascmLogistics = await this.insertToASCMLogictics(
          convertedGroupedISGOrderGroupOf10
        );
        // console.log(ascmLogistics.records);

        convertedGroupedISGOrderGroupOf10 = [];
      }
    }

    let total = 0;
    let data = [];

    let isgOrdersGroupOf10 = [];
    for (let i = 0; i < isgOrders.records.length; i++) {
      isgOrdersGroupOf10.push(isgOrders.records[i]);

      if (isgOrdersGroupOf10.length == 10 || i == isgOrders.length - 1) {
        const result = await this.patchISGOrderSourceMarkSendToASCM(
          isgOrdersGroupOf10
        );

        total += isgOrdersGroupOf10.length;
        data = data.concat(result.records);

        isgOrdersGroupOf10 = [];
      }
    }

    return {
      total: total,
      data: data,
    };
  }

  async getISGOrderSourceFilterBySendToASCM(SendToASCM) {
    let checked = 0;
    if (SendToASCM == true) {
      checked = 1;
    }

    const payload = {
      method: "GET",
      url: `https://api.airtable.com/v0/${
        AIRTABLE.PTTBOutbound.ID
      }/${encodeURIComponent(
        AIRTABLE.PTTBOutbound.TABLE.ISGOrderSource
      )}?&filterByFormula=AND({SendToASCM} = ${checked})&sort%5B0%5D%5Bfield%5D=Name&sort%5B0%5D%5Bdirection%5D=asc`,
      headers: {
        Authorization: `Bearer ${AIRTABLE.API_KEY}`,
      },
    };

    const res = await axios(payload);

    return res.data;
  }

  groupISGOrderByName(isgOrders) {
    let groupedISGOrder = {};

    for (let isgOrder of isgOrders) {
      isgOrder = isgOrder.fields;

      if (groupedISGOrder[isgOrder["Name"]] == undefined) {
        groupedISGOrder[isgOrder["Name"]] = {
          Name: isgOrder["Name"],
          LineItem: 0,
          UFTracking: isgOrder["UFTracking"],
          ASCM_ID: isgOrder["ASCM_ID"],
        };
      }

      groupedISGOrder[isgOrder["Name"]]["LineItem"] += 1;
    }

    const names = Object.keys(groupedISGOrder);

    let result = [];
    for (const name of names) {
      result.push(groupedISGOrder[name]);
    }

    return result;
  }

  convertISGOrderToASCMLogisticsAirtable(isgOrder) {
    const data = {
      deliveryOrder: _.get(isgOrder, "Name", "").substring(0, 20),
      deliveryOrderLineNumber:
        _.get(isgOrder, "LineItem", 0) > 9999
          ? 9999
          : _.get(isgOrder, "LineItem", 0),
      referenceNumber: _.get(isgOrder, "UFTracking", "").substring(0, 20),
      customerID: "ISG01",
      productID: _.get(isgOrder, "ASCM_ID", "").substring(0, 13),
    };

    return {
      fields: {
        "Delivery Order Number\n(Max 20 Chars)\n*COMPULSORY FIELD":
          data.deliveryOrder,
        "Delivery Order Line Number\n(Max 4 digits)\n*COMPULSORY FIELD":
          data.deliveryOrderLineNumber,
        "Reference Number \n(Max 20 Chars)": data.referenceNumber,
        "Product ID (Max 13 Chars for 50x25mm Labels)": data.productID,
        "Customer ID\n(Max 20 Chars)\n*COMPULSORY FIELD": data.customerID,
      },
    };
  }

  async insertToASCMLogictics(data) {
    const payload = {
      method: "POST",
      url: `https://api.airtable.com/v0/${
        AIRTABLE.PTTBOutbound.ID
      }/${encodeURIComponent(AIRTABLE.PTTBOutbound.TABLE.ASCMLogistics)}`,
      headers: {
        Authorization: `Bearer ${AIRTABLE.API_KEY}`,
        "Content-Type": "application/json",
      },
      data: {
        typecast: true,
        records: data,
      },
    };

    const res = await axios(payload);

    return res.data;
  }

  async patchISGOrderSourceMarkSendToASCM(isgOrders) {
    const markedISGOrders = isgOrders.map((isgOrder) => {
      isgOrder.fields = {
        SendToASCM: true,
      };

      delete isgOrder.createdTime;

      return isgOrder;
    });

    const payload = {
      method: "PATCH",
      url: `https://api.airtable.com/v0/${
        AIRTABLE.PTTBOutbound.ID
      }/${encodeURIComponent(AIRTABLE.PTTBOutbound.TABLE.ISGOrderSource)}`,
      headers: {
        Authorization: `Bearer ${AIRTABLE.API_KEY}`,
        "Content-Type": "application/json",
      },
      data: {
        records: markedISGOrders,
      },
    };

    const res = await axios(payload);

    return res.data;
  }

  async UpsertBEShopifyOrder(data) {
    try {
      const results = [];

      for (let item of _.get(data, "line_items")) {
        // Check Airtable based on Shopname, ShopifyID
        const records = await this.getShopifyOrder({
          Store_Name: _.get(data, "shop_name"),
          ShopifyID: _.get(data, "id"),
          Name: item.name,
        });

        if (records.length == 0) {
          console.log({
            action: "INSERT AIRTABLE",
            data: data,
          });

          let airtableResults = await this.insertAirtable(data, item);

          results.push(airtableResults);
        } else {
          console.log({
            action: "UPDATE AIRTABLE",
            data: data,
          });

          let airtableResults = await this.updateAirtableBasedOnID(
            data,
            item,
            _.get(records, "[0].id")
          );

          results.push(airtableResults);
        }
      }

      return results;
    } catch (err) {
      console.log(err.toJSON());
      throw err;
    }
  }

  async updateAirtableBasedOnID(data, item, airtableID) {
    const payload = {
      method: "PATCH",
      url: `https://api.airtable.com/v0/${
        AIRTABLE.PTTBOutbound.ID
      }/${encodeURIComponent(AIRTABLE.PTTBOutbound.TABLE.MainShopifyOrders)}`,
      headers: {
        Authorization: `Bearer ${AIRTABLE.API_KEY}`,
      },
      data: {
        typecast: true,
        records: this.convertShopifyToAirtableObject(data, item, airtableID),
      },
    };

    try {
      const res = await axios(payload);

      return res.data;
    } catch (err) {
      console.log(err.toJSON());

      throw err;
    }
  }

  async insertAirtable(data, item) {
    const payload = {
      method: "POST",
      url: `https://api.airtable.com/v0/${
        AIRTABLE.PTTBOutbound.ID
      }/${encodeURIComponent(AIRTABLE.PTTBOutbound.TABLE.MainShopifyOrders)}`,
      headers: {
        Authorization: `Bearer ${AIRTABLE.API_KEY}`,
      },
      data: {
        typecast: true,
        records: this.convertShopifyToAirtableObject(data, item),
      },
    };

    const res = await axios(payload);

    return res.data;
  }

  convertShopifyToAirtableObject(data, item, id) {
    const result = {
      fields: {
        STATUS: _.get(data, "topic"),
        Notes: _.get(data, "note"),
        "Shipping Name": _.get(data, "shipping_address"),
        "Created at": new Date(_.get(data, "created_at")),
        Email: _.get(data, "email"),
        "Financial Status": _.get(data, "financial_status"),
        // "Paid at": _.get(data, "Status"),
        "Fulfillment Status": _.get(data, "fulfillment_status"),
        // "Fulfillment at": _.get(data, "Status"),
        "Accepts Marketing": _.get(data, "buyer_accepts_marketing"),
        Currency: _.get(data, "currency"),
        Subtotal: _.get(data, "subtotal_price"),
        Taxes: _.get(data, "total_tax"),
        Total: _.get(data, "total_price"),
        "Discount Code": _.get(data, "discount_codes[0].code"),
        "Discount Amount": _.get(data, "discount_codes[0].amount"),
        "Shipping Method": _.get(data, "shipping_lines[0].title"),
        "Lineitem quantity": _.get(item, "quantity"),
        "Lineitem name": _.get(item, "name"),
        "Lineitem price": _.get(item, "price"),
        "Lineitem sku": _.get(item, "sku"),
        "Lineitem requires shipping": _.get(item, "requires_shipping"),
        "Lineitem taxable": _.get(item, "taxable"),
        "Billing Name": _.get(data, "billing_address.name"),
        "Billing Street": _.get(data, "billing_address.address1"),
        "Billing Address1": _.get(data, "billing_address.address1"),
        "Billing Address2": _.get(data, "billing_address.address2"),
        "Billing Company": _.get(data, "billing_address.company"),
        "Billing City": _.get(data, "billing_address.city"),
        "Billing Zip": _.get(data, "billing_address.zip"),
        "Billing Province": _.get(data, "billing_address.province"),
        "Billing Country": _.get(data, "billing_address.country"),
        "Billing Phone": _.get(data, "billing_address.phone"),
        "Shipping Street": _.get(data, "shipping_address.address1"),
        "Shipping Address1": _.get(data, "shipping_address.address1"),
        "Shipping Address2": _.get(data, "shipping_address.address2"),
        "Shipping Company": _.get(data, "shipping_address.company"),
        "Shipping City": _.get(data, "shipping_address.city"),
        "Shipping Zip": _.get(data, "shipping_address.zip"),
        "Shipping Province": _.get(data, "shipping_address.province"),
        "Shipping Country": _.get(data, "shipping_address.country"),
        "Shipping Phone": _.get(data, "shipping_address.phone"),
        "Note Attributes": _.get(data, "note_attributes", "[]"),
        "Cancelled at": _.get(data, "cancelled_at"),
        // "Payment Method": _.get(data, "Status"),
        // "Payment Reference": _.get(data, "Status"),
        // "Refunded Amount": _.get(data, "Status"),
        Vendor: _.get(item, "vendor"),

        Id: _.get(data, "id"),
        Tags: _.get(data, "tags"),
        // "Risk Level": _.get(data, "Status"),
        Source: _.get(data, "source_name"),
        "Lineitem discount": _.get(item, "total_discount"),
        Phone: _.get(data, "phone"),
        "Internal Order Number": _.get(data, "order_number"),
        Store_Name: _.get(data, "shop_name"),
        "Referring Site": _.get(data, "referring_site"),
        Barcode_standaloneCol: this.skuMatchingService.GetBarcodeByLocalSKU(
          _.get(item, "sku")
        ),
        // "BackendlessObjectId": _.get(data, "objectId"),
      },
    };

    if (id) {
      result["Id"] = id;
    }

    return [result];
  }

  async getShopifyOrder({ Store_Name, ShopifyID, Name }) {
    const payload = {
      method: "GET",
      url: `https://api.airtable.com/v0/${
        AIRTABLE.PTTBOutbound.ID
      }/${encodeURIComponent(
        AIRTABLE.PTTBOutbound.TABLE.MainShopifyOrders
      )}?filterByFormula=AND({Store_Name}="${Store_Name}",{Id}=${ShopifyID},{Lineitem name}="${Name}")&maxRecords=1&maxRecords=1&sort%5B0%5D%5Bfield%5D=Created+at&sort%5B0%5D%5Bdirection%5D=desc`,
      headers: {
        Authorization: `Bearer ${AIRTABLE.API_KEY}`,
      },
    };

    const res = await axios(payload);

    return res.data;
  }
}

module.exports = {
  AirtablePTTBOutboundMainShopifyOrdersService,
};
