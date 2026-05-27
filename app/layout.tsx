import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4000";
const title = "우리 책장";
const description = "PDF를 업로드해서 책처럼 넘겨 볼 수 있는 어린이 그림책 뷰어";
const socialImage = "/social-thumbnail.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${title} — PDF 그림책 뷰어`,
  description,
  openGraph: {
    title,
    description,
    url: "/",
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
