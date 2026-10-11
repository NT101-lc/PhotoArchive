import type { Metadata, Viewport } from "next";
import { Archivo, Be_Vietnam_Pro } from "next/font/google";
import { AppBar } from "@/components/AppBar";
import { IdentityProvider } from "@/components/Identity";
import { ToastProvider } from "@/components/Toast";
import { UploadManagerProvider } from "@/components/UploadManager";
import { I18nProvider } from "@/i18n/client";
import { getT } from "@/i18n/server";
import { getCurrentMember } from "@/lib/auth";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Archivo bản rộng cho tiêu đề và số liệu (gợi chữ in trên hộp phim); Be Vietnam Pro cho nội dung
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "vietnamese"],
  axes: ["wdth"],
});

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: {
      default: "thesix",
      template: "%s · thesix",
    },
    description: t.meta.description,
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9ece8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1312" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [member, { locale }] = await Promise.all([getCurrentMember(), getT()]);
  return (
    <html
      lang={locale}
      data-theme="light"
      suppressHydrationWarning
      className={`${archivo.variable} ${beVietnam.variable}`}
    >
      <head>
        {/* Đặt theme trước lần paint đầu để không bị nháy sáng/tối */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <I18nProvider locale={locale}>
          <IdentityProvider member={member}>
            <ToastProvider>
              <UploadManagerProvider>
                <AppBar />
                {children}
              </UploadManagerProvider>
            </ToastProvider>
          </IdentityProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
