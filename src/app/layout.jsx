import "./globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
export const metadata = {
  title: "AutoQgen - Question Management System",
  description: "Smart exam and question paper generation system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-gray-50">

        {/* GLOBAL NAVBAR */}
        <Navbar />

        {/* MAIN CONTENT */}
        <main className="flex-1 bg-white">
          {children}
        </main>
<Footer />
      </body>
    </html>
  );
}