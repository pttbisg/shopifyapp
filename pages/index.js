import { Page, Card, Stack, TextContainer } from "@shopify/polaris";

const Index = () => (
  <Page>
    <Card sectioned>
      <TextContainer>
        This app installs webhooks for order create, order edit and order delete
        events. It allows our local teams in country to process your orders with
        our warehouses. To uninstall, go to Apps (on your Shopify Dashboard
        Sidebar) > Delete
      </TextContainer>
    </Card>
  </Page>
);

export default Index;
