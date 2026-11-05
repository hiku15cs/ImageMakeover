export type Category = "Hair" | "Skin" | "Bridal" | "Nails";
export type Service = {
  id: string;
  title: string;
  category: Category;
  description: string;
  duration_minutes: number;
  price: number;
};
export type OpenStatus = { open: boolean; message: string; next: string };

export const categories: Array<Category | "All"> = [
  "All",
  "Hair",
  "Skin",
  "Bridal",
  "Nails",
];

export const initialServices: Service[] = [
  { id: "haircut", title: "Signature Haircut", category: "Hair", description: "A tailored cut, wash and effortless finish.", duration_minutes: 60, price: 1200 },
  { id: "color", title: "Dimensional Colour", category: "Hair", description: "Lived-in colour designed around you.", duration_minutes: 150, price: 4500 },
  { id: "ritual", title: "Radiance Facial", category: "Skin", description: "A restorative facial for luminous, balanced skin.", duration_minutes: 75, price: 2800 },
  { id: "bridal", title: "Bridal Signature", category: "Bridal", description: "A considered look for your once-in-a-lifetime day.", duration_minutes: 180, price: 15000 },
  { id: "manicure", title: "Classic Manicure", category: "Nails", description: "A clean shape, cuticle care and polished finish.", duration_minutes: 45, price: 900 },
];

export const beforeImage =
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=85";
export const afterImage =
  "/image-makeover.webp";

export const testimonials = [
  {
    name: "Shivani Chadha",
    service: "Wedding makeup & hair",
    quote:
      "Thank you so much for the beautiful makeup and hair you did for my brother’s wedding. You made me feel so confident and special on such an important day. I received so many compliments!",
  },
  {
    name: "Swati Choudhary",
    service: "A returning client",
    quote:
      "Since starting first day I always had my experience excellent and everything is so perfect. I always chosen Image Makeover; I didn't go anywhere else since I first visited this place.",
  },
  {
    name: "Nidhi Chandel",
    service: "Wedding makeup & hairstyle",
    quote:
      "Thank you so much for the beautiful makeup and hairstyle. Everything was flawless and stayed perfect throughout the wedding. I received so many compliments!",
  },
];

export function getOpenStatus(date: Date): OpenStatus {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = value("weekday");
  const currentMinutes = Number(value("hour")) * 60 + Number(value("minute"));

  if (weekday === "Tuesday") {
    return { open: false, message: "Closed today", next: "Open Wednesday at 10:00 AM IST" };
  }
  if (currentMinutes < 10 * 60) {
    return { open: false, message: "Opening soon", next: "Today, 10:00 AM–8:30 PM IST" };
  }
  if (currentMinutes >= 20 * 60 + 30) {
    return { open: false, message: "Closed for today", next: "Open tomorrow at 10:00 AM IST" };
  }
  return { open: true, message: "Open now", next: "Today until 8:30 PM IST" };
}
