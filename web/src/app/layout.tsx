import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookQuick",
  description: "Get notified the instant movie ticket booking opens.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
