import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import AntdPatchProvider from "@/components/providers/AntdPatchProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Core Extract - Document Processing Platform",
  description:
    "Professional document extraction and processing platform with AI-powered structured data extraction",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AntdPatchProvider>
        <AuthProvider>
          <OrganizationProvider>{children}</OrganizationProvider>
        </AuthProvider>
        </AntdPatchProvider>
      </body>
    </html>
  );
}
