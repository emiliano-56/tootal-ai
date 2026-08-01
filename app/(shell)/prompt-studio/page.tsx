import { PromptStudio } from '@/components/prompt-studio'

export const metadata = {
  title: 'Prompt Studio - ComicTale AI',
  description: 'Ready-made comic prompts and an AI prompt enhancer',
}

export default function PromptStudioPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <PromptStudio />
    </div>
  )
}
