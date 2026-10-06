import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Bricolage_Grotesque, Space_Mono } from "next/font/google";
import { AppBar } from "@/components/AppBar";
import { ToastProvider } from "@/components/Toast";
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
  description: "Kho ảnh riêng tư của nhóm B6 — lưu và xem lại ảnh các chuyến đi.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efe9dd" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      data-theme="light"
      suppressHydrationWarning
      className={`${bricolage.variable} ${beVietnam.variable} ${spaceMono.variable}`}
    >
      <head>
        {/* Đặt theme trước lần paint đầu để không bị nháy sáng/tối */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>
          <AppBar />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
