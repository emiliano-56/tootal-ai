"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Footer } from "@/components/footer"
import { Film, ArrowLeft, Save, Download, X, Check, Volume2, VolumeX, Sparkles, Search, Plus } from "lucide-react"
import { useGenerationUrl } from '@/components/generation-config'
import { consumeFeature } from '@/lib/plans/use-feature'

import { usePromptPrefill } from '@/lib/dfy/use-prefill'
import { useLibrarySave } from '@/components/use-library-save'
export default function Page() {
  const generationUrl = useGenerationUrl()

  // The keep-limit, the full-library dialog and Drive backup all live here.
  const library = useLibrarySave()

  const [currentStep, setCurrentStep] = useState(1)
  const [description, setDescription] = useState("")

  // Arriving from a DFY pack with a rhyme or video script.
  usePromptPrefill(setDescription)
  const [aspectRatio, setAspectRatio] = useState("16:9")
  // Must match an entry in `niches` exactly so the chip shows as selected.
  const [niche, setNiche] = useState("Technology")
  const [customNiche, setCustomNiche] = useState("")
  const [audio, setAudio] = useState(true)
  const [loading, setLoading] = useState(false)
  const [videoUrl, setVideoUrl] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [savedVideoUrl, setSavedVideoUrl] = useState("")
  const [downloadModal, setDownloadModal] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [downloading, setDownloading] = useState(false)
  const [nicheQuery, setNicheQuery] = useState("")

const niches = [
  "AI & Artificial Intelligence",
  "Technology",
  "Business",
  "Finance",
  "Investing",
  "Cryptocurrency",
  "Real Estate",
  "Marketing",
  "Digital Marketing",
  "Affiliate Marketing",
  "E-commerce",
  "Sales",
  "Startups",
  "Productivity",
  "Self Improvement",
  "Motivation",
  "Success Mindset",
  "Leadership",
  "Education",
  "Online Courses",
  "History",
  "Science",
  "Space",
  "Psychology",
  "Health",
  "Fitness",
  "Nutrition",
  "Mental Health",
  "Beauty",
  "Fashion",
  "Travel",
  "Nature",
  "Wildlife",
  "Food",
  "Cooking",
  "Recipes",
  "Parenting",
  "Relationships",
  "Lifestyle",
  "Luxury",
  "Cars",
  "Motorcycles",
  "Sports",
  "Gaming",
  "Anime",
  "Movies",
  "Entertainment",
  "Music",
  "Celebrities",
  "Books",
  "Storytelling",
  "Horror Stories",
  "True Crime",
  "Mystery",
  "Fantasy",
  "Religion",
  "Spirituality",
  "News",
  "Politics",
  "Environment",
  "Climate",
  "DIY & Crafts",
  "Home Improvement",
  "Interior Design",
  "Photography",
  "Art",
  "Graphic Design",
  "Programming",
  "Cybersecurity",
  "Web Development",
  "Mobile Apps",
  "Software Reviews",
  "Product Reviews",
  "Unboxing",
  "Tutorials",
  "How-To Guides",
  "Pets",
  "Agriculture",
  "Kids",
  "Comedy",
  "Memes",
  "Quotes",
  "Inspirational Stories",
  "Animated Explainers",
  "Corporate",
  "Small Business",
  "Local Business",
  "Non-Profit",
  "Events",
  "Holiday",
  "Wedding",
  "Custom"
];
  const buildPrompt = () => {
    const selectedNiche = niche === "Custom" ? customNiche : niche
    return `${description}\nNiche: ${selectedNiche}`
  }

  const handleGenerate = async () => {
    // Spend one of this month's allowance before doing any work.
    const allowance = await consumeFeature('video')

    if (!allowance.ok) {
      setError(allowance.error ?? 'Monthly limit reached')
      return
    }

    if (!description) {
      setError("Please describe what you want to create")
      return
    }

    if (niche === "Custom" && !customNiche) {
      setError("Please enter a custom niche")
      return
    }

    setLoading(true)
    setError("")
    setVideoUrl("")

    try {
      const res = await fetch(generationUrl("text-video/generate-video"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: buildPrompt(),
          audio,
          aspect_ratio: aspectRatio,
          duration_type: "8s",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || "Generation failed")
      }

      setVideoUrl(data.download_url)
      setCurrentStep(6)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canProceedToStep2 = description.trim() !== ""
  const canProceedToStep4 = niche !== "Custom" || (niche === "Custom" && customNiche.trim() !== "")

  const getVideoBlob = async () => {
    const response = await fetch(videoUrl)

    if (!response.ok) {
      throw new Error("Unable to fetch video")
    }

    return await response.blob()
  }

  const handleSaveVideo = async () => {
    if (!videoUrl) {
      setError("No video available")
      return
    }

    try {
      setSaving(true)
      setError("")

      // 1. Check authenticated user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error("You must be logged in to save videos")
      }

      // 2. Get video blob using reusable helper
      const blob = await getVideoBlob()

      // 3. Convert blob into File
      const file = new File([blob], `video-${Date.now()}.mp4`, {
        type: "video/mp4",
      })

      // 4. Upload path
      const filePath = `${user.id}/${file.name}`

      // 5. Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from("video")
        .upload(filePath, file, {
          contentType: "video/mp4",
          upsert: false,
        })

      if (uploadError) {
        throw uploadError
      }

      // 6. Get URL
      const { data: publicData } = supabase.storage.from("video").getPublicUrl(filePath)

      setSavedVideoUrl(publicData.publicUrl)

      // Videos previously existed only as objects in a bucket — nothing was
      // written down, so they could not be listed, counted or backed up.
      await library.save(
        {
          kind: "video",
          title: filePath.split("/").pop() ?? "Video",
          bucket: "video",
          path: filePath,
          publicUrl: publicData.publicUrl,
          sizeBytes: file.size,
        },
        publicData.publicUrl
      )
    } catch (error: any) {
      console.log(error)
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadVideo = async () => {
    if (!videoUrl) return

    try {
      setDownloading(true)

      // Get video blob using reusable helper
      const blob = await getVideoBlob()

      // Create temporary URL
      const blobUrl = window.URL.createObjectURL(blob)

      // Create invisible anchor
      const link = document.createElement("a")

      link.href = blobUrl

      link.download = `${projectName || "My Video"}.mp4`

      document.body.appendChild(link)

      link.click()

      link.remove()

      window.URL.revokeObjectURL(blobUrl)

      setDownloadModal(false)

      setProjectName("")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  const stepLabels = ["Describe", "Aspect Ratio", "Niche", "Audio", "Generate", "Preview"]

  const trimmedNicheQuery = nicheQuery.trim()
  const filteredNiches = trimmedNicheQuery
    ? niches.filter((n) => n.toLowerCase().includes(trimmedNicheQuery.toLowerCase()))
    : niches

  // Let the typed text become the niche when it isn't one of the presets.
  const canUseTypedNiche =
    trimmedNicheQuery.length > 0 &&
    !niches.some((n) => n.toLowerCase() === trimmedNicheQuery.toLowerCase())

  const applyTypedNiche = () => {
    if (!canUseTypedNiche) return
    setNiche("Custom")
    setCustomNiche(trimmedNicheQuery)
    setNicheQuery("")
  }

return (
  <div className="min-h-full text-slate-900 flex flex-col">
    {/* HEADER */}
    <div className="sticky top-16 z-20 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
          <Film className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 leading-tight">
            AI Video Generator
          </h1>
          <p className="text-slate-500 text-xs">
            Turn an idea into a ready-to-post AI video
          </p>
        </div>
      </div>

      <a
        href="/dashboard"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 ring-1 ring-slate-200 transition rounded-xl text-sm font-semibold text-slate-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </a>
    </div>

    <div className="flex-1 px-6 py-10">

      {/* CENTER: TITLE AND SUBTITLE */}
      <div className="text-center mb-10">
        <h1 className="font-display text-3xl sm:text-[2.4rem] font-bold mb-2 text-slate-900 tracking-tight">
          Create videos in seconds
        </h1>
        <p className="text-[15px] text-slate-500">
          Transform your ideas into stunning AI-generated videos
        </p>
      </div>

    {/* PROGRESS INDICATOR */}
    <div className="mb-10 relative max-w-2xl mx-auto">
      <div className="absolute top-[18px] left-10 right-10 h-1 bg-slate-200 rounded-full" />
      <div
        className="absolute top-[18px] left-10 h-1 bg-gradient-to-r from-pink-500 to-rose-600 rounded-full transition-all duration-500"
        style={{ width: `calc((100% - 5rem) * ${(Math.min(currentStep, 6) - 1) / 5})` }}
      />
      <div className="flex justify-between relative">
        {stepLabels.map((label, i) => {
          const step = i + 1
          const done = currentStep > step
          const active = currentStep === step
          return (
            <div key={step} className="flex flex-col items-center px-1">
              <div
                className={`font-display w-10 h-10 rounded-full flex items-center justify-center mb-2 font-semibold text-sm transition-all ring-4 ring-slate-50 ${
                  active
                    ? "bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-500/30 scale-110"
                    : done
                      ? "bg-pink-100 text-pink-600"
                      : "bg-white text-slate-400 ring-slate-100"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : step}
              </div>
              <span
                className={`text-[11px] font-medium hidden sm:block transition-colors ${
                  active ? "text-slate-900" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>

    <div className="max-w-2xl mx-auto w-full">
      {/* STEP 1: DESCRIBE */}
      {currentStep === 1 && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h2 className="font-display text-xl font-semibold mb-1 text-slate-900">Describe what you want to create</h2>
          <p className="text-sm text-slate-500 mb-5">The more detail you give, the better the result.</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="E.g., A futuristic city with flying cars and neon lights, bustling with people..."
            className="w-full h-40 p-4 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 text-sm resize-none"
          />
          <button
            onClick={() => setCurrentStep(2)}
            disabled={!canProceedToStep2}
            className="mt-6 w-full py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition rounded-xl font-semibold text-white shadow-lg shadow-pink-500/25 hover:-translate-y-0.5"
          >
            Next
          </button>
        </div>
      )}

      {/* STEP 2: ASPECT RATIO */}
      {currentStep === 2 && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h2 className="font-display text-xl font-semibold mb-1 text-slate-900">Choose your aspect ratio</h2>
          <p className="text-sm text-slate-500 mb-5">Pick the shape that fits where you&apos;ll post.</p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { ratio: '16:9', name: 'Landscape', hint: 'YouTube · Desktop', box: 'w-20 h-11' },
              { ratio: '9:16', name: 'Portrait', hint: 'Reels · TikTok · Shorts', box: 'w-11 h-20' },
            ].map((opt) => {
              const selected = aspectRatio === opt.ratio
              return (
                <button
                  key={opt.ratio}
                  onClick={() => setAspectRatio(opt.ratio)}
                  className={`relative p-5 rounded-xl transition-all ring-1 flex flex-col items-center gap-3 ${
                    selected
                      ? 'bg-pink-50 ring-2 ring-pink-500 shadow-lg shadow-pink-500/10'
                      : 'bg-white ring-slate-200 hover:ring-slate-300'
                  }`}
                >
                  {selected && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-pink-600 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}

                  <div className="h-20 flex items-center justify-center">
                    <div
                      className={`${opt.box} rounded-md transition-colors ${
                        selected
                          ? 'bg-gradient-to-br from-pink-500 to-rose-600'
                          : 'bg-slate-200'
                      }`}
                    />
                  </div>

                  <div className="text-center">
                    <p className={`font-display text-sm font-semibold ${selected ? 'text-pink-700' : 'text-slate-900'}`}>
                      {opt.name} · {opt.ratio}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{opt.hint}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep(1)}
              className="flex-1 h-12 bg-white hover:bg-slate-50 ring-1 ring-slate-200 transition rounded-xl font-semibold text-slate-700"
            >
              Back
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 transition rounded-xl font-semibold text-white shadow-lg shadow-pink-500/25 hover:-translate-y-0.5"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: NICHE */}
      {currentStep === 3 && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h2 className="font-display text-xl font-semibold mb-1 text-slate-900">Select your niche</h2>
          <p className="text-sm text-slate-500 mb-4">This steers the tone and visuals of your video.</p>

          {/* Search / custom niche entry */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 mb-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-pink-400 focus-within:bg-white transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={nicheQuery}
              onChange={(e) => setNicheQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return
                e.preventDefault()
                if (canUseTypedNiche) applyTypedNiche()
                else if (filteredNiches.length > 0) {
                  setNiche(filteredNiches[0])
                  setCustomNiche("")
                  setNicheQuery("")
                }
              }}
              placeholder="Search niches or type your own…"
              className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none min-w-0"
            />
            {trimmedNicheQuery && (
              <button
                onClick={() => setNicheQuery("")}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-700 shrink-0"
              >
                Clear
              </button>
            )}
          </div>

          {/* Use typed value as a custom niche */}
          {canUseTypedNiche && (
            <button
              onClick={applyTypedNiche}
              className="w-full mb-4 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Use “{trimmedNicheQuery}” as your niche</span>
            </button>
          )}

          {/* Currently selected custom niche */}
          {niche === "Custom" && customNiche && (
            <div className="mb-4 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-pink-50 ring-1 ring-pink-200">
              <Check className="w-4 h-4 text-pink-600 shrink-0" />
              <span className="text-sm text-pink-900 truncate flex-1">
                Custom niche: <span className="font-semibold">{customNiche}</span>
              </span>
              <button
                onClick={() => {
                  setCustomNiche("")
                  setNiche("Technology")
                }}
                className="text-[11px] font-medium text-pink-600 hover:text-pink-800 shrink-0"
              >
                Remove
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-6 max-h-72 overflow-y-auto pr-1">
            {filteredNiches.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 w-full text-center">
                No niches match “{trimmedNicheQuery}”. Press Enter to use it anyway.
              </p>
            ) : (
              filteredNiches.map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setNiche(n)
                    if (n !== "Custom") setCustomNiche("")
                  }}
                  className={`px-3 py-1.5 rounded-full transition-all font-medium text-xs ring-1 ${
                    niche === n
                      ? "bg-pink-600 text-white ring-pink-600 shadow-sm"
                      : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-400 hover:text-slate-900"
                  }`}
                >
                  {n}
                </button>
              ))
            )}
          </div>

          {niche === "Custom" && (
            <input
              type="text"
              value={customNiche}
              onChange={(e) => setCustomNiche(e.target.value)}
              placeholder="Enter your custom niche..."
              className="w-full p-3.5 mb-6 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 text-sm"
            />
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep(2)}
              className="flex-1 h-12 bg-white hover:bg-slate-50 ring-1 ring-slate-200 transition rounded-xl font-semibold text-slate-700"
            >
              Back
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              disabled={!canProceedToStep4}
              className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition rounded-xl font-semibold text-white shadow-lg shadow-pink-500/25 hover:-translate-y-0.5"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: AUDIO SETTINGS */}
      {currentStep === 4 && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h2 className="font-display text-xl font-semibold mb-1 text-slate-900">Sound settings</h2>
          <p className="text-slate-500 mb-5 text-sm">Do you want audio in your video?</p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { on: true, icon: Volume2, name: 'With Audio', hint: 'Adds a generated soundtrack' },
              { on: false, icon: VolumeX, name: 'No Audio', hint: 'Silent clip, add your own' },
            ].map((opt) => {
              const Icon = opt.icon
              const selected = audio === opt.on
              return (
                <button
                  key={opt.name}
                  onClick={() => setAudio(opt.on)}
                  className={`relative p-5 rounded-xl transition-all ring-1 flex flex-col items-center gap-3 ${
                    selected
                      ? 'bg-pink-50 ring-2 ring-pink-500 shadow-lg shadow-pink-500/10'
                      : 'bg-white ring-slate-200 hover:ring-slate-300'
                  }`}
                >
                  {selected && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-pink-600 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}

                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      selected
                        ? 'bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg shadow-pink-500/25'
                        : 'bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${selected ? 'text-white' : 'text-slate-400'}`} />
                  </div>

                  <div className="text-center">
                    <p className={`font-display text-sm font-semibold ${selected ? 'text-pink-700' : 'text-slate-900'}`}>
                      {opt.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{opt.hint}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep(3)}
              className="flex-1 h-12 bg-white hover:bg-slate-50 ring-1 ring-slate-200 transition rounded-xl font-semibold text-slate-700"
            >
              Back
            </button>
            <button
              onClick={() => setCurrentStep(5)}
              className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 transition rounded-xl font-semibold text-white shadow-lg shadow-pink-500/25 hover:-translate-y-0.5"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: GENERATE */}
      {currentStep === 5 && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h2 className="font-display text-xl font-semibold mb-1 text-slate-900">Ready to generate?</h2>
          <p className="text-sm text-slate-500 mb-5">Review your settings before we render the clip.</p>

          <div className="mb-6 bg-slate-50 rounded-xl ring-1 ring-slate-200 divide-y divide-slate-200/70 overflow-hidden">
            <div className="px-4 py-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</p>
              <p className="text-sm text-slate-900 leading-relaxed">{description}</p>
            </div>
            {[
              { label: 'Aspect Ratio', value: aspectRatio },
              { label: 'Niche', value: niche === "Custom" ? customNiche : niche },
              { label: 'Audio', value: audio ? "With audio" : "Silent" },
              { label: 'Duration', value: '8 seconds' },
            ].map((row) => (
              <div key={row.label} className="px-4 py-2.5 flex items-center justify-between gap-4">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{row.label}</span>
                <span className="text-sm font-medium text-slate-900 truncate">{row.value}</span>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-rose-600 mb-4 text-sm bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep(4)}
              disabled={loading}
              className="flex-1 h-12 bg-white hover:bg-slate-50 ring-1 ring-slate-200 disabled:opacity-50 transition rounded-xl font-semibold text-slate-700"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:opacity-60 transition rounded-xl font-semibold text-white shadow-lg shadow-pink-500/25 hover:-translate-y-0.5"
            >
              {loading ? "Generating..." : "Generate Video"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: PREVIEW */}
      {currentStep === 6 && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-display text-xl font-semibold text-slate-900">Preview</h2>
            <button
              onClick={handleSaveVideo}
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:opacity-60 transition rounded-lg font-semibold text-white text-sm flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          {videoUrl ? (
            <div>
              <video
                src={videoUrl}
                controls
                className="w-full h-96 object-cover rounded-2xl mb-6 bg-black"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setCurrentStep(1)
                    setDescription("")
                    setAspectRatio("16:9")
                    setNiche("Technology")
                    setCustomNiche("")
                    setAudio(true)
                    setVideoUrl("")
                    setError("")
                  }}
                  className="flex-1 h-12 bg-white hover:bg-slate-50 ring-1 ring-slate-200 transition rounded-xl font-semibold text-slate-700"
                >
                  Create Another
                </button>
                <button
                  onClick={() => setDownloadModal(true)}
                  className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 transition rounded-xl font-semibold text-white shadow-lg shadow-pink-500/25 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Video
                </button>
              </div>
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <p className="text-sm text-slate-500">Generating your video…</p>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
    {/* Asks what should go when the keep-limit is reached. */}
      {library.dialog}

      <Footer />

    {/* DOWNLOAD MODAL */}
    {downloadModal && (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-[420px] shadow-2xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-xl font-semibold text-slate-900">Download Video</h2>
            <button onClick={() => setDownloadModal(false)} className="text-slate-400 hover:text-slate-900">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-slate-500 mb-5 text-sm">Enter a project name.</p>

          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="My Amazing Video"
            className="w-full p-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 text-sm"
          />

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setDownloadModal(false)
                setProjectName("")
              }}
              className="flex-1 h-12 rounded-xl bg-white hover:bg-slate-50 ring-1 ring-slate-200 transition font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              onClick={handleDownloadVideo}
              disabled={downloading}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:opacity-60 text-white font-semibold transition shadow-lg shadow-pink-500/25 hover:-translate-y-0.5"
            >
              {downloading ? "Downloading..." : "Download"}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
)
}
