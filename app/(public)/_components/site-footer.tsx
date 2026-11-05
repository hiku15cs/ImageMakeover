import { Phone } from "lucide-react";

export default function SiteFooter({ bookingLink }: { bookingLink: string | null }) {
  return (
    <>
      <footer className="border-t border-brand-border px-5 py-7">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-xs text-brand-muted sm:flex-row lg:px-3">
          <p>© {new Date().getFullYear()} Image Makeover. Made with intention.</p>
          <p>Beauty, in your own image.</p>
        </div>
      </footer>
      <a
        href={bookingLink ?? "/#visit"}
        target={bookingLink ? "_blank" : undefined}
        rel={bookingLink ? "noreferrer" : undefined}
        aria-label={bookingLink ? "Book on WhatsApp" : "Find booking contact details"}
        className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full border border-brand-champagne/50 bg-brand-gold text-brand-background shadow-gold transition hover:scale-105"
      >
        <Phone size={21} />
      </a>
    </>
  );
}
