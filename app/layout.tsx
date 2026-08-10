import type { Metadata } from "next"
import { Fredoka, Plus_Jakarta_Sans } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
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
  title: "ComicAgent AI - AI Comics & Coloring Creator",
  description:
    "Create amazing school comics and coloring pages with AI. Perfect for kids, parents, teachers and content creators.",

  // ✅ Favicon using your external image URL
  icons: {
    // Absolute: a relative path resolves against the current route, so
    // /admin would request /admin/nlogo2.png and 404.
    icon: "/nlogo2.png",
  },

  openGraph: {
    title: "ComicAgent AI",
    description:
      "AI-powered comics and coloring page generator for creators and educators.",
    url: "https://your-domain.com",
    siteName: "ComicAgent AI",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "ComicAgent AI",
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
    <html lang="en" className={`${fredoka.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        {/* defaultTheme light so the existing dashboard looks unchanged until
            someone opts into dark; enableSystem honours an OS preference. */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
