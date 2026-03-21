import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";



export const metadata: Metadata = {
  title: "AIInfo - Chat to any persons twitter profile",
  description: "Compete in live coding contests, master DSA and development challenges, and track your progress on the global leaderboard.",
  keywords: ["coding", "contests", "DSA", "development", "competitive programming", "leaderboard"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body >
                {children}
      </body>
    </html>
  );
}
