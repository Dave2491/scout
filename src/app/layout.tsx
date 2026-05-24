import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Scout Opportunity Agent",
  description: "Opportunity strategy agent for hackathons, grants, and bounties.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
