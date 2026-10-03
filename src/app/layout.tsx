import type { Metadata } from "next";
import { Bricolage_Grotesque, Fraunces, Geist_Mono, Great_Vibes } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  style: ["italic"],
});

// Script face for the accent words on the landing page.
const greatVibes = Great_Vibes({
  variable: "--font-script-face",
  subsets: ["latin", "latin-ext"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Kraków dopasowany do Ciebie",
  description:
    "Sprawdź, które części Krakowa pasują do Twojego stylu życia — spersonalizowana mapa dopasowania.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      className={`${bricolage.variable} ${fraunces.variable} ${greatVibes.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
