import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Commonplace — A little space for everything",
  description:
    "Your personal notebook, with a thoughtful assistant. Capture ideas, find connections, and make room for what matters.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
