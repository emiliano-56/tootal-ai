import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { MobileNavProvider } from '@/components/mobile-nav-context'

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="text-foreground min-h-screen"
      style={{
        backgroundImage:
          'radial-gradient(circle at 100% 0%, rgba(219,234,254,0.7), transparent 40%), radial-gradient(circle at 0% 20%, rgba(252,231,243,0.5), transparent 35%)',
        backgroundColor: '#f8fafc',
      }}
    >
      <MobileNavProvider>
        <Sidebar />
        <Header />

        <div className="pt-16 md:pl-64 flex w-full">
          <main className="flex-1 w-full min-w-0">{children}</main>
        </div>
      </MobileNavProvider>
    </div>
  )
}
