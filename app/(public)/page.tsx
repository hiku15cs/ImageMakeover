import { bookingUrl } from "@/lib/salon";
import HeroSection from "./_components/hero-section";
import SiteFooter from "./_components/site-footer";
import SiteHeader from "./_components/site-header";
import TestimonialsSection from "./_components/testimonials-section";
import VisitSection from "./_components/visit-section";

export default function HomePage() {
  const bookingLink = bookingUrl("Hello Image Makeover, I'd love to book a consultation.");

  return (
    <main className="overflow-hidden">
      <SiteHeader bookingLink={bookingLink} />
      <HeroSection bookingLink={bookingLink} />
      <VisitSection bookingLink={bookingLink} />
      <TestimonialsSection />
      <SiteFooter bookingLink={bookingLink} />
    </main>
  );
}
