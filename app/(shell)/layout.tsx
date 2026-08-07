import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { MobileNavProvider } from '@/components/mobile-nav-context'
import { GenerationConfigProvider } from '@/components/generation-config'
import { resolveGenerationBackend } from '@/lib/ai/generation-backend'
import { EntitlementsProvider } from '@/components/entitlements-context'
import { entitlementsFor } from '@/lib/plans/server'
import { getSessionContext } from '@/lib/supabase/server'

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Resolved once per render on the server, so generation pages get the
  // superadmin-configured backend without each one fetching it.
  const [{ url }, session] = await Promise.all([
    resolveGenerationBackend(),
    getSessionContext(),
  ])

  // Resolved here rather than per page, so the header, sidebar and every
  // generate button read the same numbers.
  const entitlements = session
    ? await entitlementsFor(session.userId)
    : { limits: {}, usage: {}, plans: [], unlocked: [] }

  return (
    <div
      className="text-foreground min-h-screen"
      style={{
        backgroundImage:
          'radial-gradient(circle at 100% 0%, rgba(219,234,254,0.7), transparent 40%), radial-gradient(circle at 0% 20%, rgba(252,231,243,0.5), transparent 35%)',
        backgroundColor: '#f8fafc',
      }}
    >
      <GenerationConfigProvider url={url}>
        <EntitlementsProvider value={entitlements}>
          <MobileNavProvider>
            <Sidebar />
            <Header />

            <div className="pt-16 md:pl-64 flex w-full">
              <main className="flex-1 w-full min-w-0">{children}</main>
            </div>
          </MobileNavProvider>
        </EntitlementsProvider>
      </GenerationConfigProvider>
    </div>
  )
}
