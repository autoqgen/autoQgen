import "./globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Providers from "./providers";

export const metadata = {
  title: "AutoQgen - Question Management System",
  description: "Smart exam and question paper generation system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-gray-50">
        <Providers>
          {/* GLOBAL NAVBAR */}
          <Navbar />

          {/* MAIN CONTENT */}
          <main className="flex-1 bg-white">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
