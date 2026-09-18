import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import Navbar from "../components/Navbar";

export const metadata = {
  title: "Basin — Laundry Pickup & Delivery",
  description: "Book a laundry pickup in under a minute.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-body">
        <AuthProvider>
          <Navbar />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
