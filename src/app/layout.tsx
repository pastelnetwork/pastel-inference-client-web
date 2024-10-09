// src/app/layout.tsx

import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { Montserrat } from 'next/font/google'

export const metadata: Metadata = {
  title: 'Pastel Inference Client',
  description: 'Modern Next.js 14 Pastel Inference Client',
}

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700']
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@sira-ui/tailwind/dist/css/styles.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.1/styles/default.min.css" />
      </head>
      <body className={montserrat.className} suppressHydrationWarning={true}>
        {children}
        <Script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js" strategy="beforeInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.6.0/jszip.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.1/highlight.min.js" strategy="beforeInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.1/languages/json.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.min.js" strategy="beforeInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/js-sha3/0.9.3/sha3.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/gh/MarketingPipeline/Markdown-Tag/markdown-tag.js" strategy="beforeInteractive" />
      </body>
    </html>
  )
}