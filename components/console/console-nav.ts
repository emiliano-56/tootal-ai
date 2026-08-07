import {
  LayoutDashboard,
  Users,
  Package,
  Palette,
  Layers,
  Cpu,
  Mail,
  FileText,
  Megaphone,
  Contact,
  Send,
  Globe,
  ScrollText,
  Settings,
  BarChart3,
  Webhook,
  Share2,
} from 'lucide-react'
import type { Role, Permission } from '@/lib/auth/rbac'
import { can, HOME_ROUTE } from '@/lib/auth/rbac'

/**
 * Console navigation.
 *
 * One menu definition for all three consoles: each entry declares the
 * permission it needs, and `navFor` filters. Adding a screen means adding one
 * row here rather than editing three sidebars that then drift apart.
 */

export interface NavItem {
  label: string
  href: string
  icon: typeof Users
  permission?: Permission
  badge?: string
}

export interface NavGroup {
  heading?: string
  items: NavItem[]
}

function base(role: Role): string {
  return HOME_ROUTE[role]
}

export function navFor(role: Role): NavGroup[] {
  const root = base(role)

  const groups: NavGroup[] = [
    {
      items: [{ label: 'Overview', href: root, icon: LayoutDashboard }],
    },
    {
      heading: 'Accounts',
      items: [
        { label: 'Users', href: `${root}/users`, icon: Users, permission: 'users.read.own_tenant' },
        {
          label: 'Bundle Users',
          href: `${root}/bundle-users`,
          icon: Package,
          permission: 'plans.manage',
        },
        { label: 'Plans', href: `${root}/plans`, icon: Layers, permission: 'plans.manage' },
        { label: 'IPN', href: `${root}/ipn`, icon: Webhook, permission: 'plans.manage' },
      ],
    },
    {
      heading: 'Platform',
      items: [
        { label: 'AI Providers', href: `${root}/providers`, icon: Cpu, permission: 'apis.manage' },
        { label: 'SMTP', href: `${root}/smtp`, icon: Mail, permission: 'smtp.manage' },
        {
          label: 'Email Templates',
          href: `${root}/templates`,
          icon: FileText,
          permission: 'email_templates.manage',
        },
        {
          label: 'Broadcasts',
          href: `${root}/broadcasts`,
          icon: Megaphone,
          permission: 'leads.manage',
        },
        { label: 'Settings', href: `${root}/settings`, icon: Settings, permission: 'settings.manage' },
        {
          label: 'Social apps',
          href: `${root}/social`,
          icon: Share2,
          permission: 'settings.manage',
        },
      ],
    },
    {
      heading: 'Branding',
      items: [
        {
          label: 'Brand',
          href: `${root}/branding`,
          icon: Palette,
          permission: 'branding.manage',
        },
        { label: 'Domains', href: `${root}/domains`, icon: Globe, permission: 'domains.manage' },
      ],
    },
    {
      heading: 'Data',
      items: [
        { label: 'Leads', href: `${root}/leads`, icon: Contact, permission: 'leads.manage' },
        {
          label: 'Autoresponders',
          href: `${root}/autoresponders`,
          icon: Send,
          permission: 'leads.manage',
        },
        {
          label: 'Analytics',
          href: `${root}/analytics`,
          icon: BarChart3,
          permission: 'analytics.view.own_tenant',
        },
        {
          label: 'Audit Logs',
          href: `${root}/audit`,
          icon: ScrollText,
          permission: 'audit_logs.view',
        },
      ],
    },
  ]

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || can(role, item.permission)),
    }))
    .filter((group) => group.items.length > 0)
}
