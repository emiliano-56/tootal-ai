import { MyApiKeys } from '@/components/my-api-keys'

export const metadata = {
  title: 'My AI Keys - ComicAgent AI',
  description: 'Run generation on your own AI provider key',
}

export default function ApiKeysPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-slate-900">My AI Keys</h1>
        <p className="text-sm text-slate-500 mt-1">
          Use your own AI provider key instead of the platform’s.
        </p>
      </div>

      <MyApiKeys />
    </div>
  )
}
