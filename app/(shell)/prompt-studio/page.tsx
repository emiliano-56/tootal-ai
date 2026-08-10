import { PromptStudio } from '@/components/prompt-studio'
import { UsageBadge } from '@/components/usage-badge'

export const metadata = {
  title: 'Prompt Studio - ComicAgent AI',
  description: 'Ready-made comic prompts and an AI prompt enhancer',
}

export default function PromptStudioPage() {
  return (
    <div className="w-full p-6 md:p-8">
      {/* Visible before anyone starts, so the limit is not a surprise. */}
      <div className="flex justify-end mb-3">
        <UsageBadge feature="prompt-studio" />
      </div>

      <PromptStudio />
    </div>
  )
}
