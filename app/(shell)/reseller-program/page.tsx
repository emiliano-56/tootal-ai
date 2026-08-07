'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Zap, Target, TrendingUp, Users, Award, BookOpen } from 'lucide-react'

export default function ResellerPage() {
  const router = useRouter()

  const features = [
    { icon: Zap, title: "What You'll Promote", text: "ComicTale AI empowers content creators, agencies, and entrepreneurs to generate stunning comic books, animated videos, educational content, and more using advanced AI technology.", gradient: "from-blue-500 to-indigo-600" },
    { icon: TrendingUp, title: "Why ComicTale AI?", text: "High-demand AI content tool with recurring revenue potential. Help content creators, publishers, educators, and businesses unlock unlimited creative possibilities.", gradient: "from-purple-500 to-fuchsia-600" },
    { icon: Award, title: "100% Commission", text: "Keep every penny from your sales. No hidden fees, no deductions. Once approved, you earn 100% on every qualified customer you bring.", gradient: "from-amber-400 to-orange-500" },
    { icon: Users, title: "Join Our Network", text: "Get your unique affiliate link through Launchpad JV. Track every referral automatically and watch your earnings grow.", gradient: "from-pink-500 to-rose-600" },
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
          className="relative overflow-hidden rounded-[28px] px-8 py-14 mb-12 shadow-[0_20px_60px_-15px_rgba(29,78,216,0.35)]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 15%, rgba(125,211,252,0.45), transparent 45%), radial-gradient(circle at 88% 90%, rgba(59,130,246,0.4), transparent 50%), linear-gradient(120deg, #1e40af 0%, #1d4ed8 50%, #2563eb 100%)',
          }}
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-5 relative z-10">
            ComicTale AI
            <span className="block bg-gradient-to-r from-white via-sky-100 to-blue-200 bg-clip-text text-transparent">
              Reseller Program
            </span>
          </h1>
          <p className="text-lg text-blue-50/85 max-w-2xl relative z-10">
            Partner with us and earn 100% commissions by sharing the power of AI-generated comic content with your audience.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
          {features.map((feature, i) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 rounded-2xl p-7 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                style={{ animationDelay: `${i * 80}ms`, animationDuration: '450ms' }}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
                    <Icon className="text-white" size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-black mb-1.5">{feature.title}</h3>
                    <p className="text-gray-500 text-sm">
                      {feature.text}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* How It Works */}
        <div className="mb-12 bg-white border border-gray-100 shadow-sm rounded-3xl p-8">
          <h2 className="text-2xl font-bold text-black mb-8 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <BookOpen className="text-blue-600" size={20} />
            </div>
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: 1, title: "Get Approved", text: "Request your affiliate link and join our growing reseller network." },
              { step: 2, title: "Promote & Share", text: "Share your unique link with your audience via email, social, or content." },
              { step: 3, title: "Earn 100%", text: "Earn full commission on every sale tracked through your link." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="inline-flex w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full items-center justify-center font-bold text-lg mb-4 shadow-md shadow-blue-500/25">
                  {item.step}
                </div>
                <h4 className="font-bold text-black mb-1.5">{item.title}</h4>
                <p className="text-gray-500 text-sm">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits Highlight */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-8">
            <h3 className="text-xl font-bold text-black mb-5">Your Benefits</h3>
            <ul className="space-y-3.5">
              {['100% commission on every sale', 'No recurring billing or hidden fees', 'Unique affiliate tracking link', 'Marketing materials provided', 'Dedicated reseller support', 'Recurring revenue potential'].map((benefit, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0"></div>
                  <span className="text-gray-600 text-sm">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-8">
            <h3 className="text-xl font-bold text-black mb-3">Target Audience</h3>
            <p className="text-gray-500 mb-5 text-sm">
              Perfect for promoting to content creators, publishing agencies, educators, freelancers, digital marketers, and anyone looking to generate high-quality comic content at scale.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Content Creators', 'Agencies', 'Publishers', 'Educators', 'Marketers', 'Entrepreneurs'].map((tag, i) => (
                <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-12 text-center">
          <h2 className="text-2xl font-bold text-black mb-3">
            Ready to Start Earning?
          </h2>
          <p className="text-gray-500 mb-8 max-w-2xl mx-auto">
            Join the ComicTale AI Reseller Program today and start building recurring revenue by sharing the most powerful AI content generation tool with your network.
          </p>
          <button
            onClick={() => window.open('https://launchpadjv.com', '_blank')}
            className="inline-block px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:-translate-y-0.5"
          >
            Request Your Affiliate Link
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
