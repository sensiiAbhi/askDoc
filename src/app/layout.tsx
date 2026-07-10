import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocAsk - Interactive Document Q&A",
  description: "Upload any document (PDF, Word, or Text file) and interactively ask questions based on its content using Gemini.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
