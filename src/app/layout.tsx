import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/app/providers";
import "./globals.css";

const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ops OS",
  description: "Internal operations system for service businesses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${headingFont.variable} ${bodyFont.variable} antialiased`}>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
            try {
              const key = "opsos-theme";
              const stored = localStorage.getItem(key);
              const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
              const theme = stored === "dark" || stored === "light" ? stored : system;
              document.documentElement.classList.toggle("dark", theme === "dark");
              document.documentElement.style.colorScheme = theme;
            } catch {}
          })();`}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
