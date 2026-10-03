import type { Metadata } from "next";
import { Bricolage_Grotesque, Fraunces, Geist_Mono, Pinyon_Script } from "next/font/google";
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

// Stand-in for Tempting (a licensed font): used only until public/fonts/Tempting.woff2 exists.
const pinyon = Pinyon_Script({
  variable: "--font-pinyon",
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
      className={`${bricolage.variable} ${fraunces.variable} ${pinyon.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
