require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const { SUPABASE_DATABASE_URL, SUPABASE_SERVICE_API_KEY } = process.env;

class Supabase {
  constructor() {
    this.supabase = createClient(
      SUPABASE_DATABASE_URL,
      SUPABASE_SERVICE_API_KEY
    );
  }

  async createOutboundShopify(payload) {
    const outbounds_json = this.buildOutboundJSON(payload);

    console.log(outbounds_json);

    const { data: outbounds, error } = await this.supabase
      .from("outbounds_shopify")
      .insert(outbounds_json)
      .select("*");

    if (error) {
      console.error(error);
      return;
    }
    return outbounds;
  }

  buildOutboundJSON(params) {
    const payload = [];
    params.line_items.forEach((item) => {
      payload.push({
        outbounds_shopify_full_payloadjson: JSON.stringify(item),
        shipping_address1: params.shipping_address.address1,
        shipping_company: params.shipping_address.company,
        lineitem_sku: item.sku,
        order_number: params.order_number,
        cancelled_at: params.closed_at,
        shipping_address2: params.shipping_address.address2,
        shipping_zip: params.shipping_address.zip,
        shipping_name: params.shipping_address.name,
        discount_code: params.discount_codes[0],
        shipping_country: params.shipping_address.country,
        tags: params.tags,
        shipping_phone: params.shipping_address.phone,
        fulfillment_status: params.fulfillment_status,
        financial_status: params.financial_status,
        lineitem_quantity: item.quantity,
        lineitem_price: item.price,
        order_status: params.order_status_url,
        lineitem_name: item.name,
        discount_amount: params.total_discounts,
        total: params.total_line_items_price,
        customer_email: params.customer.email,
        payment_method: params.gateway,
        shipping_fee: params.shipping_lines.reduce((total, line) => {
          if (!line.price) return total;
          return total + parseFloat(line.price);
        }, 0),
      });
    });

    return payload;
  }
}

module.exports = Supabase;
