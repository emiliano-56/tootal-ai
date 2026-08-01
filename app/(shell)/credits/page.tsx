'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Zap, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/db'
import { Footer } from '@/components/footer'

interface UserProfile {
  credits: number
  plans: string
  email: string
}

const availablePlans = [
  {
    name: 'Comic Tale AI FE',
    price: '$19-$27',
    type: 'FE',
    url: 'https://comictale.fun/fe',
    features: [
      'Books, Videos, Rhymes, Printables, Characters & Tutors — All Together',
      'MOVE FROM CREATOR MODE TO OWNER MODE - Stop Posting Randomly. Start Owning Comic Assets',
      'BUILT FOR REPEAT SELLING - NOT ONE-TIME WORK - Generate assets once and monetize repeatedly.',
    ],
  },
  {
    name: 'Comic Tale AI Unlimited',
    price: '$67',
    type: 'OTO 1',
    url: 'https://comictale.fun/oto1',
    features: [
      'Remove all limits and fully unlock ComicEmpire AI for nonstop growth',
      'Create unlimited kids content businesses without caps or blocks',
      'Manage unlimited workspaces for projects and clients',
      'Launch unlimited kids websites from one dashboard',
      'Connect unlimited custom domains for you or your clients',
      'Generate unlimited Comic storybooks with voice and storytelling',
      'Create unlimited animated kids videos',
      'Publish unlimited kids blog posts with age-appropriate content',
      'Generate unlimited multi-language content',
      'Unlimited storage and bandwidth',
      'Unlock an unlimited commercial license and keep 100% of profits',
    ],
  },
  {
    name: 'Comic Tale AI DFY',
    price: '$77',
    type: 'OTO 2',
    url: 'https://comictale.fun/oto2',
    features: [
      'Our Experts pre-builds 10 complete Comic Empires for you — no setup required',
      'Each empire includes a fully branded kids website, ready to publish',
      'We select high-demand, buyer-ready niches based on real market trends',
      'Every niche comes loaded with storybooks, videos, rhymes, printables & tutors',
      'You get sell-ready kids content — not empty templates',
      'All empires are editable, reusable & built to scale',
      'Structured for Amazon KDP, Etsy, Gumroad & YouTube Comic publishing',
      'Backed by our 30-Day Risk-Free Money-Back Guarantee',
    ],
  },
  {
    name: 'Comic Tale AI Traffic',
    price: '$47',
    type: 'OTO 3',
    url: 'https://comictale.fun/oto3',
    features: [
      '100% FREE Organic Traffic System — No paid ads needed',
      'Targeted Audience Traffic — Drive ready-to-buy visitors to boost daily sales',
      'Keyword-Focused SEO Setup — Optimized for better visibility',
      'SEO-Ready Blog Structure — Built to pull free Google traffic',
      'Built-In Lead Capture Flow — Turn visitors into subscribers',
      'Monetization Button Optimization — Buy buttons placed strategically',
      'Viral Social Sharing System — Instantly share books, videos, blogs & more',
      'Pabbly Connect Integration — Auto-send leads to 2,000+ autoresponders',
      'Promote your own offers or affiliate links',
    ],
  },
  {
    name: 'Comic Tale AI Enterprise',
    price: '$77',
    type: 'OTO 4',
    url: 'https://comictale.fun/oto4',
    features: [
      'Advanced CRM & Lead Tracking to monitor, segment, and convert leads easily',
      'Multiple AI Comic Tutor Agents so you can create different branded learning assistants',
      'Pro Website Controls with hero sliders, CTAs, custom forms, and full layout flexibility',
      'Unlimited Lead Capture with Smart Follow-Ups that keep engaging visitors automatically',
      'Advanced Forms, Popups & Conversion Boosters to turn more visitors into subscribers',
      'Drag & Drop Video Timeline Editor giving you full creative control',
      'Video Merging & Storytelling Mode to combine scenes into smooth, engaging stories',
      'Visual Effects, Text Animations & Animated CTAs to make content more interactive',
      'AI Script Sync with Voice & Subtitles so everything stays perfectly aligned',
      'HD, 4K, Portrait, Square & Reel-Ready Exports for every major platform',
      'Brand Customization with your own logo and brand colors across all assets',
      'Layer Manager & Version Control to manage edits safely',
    ],
  },
  {
    name: 'Comic Tale AI Agency',
    price: '$97-$167',
    type: 'OTO 5',
    url: 'https://comictale.fun/oto5',
    features: [
      'Agency License to Serve 100 / Unlimited Clients & add 100 / Unlimited team members',
      'Sell It To Anyone You Want And Keep 100% Of The Profits in Your Pocket',
      'No Product, Sales Page, Marketing Material Creation Needed',
      'Quick start - Software Business in 3 Simple Steps & Keep 100% Profit',
    ],
  },
  {
    name: 'Comic Tale AI MegaSuite',
    price: '$197',
    type: 'OTO 6',
    url: 'https://comictale.fun/oto6',
    features: [
      'All features from previous tiers combined',
      'Advanced analytics and reporting dashboard',
      'Priority support and dedicated account manager',
      'Custom integration options for your business needs',
      'Regular monthly feature updates and enhancements',
      'Advanced A/B testing and optimization tools',
      'White-label solutions available',
      'Enterprise-level security and compliance',
    ],
  },
]

export default function MyCreditsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)

  const [profile, setProfile] = useState<UserProfile>({
    credits: 0,
    plans: 'Free Plan',
    email: '',
  })

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const { data, error } = await supabase
          .from('profiles')
          .select('credits, plans, email')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('[v0] Profile fetch error:', error)
          return
        }

        if (data) {
          setProfile({
            credits: Number(data.credits || 0),
            plans: data.plans || 'Free Plan',
            email: data.email || '',
          })
        }
      } catch (error) {
        console.error('[v0] Credits page error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  const filteredPlans = availablePlans.filter(
    (plan) => plan.name !== profile.plans
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">

          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 mb-6 px-4 py-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 transition-colors text-black font-medium text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>

            <div>
              <h1 className="text-3xl font-extrabold text-black mb-1">
                My Credits
              </h1>

              <p className="text-gray-500">
                Manage your credits and view available ComicTale AI plans.
              </p>
            </div>
          </div>

          {/* Current Balance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">

            {/* Credits Card */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-7 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/25">
                  <Zap className="w-7 h-7 text-white" />
                </div>

                <div>
                  <p className="text-gray-500 text-sm font-medium">
                    Available Credits
                  </p>

                  <h2 className="text-4xl font-extrabold text-black">
                    {loading ? '...' : profile.credits}
                  </h2>
                </div>
              </div>

              <p className="text-gray-500 text-sm">
                Your available balance for generating comics, storybooks, and coloring pages.
              </p>
            </div>

            {/* Current Plan */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-7 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25">
                  <CheckCircle className="w-7 h-7 text-white" />
                </div>

                <div>
                  <p className="text-gray-500 text-sm font-medium">
                    Current Plan
                  </p>

                  <h2 className="text-2xl font-bold text-black">
                    {loading ? 'Loading...' : profile.plans}
                  </h2>
                </div>
              </div>

              <p className="text-gray-500 text-sm">
                This is your currently active ComicTale AI plan.
              </p>
            </div>
          </div>

          {/* Available Plans */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-black mb-1">
              Available Plans
            </h2>

            <p className="text-gray-500">
              Upgrade your ComicTale AI experience with more credits and exclusive bonuses.
            </p>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {filteredPlans.map((plan, index) => (
              <div
                key={index}
                className="bg-white border border-gray-100 shadow-sm rounded-2xl p-7 hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                style={{ animationDelay: `${Math.min(index, 6) * 70}ms`, animationDuration: '450ms' }}
              >
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700">
                      {plan.type}
                    </span>

                    <span className="text-2xl font-extrabold text-black">
                      {plan.price}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-black">
                    {plan.name}
                  </h3>
                </div>

                <div className="space-y-3 mb-7">
                  {plan.features.map((feature, featureIndex) => (
                    <div
                      key={featureIndex}
                      className="flex items-start gap-3"
                    >
                      <CheckCircle className="w-4.5 h-4.5 text-emerald-500 mt-0.5 shrink-0" />

                      <p className="text-gray-600 text-sm">
                        {feature}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() =>
                    window.open(plan.url, '_blank')
                  }
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold transition-all shadow-md shadow-blue-500/25"
                >
                  Upgrade Now
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

