import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "雾会记得 - The Fog Remembers",
  description: "原创心理恐怖 roguelite：在灰洄镇的雾中下沉、搜证、完成仪式并活下去。",
};

// 禁用双指缩放/双击缩放，避免触控摇杆与按键操作时误触发页面缩放
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
