export const SITE = {
  name: "Laundry Point",
  tagline: "Laundry pickup in minutes, tracked live",
  description:
    "Laundry Point picks up your clothes in as little as 45 minutes, cleans them at our store and delivers them back - and you can watch your delivery partner live on the map.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  locale: "en_IN",
  keywords: [
    "laundry pickup and delivery",
    "online laundry service",
    "wash and fold",
    "dry cleaning near me",
    "doorstep laundry",
    "express laundry",
    "live order tracking",
    "Laundry Point",
  ],
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_URL.replace(/\/api\/?$/, "");
