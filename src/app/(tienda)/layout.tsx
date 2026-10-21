import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { StoreProvider } from "@/components/store-provider";
import { WhatsAppFab } from "@/components/whatsapp-fab";
import { AssistantChat } from "@/components/assistant-chat";
import { getProducts } from "@/server/catalog";
import { getStoreSettings } from "@/server/settings";

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const [products, settings] = await Promise.all([getProducts(), getStoreSettings()]);
  return (
    <StoreProvider products={products} whatsapp={settings.whatsappNumber} assistant={settings.assistantEnabled}>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer whatsapp={settings.whatsappNumber} />
      <WhatsAppFab />
      <AssistantChat />
    </StoreProvider>
  );
}
