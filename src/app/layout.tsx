import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "HallwayLauncher Studio — your cozy Minecraft control panel",
  description: "A warm, hand-made-feeling desktop client for portablemc. Built with Next.js, Tailwind CSS, and a little care.",
  keywords: ["HallwayLauncher", "Minecraft", "portablemc", "launcher", "desktop client"],
  authors: [{ name: "HallwayLauncher Studio" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "HallwayLauncher Studio",
    description: "A warm, hand-made-feeling desktop client for portablemc.",
    url: "https://chat.z.ai",
    siteName: "HallwayLauncher Studio",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HallwayLauncher Studio",
    description: "A cozy desktop client for portablemc.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} ${jetbrains.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
