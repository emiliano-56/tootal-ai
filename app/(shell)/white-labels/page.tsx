'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Lock, Server, Palette, FileText, Clock, Download } from 'lucide-react'

export default function WhiteLabelPage() {
  const router = useRouter()

  const included = [
    { icon: Server, title: "Deployable Backend", text: "Optimized Python backend files for easy hosting configuration and reliable server-side operations.", gradient: "from-blue-500 to-indigo-600" },
    { icon: Palette, title: "Customizable Frontend", text: "Compiled Next js frontend build files with dynamic branding variables for full customization.", gradient: "from-purple-500 to-fuchsia-600" },
    { icon: FileText, title: "Setup Guides", text: "Step-by-step custom domain mapping and DNS configuration guides for seamless deployment.", gradient: "from-amber-400 to-orange-500" },
    { icon: Palette, title: "Full Branding Control", text: "Deploy under your own custom domain, apply your own branding, logos, and color schemes.", gradient: "from-pink-500 to-rose-600" },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 md:px-8 py-6 bg-white">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-black font-medium text-sm"
        >
          <ArrowLeft size={18} />
          Back to Home
        </button>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-12">
        {/* Hero Section */}
        <div
          className="relative overflow-hidden rounded-[28px] px-8 py-14 mb-10 shadow-[0_20px_60px_-15px_rgba(29,78,216,0.35)]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 15%, rgba(125,211,252,0.45), transparent 45%), radial-gradient(circle at 88% 90%, rgba(59,130,246,0.4), transparent 50%), linear-gradient(120deg, #1e40af 0%, #1d4ed8 50%, #2563eb 100%)',
          }}
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-5 relative z-10">
            ComicTale AI
            <span className="block bg-gradient-to-r from-white via-sky-100 to-blue-200 bg-clip-text text-transparent">
              White Label Panel
            </span>
          </h1>
          <p className="text-lg text-blue-50/85 max-w-2xl relative z-10">
            Deploy ComicTale AI under your own custom domain, brand, and logos. Launch your own AI content generation platform.
          </p>
        </div>

        {/* Status Banner */}
        <div className="mb-10 bg-white border border-gray-100 shadow-sm rounded-2xl p-7">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/25">
              <Clock className="text-white" size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-black">Release Coming Soon</h2>
              <p className="text-gray-500 mt-1 text-sm">White label code will be available after our Launch Weekend is completed.</p>
            </div>
          </div>
        </div>

        {/* What's Included */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-black mb-6">What is Included in the White Label Package?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {included.map((item, i) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 rounded-2xl p-7 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                  style={{ animationDelay: `${i * 80}ms`, animationDuration: '450ms' }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
                      <Icon className="text-white" size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-black mb-1.5">{item.title}</h3>
                      <p className="text-gray-500 text-sm">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Download Section */}
        <div className="mb-10 bg-white border border-gray-100 shadow-sm rounded-3xl p-10">
          <h2 className="text-xl font-bold text-black mb-3">White Label Code &amp; Deployment</h2>
          <p className="text-gray-500 mb-6 text-sm">
            The white label code/ZIP will be provided for download after our Launch Weekend is completed. Please check back soon — once it&apos;s live, the download option will appear here.
          </p>

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
                  <Download className="text-gray-400" size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-black text-sm">whitelabel-installer-v1.0.0.zip</h4>
                  <p className="text-xs text-gray-500">Available after Launch Weekend</p>
                </div>
              </div>
              <button
                disabled
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-200 text-gray-500 rounded-xl font-semibold text-sm cursor-not-allowed"
              >
                <Lock size={16} />
                Download Locked
              </button>
            </div>
          </div>

          <p className="text-gray-400 text-xs">
            Check back after our Launch Weekend event for access to the complete white label deployment package.
          </p>
        </div>

        {/* Benefits Section */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-black mb-6">Why Choose White Label?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: Palette, title: "Complete Control", text: "Fully branded experience with your own domain and branding.", gradient: "from-blue-500 to-indigo-600" },
              { icon: Server, title: "Easy Deployment", text: "Pre-configured backend and frontend with simple setup guides.", gradient: "from-purple-500 to-fuchsia-600" },
              { icon: FileText, title: "Full Documentation", text: "Comprehensive guides for domain mapping and configuration.", gradient: "from-pink-500 to-rose-600" },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="bg-white border border-gray-100 shadow-sm rounded-2xl p-7 text-center">
                  <div className={`inline-flex w-14 h-14 bg-gradient-to-br ${item.gradient} rounded-2xl items-center justify-center mb-4 shadow-md`}>
                    <Icon className="text-white" size={26} />
                  </div>
                  <h4 className="font-bold text-black mb-1.5">{item.title}</h4>
                  <p className="text-gray-500 text-sm">{item.text}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-12 text-center">
          <h2 className="text-2xl font-bold text-black mb-3">
            Ready to Launch Your Platform?
          </h2>
          <p className="text-gray-500 mb-8 max-w-2xl mx-auto">
            Stay tuned for the Launch Weekend event when the white label package becomes available. Sign up to be notified when downloads are ready.
          </p>
          <button
            disabled
            className="inline-block px-10 py-4 bg-gray-200 text-gray-500 font-bold text-lg rounded-xl cursor-not-allowed"
          >
            Coming Soon
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-gray-200">
          <p className="text-gray-500 mb-1">Questions? We&apos;re here to help.</p>
          <p className="text-black font-semibold">Team ComicTale AI</p>
        </div>
      </main>
    </div>
  )
}
