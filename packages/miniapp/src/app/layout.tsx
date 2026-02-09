import type { Metadata } from "next";
import { Providers } from "@/providers";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taskmint — Onchain Bounties",
  description:
    "Post funded bounties on Base. Complete tasks. Get verified onchain. Get paid.",
  other: {
    "base:app_id": "6989380773cda529e5cd6808",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          {children}
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
