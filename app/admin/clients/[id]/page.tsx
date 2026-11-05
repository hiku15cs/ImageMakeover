import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCrmClientDetails } from "@/app/actions/crm";
import ClientProfile from "@/components/admin/client-profile";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Client Profile | Image Makeover" };

export default async function ClientDetailsPage({ params }: Props) {
  const { id } = await params;
  const client = await getCrmClientDetails(id);
  if (!client) notFound();
  return <ClientProfile client={client} />;
}
