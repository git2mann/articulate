import type { Metadata } from "next";
import { Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const notoSerifJP = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: "Articulate",
  description: "Find that album cover you remember",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${notoSerifJP.variable} antialiased`}
      >
        <Providers>
          <div className="elegant-bg" />
          <div className="noise" />
          {children}
        </Providers>
      </body>
    </html>
  );
}
