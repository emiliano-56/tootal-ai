'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Gift, FileText } from 'lucide-react'
import { Footer } from '@/components/footer'

export default function DFYPromptsPage() {
  const router = useRouter()

  const handleBonusClick = () => {
    window.open('https://cachua.fun/toontaleai-bonuspack', '_blank')
  }

  const handleDownloadPLR = () => {
    const link = document.createElement('a')
    link.href = '/policy.pdf'
    link.download = 'policy.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 mb-6 px-4 py-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 transition-colors text-black font-medium text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </button>

            <div className="space-y-1">
              <h1 className="text-3xl font-extrabold text-black">
                Bonus Resources
              </h1>

              <p className="text-gray-500">
                Access your exclusive bonus resources and download important documents.
              </p>
            </div>
          </div>

          {/* Cards Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">

            {/* Bonus Card */}
            <div className="bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-3xl p-10 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
                <Gift className="w-9 h-9 text-white" />
              </div>

              <h2 className="text-xl font-bold text-black mb-2">
                Exclusive Bonus
              </h2>

              <p className="text-gray-500 mb-6 text-sm">
                Click below to access your bonus materials and special resources.
              </p>

              <button
                onClick={handleBonusClick}
                className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold transition-all shadow-md shadow-blue-500/25"
              >
                Open Bonus
              </button>
            </div>

            {/* PLR License Card */}
            <div className="bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-3xl p-10 text-center animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/25">
                <FileText className="w-9 h-9 text-white" />
              </div>

              <h2 className="text-xl font-bold text-black mb-2">
                PLR License Policy
              </h2>

              <p className="text-gray-500 mb-6 text-sm">
                Download the Private Label Rights (PLR) License Policy PDF document.
              </p>

              <button
                onClick={handleDownloadPLR}
                className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white font-semibold transition-all shadow-md shadow-purple-500/25"
              >
                Download PDF
              </button>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}