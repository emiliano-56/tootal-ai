import { CharacterStudio } from '@/components/character-studio'

export const metadata = {
  title: 'Character Studio - ComicAgent AI',
  description: 'Draw a character once and reuse them across every comic',
}

export default function CharactersPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <CharacterStudio />
    </div>
  )
}
