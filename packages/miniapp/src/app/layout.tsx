import type { Metadata } from "next";
import { Providers } from "@/providers";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { MiniAppReady } from "@/components/MiniAppReady";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_URL ?? "https://trytaskmint.vercel.app";

export const metadata: Metadata = {
  title: "Taskmint — Onchain Bounties",
  description:
    "Post funded bounties on Base. Complete tasks. Get verified onchain. Get paid.",
  other: {
    "base:app_id": "6989380773cda529e5cd6808",
    "fc:miniapp": JSON.stringify({
      version: "next",
      imageUrl: `${APP_URL}/preview.png`,
      button: {
        title: "Open Taskmint",
        action: {
          type: "launch_frame",
          url: APP_URL,
          name: "Taskmint",
          splashImageUrl: `${APP_URL}/splash.png`,
          splashBackgroundColor: "#122f57",
        },
      },
    }),
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
          <MiniAppReady />
          <Header />
          {children}
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
