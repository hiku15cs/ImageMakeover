import type { Metadata } from "next";
import SlotPicker from "@/components/booking/SlotPicker";

export const metadata: Metadata = { title: "Book an appointment | Image Makeover" };

export default function BookingPage() {
  return (
    <main className="min-h-screen bg-brand-background px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[.25em] text-brand-antique">Image Makeover · Reservations</p>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl">Make a little time <span className="gold-text italic">for you.</span></h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">Choose a service and time. Bookings are available up to 30 days ahead, and you can book with or without an account.</p>
        <SlotPicker />
      </div>
    </main>
  );
}
