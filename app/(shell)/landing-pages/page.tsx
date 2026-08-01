import { LandingBuilder } from '@/components/landing-builder'

export const metadata = {
  title: 'Landing Page Builder - ComicTale AI',
  description: 'Generate a complete sales page for any product',
}

export default function LandingPagesPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <LandingBuilder />
    </div>
  )
}
