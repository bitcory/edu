import type { Metadata, Viewport } from "next";
import { SessionProvider } from "next-auth/react";
import { auth } from "../auth";
import "./globals.css";
import PwaSetup from "./components/PwaSetup";
import OrientationGate from "./components/OrientationGate";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kid.toolb.kr";
const title = "우리 책장";
const description = "PDF를 업로드해서 책처럼 넘겨 볼 수 있는 어린이 그림책 뷰어";
const socialImage = "/social-thumbnail-20260529.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${title} — PDF 그림책 뷰어`,
  description,
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: title,
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "우리 책장 어린이 그림책 PDF 뷰어",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [socialImage],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/app-icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  // iOS "홈 화면에 추가" → 주소창 없는 전체화면 실행.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f06f5f",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 세션을 서버에서 넣어주면 클라 첫 렌더의 /api/auth/session fetch 깜빡임이 없다.
  const session = await auth();
  return (
    <SessionProvider session={session}>
      <html lang="ko" suppressHydrationWarning>
        <body suppressHydrationWarning>
          {children}
          <OrientationGate />
          <PwaSetup />
        </body>
      </html>
    </SessionProvider>
  );
}
