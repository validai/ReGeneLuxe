import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Space_Grotesk } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "../src/index.css";
import { THEME_BOOT_SCRIPT, themeFromCookie } from "../src/data/theme.js";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ReGeneLuxe",
  description: "Private local-first social media operating environment",
  applicationName: "ReGeneLuxe",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090B10" },
    { media: "(prefers-color-scheme: light)", color: "#F4F6FB" },
    { color: "#090B10" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieTheme = (await cookies()).get("regeneluxe-theme")?.value;
  const theme = themeFromCookie(cookieTheme);
  return (
    <html
      lang="en"
      data-theme={theme}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${spaceGrotesk.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-rl_bg font-sans text-rl_text antialiased">
        {children}
      </body>
    </html>
  );
}
