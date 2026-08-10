import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { MobileNavProvider } from '@/components/mobile-nav-context'
import { GenerationConfigProvider } from '@/components/generation-config'
import { resolveGenerationBackend } from '@/lib/ai/generation-backend'
import { EntitlementsProvider } from '@/components/entitlements-context'
import { entitlementsFor } from '@/lib/plans/server'
import { getSessionContext } from '@/lib/supabase/server'
import { policyInputFor } from '@/lib/ai/policy.server'
import { canUsePersonalKeys } from '@/lib/ai/policy'
import { LocaleProvider } from '@/components/locale-provider'

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
  // Resolved here too, so the sidebar can hide the personal-keys screen
  // without every page paying for a request to find out.
  const [entitlements, personalKeys] = session
    ? await Promise.all([
        entitlementsFor(session.userId),
        policyInputFor(session.userId, session.apiPolicy).then(canUsePersonalKeys),
      ])
    : [{ limits: {}, usage: {}, plans: [], unlocked: [] }, false]

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
        <EntitlementsProvider value={{ ...entitlements, personalKeys }}>
          <LocaleProvider>
          <MobileNavProvider>
            <Sidebar />
            <Header />

            {/* ps-, not pl-: the sidebar moves to the right in an RTL locale
                and the content has to make room on that side instead. */}
            <div className="pt-16 md:ps-64 flex w-full">
              <main className="flex-1 w-full min-w-0">{children}</main>
            </div>
          </MobileNavProvider>
          </LocaleProvider>
        </EntitlementsProvider>
      </GenerationConfigProvider>
    </div>
  )
}
