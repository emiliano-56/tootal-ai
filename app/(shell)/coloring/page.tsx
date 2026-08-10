"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import {
  Palette,
  Sparkles,
  Download,
  Loader2,
  ChevronDown,
  ArrowLeft,
  Image as ImageIcon
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Footer } from '@/components/footer'

import { useGenerationApi } from '@/components/generation-config'
import { consumeFeature } from '@/lib/plans/use-feature'
import { UsageBadge } from '@/components/usage-badge'
import { usePromptPrefill } from '@/lib/dfy/use-prefill'
import { uploadCover } from '@/lib/share/cover'
import { useLibrarySave } from '@/components/use-library-save'
import { useLanguage, LanguagePicker } from '@/components/language-picker'
import { promptDirective } from '@/lib/i18n/languages'

export default function Page() {
  const API = useGenerationApi()

  // The keep-limit, the full-library dialog and Drive backup all live here.
  const library = useLibrarySave()

  // What language the story comes out in.
  const language = useLanguage()


  const router = useRouter()

  const [loadingStory, setLoadingStory] = useState(false)
  const [loadingImages, setLoadingImages] = useState(false)
  const [loadingPDF, setLoadingPDF] = useState(false)

  const [coloringBook, setColoringBook] = useState<any>(null)

  const [pdfTitle, setPdfTitle] = useState("coloring-book")

  const [openDropdowns, setOpenDropdowns] = useState({
    style: false,
    audience: false,
    niche: false,
    mood: false,
    format: false,
    pageSize: false
  })

  const [form, setForm] = useState({
    book_idea: "",
    style: "Cute Animals",
    audience: "Kids",
    niche: "Animals",
    mood: "Cute",
    number_of_pages: 1,
    number_of_characters: 2,
    aspect_ratio: "3:4",
    page_size: "8.5 x 11"
  })

  // Arriving from a DFY pack with a printable prompt.
  usePromptPrefill((prompt) => setForm((current) => ({ ...current, book_idea: prompt })))

  const toggleDropdown = (key: keyof typeof openDropdowns) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const deductCredits = async (_userId: string, _pages = 1) => {
    // Monthly allowance rather than a credit balance. The count is applied
    // server-side, so this asks and reports rather than deciding.
    const result = await consumeFeature('coloring')

    if (!result.ok) {
      toast.error(result.error ?? 'Monthly limit reached')
      return false
    }

    return true
  }

  // =====================================================
  // GENERATE STORY
  // =====================================================

  async function generateStory() {

    if (!form.book_idea) {
      alert("Enter coloring book idea")
      return
    }

    setLoadingStory(true)

    try {

      const res = await fetch(`${API}/comic/generate-coloring-book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        // Same as the comic generator: `final_prompt` is handed straight to
        // the image model, so it stays English while everything the reader
        // sees follows the chosen language.
        body: JSON.stringify({
          ...form,
          book_idea:
            form.book_idea +
            promptDirective(language.value, {
              keepEnglish: ['final_prompt', 'scene_description'],
            }),
        })
      })

      const data = await res.json()

      if (!data.success) {
        alert("Failed generating coloring book")
        return
      }

      setColoringBook(data.coloring_book)

    } catch (err) {
      console.log(err)
      alert("Something went wrong")
    }

    setLoadingStory(false)
  }

  // =====================================================
  // GENERATE IMAGES
  // =====================================================

  async function generateImages() {

    if (!coloringBook) return

    let userId: string | null = null

    try {
      // GET USER FIRST
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error("Please login first")
        return
      }

      userId = user.id

      // Spend one of this month's allowance before generating
      const allowed = await deductCredits(user.id, coloringBook.pages.length)

      if (!allowed) {
        return
      }

      setLoadingImages(true)
    } catch (err) {
      console.error(err)
      toast.error("Could not start that generation")
      return
    }

    const updatedPages = [...coloringBook.pages]

    for (let i = 0; i < updatedPages.length; i++) {

      const page = updatedPages[i]

      try {

        const res = await fetch(`${API}/comic/generate-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: page.final_prompt,
            aspect_ratio: form.aspect_ratio
          })
        })

        const data = await res.json()

        const imageRes = await fetch(data.image_url)

        const blob = await imageRes.blob()

        const base64 = await new Promise<string>((resolve) => {

          const reader = new FileReader()

          reader.onloadend = () => {
            resolve(reader.result as string)
          }

          reader.readAsDataURL(blob)
        })

        updatedPages[i].image_url = base64

        setColoringBook({
          ...coloringBook,
          pages: [...updatedPages]
        })

      } catch (err) {
        console.log(err)
      }
    }

    setLoadingImages(false)
    toast.success(`Coloring book ready — ${coloringBook.pages.length} pages`)
  }

  // =====================================================
  // EXPORT PDF
  // =====================================================

  async function exportPDF() {

    setLoadingPDF(true)

    try {

      const elements = document.querySelectorAll(".coloring-page-export")

      // Over half a megabyte between them, needed only when this button is
      // pressed. Static imports put all of it in the page's initial bundle.
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ])

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      })

      let coverDataUrl = ""

      for (let i = 0; i < elements.length; i++) {

        const canvas = await html2canvas(
          elements[i] as HTMLElement,
          {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff"
          }
        )

        const imgData = canvas.toDataURL("image/jpeg", 1.0)

        // The first page doubles as the thumbnail a social network shows when
        // this book is shared — it is already drawn, so keeping it is free.
        if (i === 0) coverDataUrl = imgData

        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()

        // IMAGE SIZE
        const imgWidth = canvas.width
        const imgHeight = canvas.height

        // FIT IMAGE INSIDE PDF
        const ratio = Math.min(
          pageWidth / imgWidth,
          pageHeight / imgHeight
        )

        const finalWidth = imgWidth * ratio
        const finalHeight = imgHeight * ratio

        // CENTER IMAGE
        const x = (pageWidth - finalWidth) / 2
        const y = (pageHeight - finalHeight) / 2

        if (i > 0) {
          pdf.addPage()
        }

        pdf.addImage(
          imgData,
          "JPEG",
          x,
          y,
          finalWidth,
          finalHeight
        )
      }

      // CONVERT PDF TO BLOB
      const pdfBlob = pdf.output("blob")

      // DOWNLOAD LOCALLY
      pdf.save(`${pdfTitle}.pdf`)

      // GET CURRENT USER
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) {
        alert("You must be logged in")
        setLoadingPDF(false)
        return
      }

      // CREATE UNIQUE FILE PATH
      const filePath = `${user.id}/${Date.now()}-${pdfTitle}.pdf`

      // UPLOAD PDF TO STORAGE
      const { error: uploadError } = await supabase.storage
        .from("comic-pdfs")
        .upload(filePath, pdfBlob, {
          contentType: "application/pdf"
        })

      if (uploadError) {
        console.log(uploadError)
        alert("Failed uploading PDF")
        setLoadingPDF(false)
        return
      }

      const coverUrl = coverDataUrl ? await uploadCover(coverDataUrl, pdfTitle) : null

      // SAVE PDF RECORD TO DATABASE
      const { error: dbError } = await supabase
        .from("colorings")
        .insert({
          user_id: user.id,
          title: pdfTitle,
          pdf_path: filePath,
          // Null if the upload failed; a missing thumbnail costs a nicer
          // share card, never the book itself.
          cover_url: coverUrl
        })

      if (dbError) {
        console.log(dbError)
        alert("Failed saving coloring")
        setLoadingPDF(false)
        return
      }

      await library.save({
        kind: "coloring",
        title: pdfTitle,
        bucket: "comic-pdfs",
        path: filePath,
        coverUrl: coverUrl ?? undefined,
        sizeBytes: pdfBlob.size,
      })

    } catch (err) {

      console.log(err)
      alert("Something went wrong")

    } finally {

      setLoadingPDF(false)

    }
  }

  const getAspectRatioSize = () => {

    switch (form.aspect_ratio) {

      case "3:4":
        return {
          width: "100%",
          maxWidth: "700px",
          aspectRatio: "3 / 4"
        }

      case "2:3":
        return {
          width: "100%",
          maxWidth: "750px",
          aspectRatio: "2 / 3"
        }

      case "1:1":
        return {
          width: "100%",
          maxWidth: "650px",
          aspectRatio: "1 / 1"
        }

      default:
        return {
          width: "100%",
          maxWidth: "700px",
          aspectRatio: "3 / 4"
        }
    }
  }

  const styleOptions = ["Cute Animals", "Kawaii", "Simple Kids", "Bold Outline", "Easy Coloring", "Fantasy Coloring", "Mandala", "Cartoon Animals", "Dinosaurs", "Princess"]

  const audienceOptions = [
    "Toddlers (3–5 years)",
    "Kids (6–9 years)",
    "Pre-Teens (10–12 years)",
    "Teenagers (13–17 years)",
    "Young Adults (18–24 years)",
    "Adults (25–40 years)",
    "Mature Adults (40+ years)"
  ]

  const nicheOptions = [
    "Animals", "Farm Animals", "Wild Animals", "Jungle Animals", "Ocean Life", "Birds", "Dinosaurs",
    "Princesses", "Fairy Tales", "Unicorns", "Fantasy Creatures", "Dragons", "Mermaids",
    "Vehicles", "Cars", "Trucks", "Airplanes", "Trains",
    "Space", "Astronauts", "Planets", "Rockets",
    "Halloween", "Christmas", "Easter", "Thanksgiving",
    "Nature", "Flowers", "Trees", "Insects",
    "Underwater World", "Safari", "Arctic Animals", "Mythical Creatures",
    "Sports", "Superheroes", "Cartoon Characters", "Educational Shapes"
  ]

  const moodOptions = ["Cute", "Happy", "Playful", "Relaxing", "Whimsical", "Cozy", "Fun", "Friendly"]

  const formatOptions = [
    { value: "3:4", title: "KDP Coloring Page", description: "Perfect printable coloring page" },
    { value: "2:3", title: "Large Coloring Book", description: "Best for Amazon KDP interiors" },
    { value: "1:1", title: "Square Coloring Page", description: "Great for activity books" }
  ]

  const pageSizeOptions = ["8.5 x 11", "6 x 9", "A4", "Square"]

  const inputBase = "w-full bg-white border-2 border-black rounded-xl px-4 py-3 text-sm text-black outline-none transition-all flex items-center justify-between shadow-[2px_2px_0_rgba(0,0,0,0.85)] hover:shadow-[3px_3px_0_rgba(0,0,0,0.85)]"
  const panelBase = "absolute top-full left-0 right-0 mt-2 bg-white border-2 border-black rounded-2xl overflow-hidden z-20 shadow-[4px_4px_0_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-150"
  const chip = (active: boolean, color: 'purple' | 'pink' | 'amber' | 'blue') => {
    const activeColor = {
      purple: 'bg-purple-600 border-purple-600 text-white',
      pink: 'bg-pink-600 border-pink-600 text-white',
      amber: 'bg-amber-500 border-amber-500 text-white',
      blue: 'bg-blue-600 border-blue-600 text-white',
    }[color]
    return `px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all border-2 ${
      active ? activeColor : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
    }`
  }
  const badge = (color: 'purple' | 'pink' | 'amber' | 'blue') => ({
    purple: 'bg-purple-50 text-purple-700',
    pink: 'bg-pink-50 text-pink-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
  }[color])

  return (
    <main className="min-h-screen bg-gray-50 text-black">

      {/* HEADER */}

      <div className="bg-white border-b border-gray-200 px-6 py-5 flex flex-wrap items-center justify-between gap-4">

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center border-2 border-black shadow-[2px_2px_0_rgba(0,0,0,0.85)]">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-black">
              AI Coloring Book Generator
            </h1>
            <p className="text-gray-500 text-xs">
              Create printable coloring books for Amazon KDP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={pdfTitle}
            onChange={(e) => setPdfTitle(e.target.value)}
            placeholder="Enter PDF title"
            className="bg-white border border-gray-200 text-black px-4 py-2.5 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-colors text-sm"
          />

          <button
            onClick={() => router.push('/dashboard')}
            className="bg-gray-100 hover:bg-gray-200 text-black px-4 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            onClick={exportPDF}
            disabled={loadingPDF}
            className="bg-yellow-300 hover:bg-yellow-200 text-purple-900 px-5 py-2.5 rounded-xl flex items-center gap-2 font-extrabold transition-all border-2 border-black shadow-[3px_3px_0_rgba(0,0,0,0.85)] hover:shadow-[1px_1px_0_rgba(0,0,0,0.85)] hover:translate-x-[2px] hover:translate-y-[2px] text-sm disabled:opacity-60"
          >
            {loadingPDF ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export PDF
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 p-6">

        {/* LEFT SIDEBAR - CONTROLS */}

        <div className="bg-white border-2 border-black shadow-[4px_4px_0_rgba(0,0,0,0.85)] rounded-3xl p-6 h-fit sticky top-6">

          <div className="space-y-5">

            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Coloring Book Idea
              </label>

              <textarea
                value={form.book_idea}
                onChange={(e) => setForm({
                  ...form,
                  book_idea: e.target.value
                })}
                placeholder="Cute jungle animals for kids or easy farm animals coloring pages"
                className="w-full h-40 rounded-2xl bg-white border border-gray-200 p-4 outline-none resize-vertical text-black text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-colors"
              />
            </div>

            {/* Next to the idea rather than in a settings panel: it changes
                what you get back, so it belongs where you say what you want. */}
            <LanguagePicker
              value={language.value}
              onChange={language.setValue}
              allowed={language.allowed}
              answered={language.answered}
            />

            {/* STYLE PICKER */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Style
              </label>

              <div className="relative">
                <button
                  onClick={() => toggleDropdown('style')}
                  className={inputBase}
                >
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold truncate ${badge('purple')}`}>{form.style}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${openDropdowns.style ? 'rotate-180' : ''}`} />
                </button>

                {openDropdowns.style && (
                  <div className={`${panelBase} max-h-64 overflow-y-auto p-3`}>
                    <div className="flex flex-wrap gap-2">
                      {styleOptions.map((style) => (
                        <div
                          key={style}
                          onClick={() => {
                            setForm({ ...form, style })
                            toggleDropdown('style')
                          }}
                          className={chip(form.style === style, 'purple')}
                        >
                          {style}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AUDIENCE PICKER */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Audience
              </label>

              <div className="relative">
                <button
                  onClick={() => toggleDropdown('audience')}
                  className={inputBase}
                >
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold truncate ${badge('blue')}`}>{form.audience}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${openDropdowns.audience ? 'rotate-180' : ''}`} />
                </button>

                {openDropdowns.audience && (
                  <div className={`${panelBase} max-h-64 overflow-y-auto p-3`}>
                    <div className="flex flex-wrap gap-2">
                      {audienceOptions.map((audience) => (
                        <div
                          key={audience}
                          onClick={() => {
                            setForm({ ...form, audience })
                            toggleDropdown('audience')
                          }}
                          className={chip(form.audience === audience, 'blue')}
                        >
                          {audience}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Pages
              </label>

              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                  <div
                    key={num}
                    onClick={() => setForm({ ...form, number_of_pages: num })}
                    className={`px-2 py-2 rounded-lg cursor-pointer transition-all text-center text-sm font-bold border-2 ${form.number_of_pages === num
                      ? "bg-purple-600 border-purple-600 text-white shadow-[2px_2px_0_rgba(0,0,0,0.85)]"
                      : "bg-white border-gray-200 text-black hover:border-purple-400"
                      }`}
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>

            {/* NICHE PICKER */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Niche
              </label>

              <div className="relative">
                <button
                  onClick={() => toggleDropdown('niche')}
                  className={inputBase}
                >
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold truncate ${badge('pink')}`}>{form.niche}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${openDropdowns.niche ? 'rotate-180' : ''}`} />
                </button>

                {openDropdowns.niche && (
                  <div className={`${panelBase} max-h-64 overflow-y-auto p-3`}>
                    <div className="flex flex-wrap gap-2">
                      {nicheOptions.map((niche) => (
                        <div
                          key={niche}
                          onClick={() => {
                            setForm({ ...form, niche })
                            toggleDropdown('niche')
                          }}
                          className={chip(form.niche === niche, 'pink')}
                        >
                          {niche}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* MOOD PICKER */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Mood
              </label>

              <div className="relative">
                <button
                  onClick={() => toggleDropdown('mood')}
                  className={inputBase}
                >
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold truncate ${badge('amber')}`}>{form.mood}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${openDropdowns.mood ? 'rotate-180' : ''}`} />
                </button>

                {openDropdowns.mood && (
                  <div className={`${panelBase} max-h-64 overflow-y-auto p-3`}>
                    <div className="flex flex-wrap gap-2">
                      {moodOptions.map((mood) => (
                        <div
                          key={mood}
                          onClick={() => {
                            setForm({ ...form, mood })
                            toggleDropdown('mood')
                          }}
                          className={chip(form.mood === mood, 'amber')}
                        >
                          {mood}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* FORMAT PICKER */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Format
              </label>

              <div className="relative">

                <button
                  onClick={() => toggleDropdown("format")}
                  className="w-full bg-white border-2 border-black rounded-xl px-4 py-3 flex items-center justify-between shadow-[2px_2px_0_rgba(0,0,0,0.85)] hover:shadow-[3px_3px_0_rgba(0,0,0,0.85)] transition-all"
                >

                  <div className="flex flex-col items-start">

                    <span className="text-sm font-semibold text-black">

                      {form.aspect_ratio === "3:4"
                        ? "KDP Coloring Page"
                        : form.aspect_ratio === "2:3"
                          ? "Large Coloring Book"
                          : "Square Coloring Page"}

                    </span>

                    <span className="text-xs text-gray-500">

                      {form.aspect_ratio === "3:4"
                        ? "Perfect printable coloring page"
                        : form.aspect_ratio === "2:3"
                          ? "Best for Amazon KDP interiors"
                          : "Great for activity books"}

                    </span>

                  </div>

                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${openDropdowns.format ? "rotate-180" : ""
                      }`}
                  />

                </button>

                {openDropdowns.format && (

                  <div className={panelBase}>

                    {formatOptions.map(({ value, title, description }) => (

                      <div
                        key={value}
                        onClick={() => {

                          setForm({
                            ...form,
                            aspect_ratio: value
                          })

                          toggleDropdown("format")
                        }}
                        className={`px-5 py-3.5 cursor-pointer transition-colors border-l-4 ${form.aspect_ratio === value
                          ? "bg-purple-50 border-l-purple-600"
                          : "bg-white border-l-transparent hover:bg-gray-50"
                          }`}
                      >

                        <div className={`font-semibold text-sm ${form.aspect_ratio === value ? "text-purple-700" : "text-black"}`}>
                          {title}
                        </div>

                        <div className="text-xs mt-0.5 text-gray-500">
                          {description}
                        </div>

                      </div>

                    ))}

                  </div>

                )}

              </div>
            </div>

            {/* PAGE SIZE DROPDOWN */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Page Size
              </label>

              <div className="relative">
                <button
                  onClick={() => toggleDropdown('pageSize')}
                  className={inputBase}
                >
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold truncate ${badge('purple')}`}>{form.page_size}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${openDropdowns.pageSize ? 'rotate-180' : ''}`} />
                </button>

                {openDropdowns.pageSize && (
                  <div className={`${panelBase} p-3`}>
                    <div className="flex flex-wrap gap-2">
                      {pageSizeOptions.map((size) => (
                        <div
                          key={size}
                          onClick={() => {
                            setForm({ ...form, page_size: size })
                            toggleDropdown('pageSize')
                          }}
                          className={chip(form.page_size === size, 'purple')}
                        >
                          {size}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={generateStory}
              disabled={loadingStory}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border-2 border-black shadow-[3px_3px_0_rgba(0,0,0,0.85)] hover:shadow-[1px_1px_0_rgba(0,0,0,0.85)] hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              {loadingStory ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Step 1: Generate Ideas
                </>
              )}
            </button>

            <button
              onClick={generateImages}
              disabled={loadingImages || !coloringBook}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border-2 border-black shadow-[3px_3px_0_rgba(0,0,0,0.85)] hover:shadow-[1px_1px_0_rgba(0,0,0,0.85)] hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              {loadingImages ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Palette className="w-5 h-5" />
                  Step 2: Generate Coloring ({form.number_of_pages} pages)
                </>
              )}
            </button>

            <div className="mt-2 text-center">
              <UsageBadge feature="coloring" />
            </div>

          </div>

        </div>

        {/* RIGHT CONTENT - PAGES */}

        <div className="space-y-6">

          {!coloringBook && (
            <div className="bg-white border-2 border-black shadow-[4px_4px_0_rgba(0,0,0,0.85)] rounded-3xl p-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center mb-4 shadow-md">
                <ImageIcon className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-bold text-black text-lg">Your coloring pages will appear here</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm">
                Describe your coloring book idea on the left and click Generate Ideas to get started.
              </p>
            </div>
          )}

          {/* COLORING PAGES */}

          {coloringBook?.pages?.map((page: any, index: number) => (
            <div
              key={page.page_number}
              className="bg-white border-2 border-black shadow-[4px_4px_0_rgba(0,0,0,0.85)] rounded-3xl p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500"
            >

              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Page {page.page_number} &middot; Coloring Page Prompt
              </h3>

              <textarea
                value={page.final_prompt}
                onChange={(e) => {

                  const updated = [...coloringBook.pages]

                  updated[index].final_prompt = e.target.value

                  setColoringBook({
                    ...coloringBook,
                    pages: updated
                  })
                }}
                className="w-full h-32 bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 text-sm text-black resize-vertical outline-none focus:border-purple-500"
              />

              <div className="flex flex-col items-center">

                {/* PAGE NUMBER */}
                <div className="mb-3 text-center">
                  <span className="bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white px-4 py-1 rounded-full text-xs font-bold">
                    Page {page.page_number}
                  </span>
                </div>

                <div
                  className="coloring-page-export relative overflow-hidden bg-white rounded-xl border border-gray-100"
                  style={getAspectRatioSize()}
                >

                  {page.image_url ? (

                    <img
                      src={page.image_url}
                      alt="coloring-page"
                      className="w-full h-full object-contain p-2"
                    />

                  ) : (

                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                      Image will appear here
                    </div>

                  )}

                </div>

              </div>

            </div>
          ))}

        </div>

      </div>
      {/* Footer */}
      {/* Asks what should go when the keep-limit is reached. */}
      {library.dialog}

      <Footer />
    </main>
  )
}
