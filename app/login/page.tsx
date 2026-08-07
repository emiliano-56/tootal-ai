import { AuthLayout } from '@/components/auth/auth-layout'
import { LoginForm } from '@/components/auth/login-form'
import { getPortal } from '@/lib/auth/portals'

const portal = getPortal('login')!

export const metadata = {
  title: `${portal.title} - ComicTale AI`,
}

export default function Page() {
  return (
    <AuthLayout portal={portal}>
      <LoginForm portal={portal} />
    </AuthLayout>
  )
}
