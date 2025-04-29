// app/layout.js (Restructured with Sidebar)
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "./components/Sidebar"; // Import the Sidebar component
import "./globals.css"; // Ensure globals.css is imported

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Updated metadata
export const metadata = {
  title: "LONA",
  description: "Make Health Data Actionable With AI-powered Nutritional Insights.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Video Background Container (Behind everything) */}
        {/* Ensure background is removed from body in globals.css */}
        <div className="fixed inset-0 z-[-1] overflow-hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute top-0 left-0 w-full h-full object-cover"
          // poster="/path/to/your/poster-image.jpg" // Optional poster
          >
            <source src="/Blurry_Video_Request_Fulfilled.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50"></div>
        </div>

        {/* Main Layout Container */}
        {/* Relative z-index places this above the z-[-1] background */}
        <div className="relative z-[1] flex min-h-screen">
          {/* Sidebar Component */}
          <Sidebar />

          {/* Main Content Area */}
          {/* pl-64 prevents content overlap due to fixed sidebar width */}
          {/* flex-grow makes it take remaining width */}
          <main className="flex-grow pl-64 min-h-screen">
            {/* Children (page content) are rendered here */}
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}