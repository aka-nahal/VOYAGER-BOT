import type React from "react"
import type { Metadata } from "next"
import { GeistMono } from "geist/font/mono"
import { RobotSocketProvider } from "@/lib/robot-socket"
import "./globals.css"

export const metadata: Metadata = {
  title: "Vogayer Bot - Control Interface",
  description: "Advanced autonomous robot control and telemetry system",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Vogayer Bot" />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className={`${GeistMono.className} bg-black text-white antialiased overflow-hidden`}>
        <RobotSocketProvider>{children}</RobotSocketProvider>
      </body>
    </html>
  )
}
