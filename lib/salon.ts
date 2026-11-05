export const salon = {
  name: "Image Makeover",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
  phone: process.env.NEXT_PUBLIC_SALON_PHONE ?? "",
  address:
    "DDA Flats, E-593, opp. Coffee Home, Pocket-3, Block E, Mahavir Enclave Part 3, Bindapur, New Delhi, Delhi, 110059, India",
  mapUrl: "https://maps.app.goo.gl/dxesj5DY1ivZ5MnFA",
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3502.727795744111!2d77.06441627555105!3d28.607941785196687!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390d1b671928c8ad%3A0xfb12058e6ef84044!2sImage%20Makeover!5e0!3m2!1sen!2sus!4v1793865675397!5m2!1sen!2sus",
};

export function bookingUrl(message: string): string | null {
  const number = salon.whatsappNumber.replace(/\D/g, "");
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
