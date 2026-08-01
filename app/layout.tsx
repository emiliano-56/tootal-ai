import type { Metadata } from "next"
import { Fredoka, Plus_Jakarta_Sans } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

// Display face — rounded and playful, used for headings and numbers.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
})

// Body face — modern and highly legible for UI copy.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
})

export const metadata: Metadata = {
  title: "ComicTale AI - AI Comics & Coloring Creator",
  description:
    "Create amazing school comics and coloring pages with AI. Perfect for kids, parents, teachers and content creators.",

  // ✅ Favicon using your external image URL
  icons: {
    icon: "nlogo2.png",
  },

  openGraph: {
    title: "ComicTale AI",
    description:
      "AI-powered comics and coloring page generator for creators and educators.",
    url: "https://your-domain.com",
    siteName: "ComicTale AI",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "ComicTale AI",
    description:
      "Create comics and coloring pages instantly with AI.",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${fredoka.variable} ${jakarta.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
