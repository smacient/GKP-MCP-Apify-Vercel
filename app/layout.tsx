import type { Metadata } from 'next'
import './global.css'

export const metadata: Metadata = {
  title: 'GKP MCP Authentication',
  description: 'Connect your Google Keyword Planner and Apify accounts',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
