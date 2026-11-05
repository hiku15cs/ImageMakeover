import type { Metadata } from "next";
import ClientDirectory from "@/components/admin/client-directory";
import { getCrmDirectoryData } from "@/app/actions/crm";

export const metadata: Metadata = { title: "Client CRM | Image Makeover" };

export default async function ClientsPage() {
  const { clients, metrics } = await getCrmDirectoryData();
  return <ClientDirectory clients={clients} metrics={metrics} />;
}
