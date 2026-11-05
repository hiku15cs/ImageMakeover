import type { Metadata } from "next";
import { bookingUrl } from "@/lib/salon";
import SiteFooter from "../_components/site-footer";
import SiteHeader from "../_components/site-header";
import TransformationsSection from "../_components/transformations-section";

export const metadata: Metadata = { title: "Our Work | Image Makeover" };

export default function WorkPage() {
  const bookingLink = bookingUrl("Hello Image Makeover, I'd love to book a consultation.");

  return (
    <main className="min-h-screen overflow-hidden">
      <SiteHeader bookingLink={bookingLink} />
      <TransformationsSection />
      <SiteFooter bookingLink={bookingLink} />
    </main>
  );
}
