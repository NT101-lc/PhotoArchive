import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Bricolage_Grotesque, Space_Mono } from "next/font/google";
import { AppBar } from "@/components/AppBar";
import { IdentityProvider } from "@/components/Identity";
import { ToastProvider } from "@/components/Toast";
import { getCurrentMember } from "@/lib/auth";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "vietnamese"],
});

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "B6 PhotoArchive",
    template: "%s | B6 PhotoArchive",
  },
  description: "The B6 crew's private photo archive — store and relive every trip.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efe9dd" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const member = await getCurrentMember();
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${bricolage.variable} ${beVietnam.variable} ${spaceMono.variable}`}
    >
      <head>
        {/* Đặt theme trước lần paint đầu để không bị nháy sáng/tối */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <IdentityProvider member={member}>
          <ToastProvider>
            <AppBar />
            {children}
          </ToastProvider>
        </IdentityProvider>
      </body>
    </html>
  );
}
