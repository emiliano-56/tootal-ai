"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import {
  BookOpen,
  Sparkles,
  Download,
  Users,
  Image as ImageIcon,
  Loader2,
  ChevronDown,
  ArrowLeft,
  FileText,
  Wand2
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Footer } from '@/components/footer'
import { OptionPicker } from '@/components/option-picker'

import { useGenerationApi } from '@/components/generation-config'
import { consumeFeature } from '@/lib/plans/use-feature'
import { UsageBadge } from '@/components/usage-badge'
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

  const [comic, setComic] = useState<any>(null)

  const [pdfTitle, setPdfTitle] = useState("comic-book")

  const [openDropdowns, setOpenDropdowns] = useState({
    style: false,
    audience: false,
    niche: false,
    mood: false,
    format: false
  })

  const [form, setForm] = useState({
    story_idea: "",
    style: "Pixar",
    audience: "Kids",
    niche: "Adventure",
    mood: "Cute",
    number_of_pages: 1,
    number_of_characters: 2,
    aspect_ratio: "16:9"
  })

  const toggleDropdown = (key: keyof typeof openDropdowns) => {
    setDropdown(key, !openDropdowns[key])
  }

  // Only one panel may be open at a time so they never overlap each other.
  const setDropdown = (key: keyof typeof openDropdowns, value: boolean) => {
    setOpenDropdowns(prev => {
      const allClosed = Object.keys(prev).reduce(
        (acc, k) => ({ ...acc, [k]: false }),
        {} as typeof prev
      )
      return value ? { ...allClosed, [key]: true } : { ...prev, [key]: false }
    })
  }

  const deductCredits = async (_userId: string, _pages = 1) => {
    // Monthly allowance rather than a credit balance. The count is applied
    // server-side, so this asks and reports rather than deciding.
    const result = await consumeFeature('comic')

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

    if (!form.story_idea) {
      alert("Enter story idea")
      return
    }

    setLoadingStory(true)

    try {

      const res = await fetch(`${API}/coloring/generate-comic-story`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        // The generation backend writes its own prompt, so the language
        // instruction has to travel inside the idea rather than as a system
        // message we control.
        //
        // `final_prompt` is the field this backend hands straight to the image
        // model, and `scene_description` feeds it. Measured against the live
        // backend, without naming them the whole prompt came back in Hindi —
        // the story read perfectly and the artwork quietly fell apart, which
        // is the worst kind of bug because the page still looks generated.
        body: JSON.stringify({
          ...form,
          story_idea:
            form.story_idea +
            promptDirective(language.value, {
              keepEnglish: ['final_prompt', 'scene_description'],
            }),
        })
      })

      const data = await res.json()

      if (!data.success) {
        alert("Failed generating story")
        return
      }

      setComic(data.comic)

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

    if (!comic) return

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
      const allowed = await deductCredits(user.id, comic.pages.length)

      if (!allowed) {
        return
      }

      setLoadingImages(true)
    } catch (err) {
      console.error(err)
      toast.error("Could not start that generation")
      return
    }

    const updatedPages = [...comic.pages]

    for (let i = 0; i < updatedPages.length; i++) {

      const page = updatedPages[i]

      try {

        const res = await fetch(`${API}/coloring/generate-image`, {
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

        setComic({
          ...comic,
          pages: [...updatedPages]
        })

      } catch (err) {
        console.log(err)
      }
    }

    setLoadingImages(false)
    toast.success(`Comic ready — ${comic.pages.length} pages`)
  }

  // =====================================================
  // EXPORT PDF
  // =====================================================

  async function exportPDF() {

    setLoadingPDF(true)

    try {

      const elements = document.querySelectorAll(".comic-page-export")

      // Loaded here rather than at the top of the file. Together these two are
      // over half a megabyte of JavaScript, and importing them statically put
      // all of it in the bundle this page downloads and parses before it can
      // be used — to support a button most visits never press.
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ])

      const pdf = new jsPDF({
        orientation:
          form.aspect_ratio === "9:16"
            ? "portrait"
            : "landscape",
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
            backgroundColor: "#ffff"
          }
        )

        const imgData = canvas.toDataURL("image/jpeg", 1.0)

        // The first page doubles as the thumbnail a social network shows when
        // this comic is shared — it is already drawn, so keeping it is free.
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
        .from("comics")
        .insert({
          user_id: user.id,
          title: pdfTitle,
          pdf_path: filePath,
          // Null if the upload failed; a missing thumbnail costs a nicer
          // share card, never the comic itself.
          cover_url: coverUrl
        })

      if (dbError) {
        console.log(dbError)
        alert("Failed saving comic")
        setLoadingPDF(false)
        return
      }

      // Record it in the library, which is what counts against the keep
      // limit. A full library asks the customer what should go rather than
      // failing or quietly discarding this one.
      await library.save(
        {
          kind: "comic",
          title: pdfTitle,
          bucket: "comic-pdfs",
          path: filePath,
          coverUrl: coverUrl ?? undefined,
          sizeBytes: pdfBlob.size,
        },
        coverUrl ?? undefined
      )

    } catch (err) {

      console.log(err)
      alert("Something went wrong")

    } finally {

      setLoadingPDF(false)

    }
  }

  const getAspectRatioSize = () => {

    switch (form.aspect_ratio) {

      // CINEMATIC
      case "16:9":
        return {
          width: "100%",
          maxWidth: "950px",
          aspectRatio: "16 / 9"
        }

      // MOBILE COMIC
      case "9:16":
        return {
          width: "100%",
          maxWidth: "420px",
          aspectRatio: "9 / 16"
        }

      // COLORING PAGE / POSTER
      case "1:1":
        return {
          width: "100%",
          maxWidth: "650px",
          aspectRatio: "1 / 1"
        }

      // DEFAULT COMIC BOOK
      case "4:3":
      default:
        return {
          width: "100%",
          maxWidth: "850px",
          aspectRatio: "4 / 3"
        }
    }
  }

  const styleOptions = ["Manga Style (Black & White Japanese Comic)",
    "Anime Comic Style (Colored Manga Panels)",
    "Western Comic Book Style (Marvel/DC Inspired)",
    "Dark Graphic Novel Style (Gritty Cinematic Look)",
    "Chibi Comic Style (Cute Mini Characters)",
    "Pixar Style (3D Animated Look)",
    "Disney Style (Classic Animation Look)",
    "3D Cartoon Style (Modern CGI Look)",
    "Watercolor Storybook Style (Soft Illustrated Look)",
    "Minimal Flat Illustration Style (Clean Vector Art)",
    "Kawaii Cute Style (Soft Pastel Anime Look)"]

  const audienceOptions = ["Toddlers (2–4 years)",
    "Early Kids (5–7 years)",
    "Older Kids (8–12 years)",
    "Teens (13–17 years)",
    "Young Adults (18–24 years)",
    "Adults (25–34 years)",
    "Adults (35–44 years)",
    "Adults (45–54 years)",
    "Seniors (55+ years)"]

  const nicheOptions = [
    "Adventure", "Fantasy", "Mystery", "Comedy", "Drama", "Sci-Fi",
    "Romance", "Horror", "Thriller", "Superhero", "Slice of Life",
    "Historical Fiction", "Mythology", "Fairy Tale", "Anime Manga",
    "Cyberpunk", "Post-Apocalyptic", "Western", "Crime", "Detective",
    "Psychological", "Family", "Kids Story", "Educational", "Inspirational",
    "Spiritual", "Biography Style", "Action", "War Story", "Time Travel",
    "Magical Realism", "Urban Fantasy", "Space Opera", "Monster Story",
    "Survival", "Sports Story", "Friendship Story", "Coming of Age"
  ]

  const moodOptions = ["Cute", "Dark", "Mysterious", "Happy", "Serious", "Playful",
    "Epic", "Emotional", "Funny", "Whimsical", "Romantic", "Scary",
    "Suspenseful", "Inspirational", "Melancholic", "Energetic", "Calm",
    "Magical", "Dramatic", "Minimalist", "Chaotic", "Peaceful"]

  const formatOptions = [
    { value: "4:3", title: "Comic Book", description: "Best for comics & storybooks" },
    { value: "9:16", title: "Mobile Comic", description: "Perfect for TikTok & Shorts" },
    { value: "1:1", title: "Square Poster", description: "Great for coloring pages" },
    { value: "16:9", title: "Cinematic", description: "Wide movie-style scenes" }
  ]

  const panelBase =
    "absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl overflow-hidden z-30 ring-1 ring-slate-200 shadow-[0_20px_40px_-12px_rgba(15,23,42,0.25)] animate-in fade-in zoom-in-95 duration-150"

  // Small uppercase caption above each control group.
  const fieldLabel = "text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block"

  const pill = (active: boolean, color: 'blue' | 'purple') =>
    `h-9 rounded-lg cursor-pointer transition-all text-center text-sm font-semibold flex items-center justify-center ring-1 ${
      active
        ? color === 'blue'
          ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white ring-transparent shadow-md shadow-blue-500/25'
          : 'bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white ring-transparent shadow-md shadow-purple-500/25'
        : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-400 hover:text-slate-900'
    }`

  const hasPages = Boolean(comic?.pages?.length)

  return (
    <main className="min-h-full text-slate-900">

      {/* HEADER */}
      <div className="sticky top-16 z-20 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4">

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 leading-tight">
              AI Comic Generator
            </h1>
            <p className="text-slate-500 text-xs">
              Turn a story idea into a print-ready comic book
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              placeholder="Enter PDF title"
              className="bg-white text-slate-900 pl-9 pr-3.5 py-2.5 rounded-xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 transition-all text-sm w-44"
            />
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 text-sm ring-1 ring-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            onClick={exportPDF}
            disabled={loadingPDF || !hasPages}
            title={hasPages ? 'Export your comic as a PDF' : 'Generate a comic first'}
            className="font-display bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-semibold transition-all shadow-lg shadow-indigo-500/25 text-sm"
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

      <div className="grid grid-cols-1 lg:grid-cols-[370px_1fr] gap-6 p-6">

        {/* LEFT SIDEBAR - CONTROLS */}

        <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] p-5 h-fit lg:sticky lg:top-36">

          <div className="space-y-5">

            <div>
              <label className={fieldLabel}>
                Story Idea
              </label>

              <textarea
                value={form.story_idea}
                onChange={(e) => setForm({
                  ...form,
                  story_idea: e.target.value
                })}
                placeholder="A snail exploring a magical garden…"
                className="w-full h-32 rounded-xl bg-slate-50 p-3.5 outline-none resize-none text-slate-900 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all placeholder:text-slate-400"
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

            <div className="h-px bg-slate-100" />

            <OptionPicker
              label="Style"
              tone="blue"
              value={form.style}
              options={styleOptions}
              open={openDropdowns.style}
              onOpenChange={(v) => setDropdown('style', v)}
              onChange={(style) => setForm({ ...form, style })}
              searchPlaceholder="Search styles or type your own…"
            />

            <OptionPicker
              label="Audience"
              tone="purple"
              value={form.audience}
              options={audienceOptions}
              open={openDropdowns.audience}
              onOpenChange={(v) => setDropdown('audience', v)}
              onChange={(audience) => setForm({ ...form, audience })}
              searchPlaceholder="Search audiences or type your own…"
            />

            <div className="h-px bg-slate-100" />

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className={`${fieldLabel} mb-0`}>Pages</label>
                <UsageBadge feature="comic" />
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                  <div
                    key={num}
                    onClick={() => setForm({ ...form, number_of_pages: num })}
                    className={pill(form.number_of_pages === num, 'blue')}
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className={fieldLabel}>
                Characters
              </label>

              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map(num => (
                  <div
                    key={num}
                    onClick={() => setForm({ ...form, number_of_characters: num })}
                    className={pill(form.number_of_characters === num, 'purple')}
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <OptionPicker
              label="Niche"
              tone="pink"
              value={form.niche}
              options={nicheOptions}
              open={openDropdowns.niche}
              onOpenChange={(v) => setDropdown('niche', v)}
              onChange={(niche) => setForm({ ...form, niche })}
              searchPlaceholder="Search niches or type your own…"
            />

            <OptionPicker
              label="Mood"
              tone="amber"
              value={form.mood}
              options={moodOptions}
              open={openDropdowns.mood}
              onOpenChange={(v) => setDropdown('mood', v)}
              onChange={(mood) => setForm({ ...form, mood })}
              searchPlaceholder="Search moods or type your own…"
            />

            {/* FORMAT PICKER */}
            <div>
              <label className={fieldLabel}>
                Format
              </label>

              <div className="relative">

                <button
                  onClick={() => toggleDropdown("format")}
                  className="w-full bg-white rounded-xl px-3.5 py-2.5 flex items-center justify-between ring-1 ring-slate-200 hover:ring-slate-300 transition-all"
                >

                  <div className="flex flex-col items-start">

                    <span className="text-sm font-semibold text-slate-900">

                      {form.aspect_ratio === "4:3"
                        ? "Comic Book"
                        : form.aspect_ratio === "9:16"
                          ? "Mobile Comic"
                          : form.aspect_ratio === "1:1"
                            ? "Square Poster"
                            : "Cinematic"}

                    </span>

                    <span className="text-[11px] text-slate-500">

                      {form.aspect_ratio === "4:3"
                        ? "Best for comics & storybooks"
                        : form.aspect_ratio === "9:16"
                          ? "Perfect for TikTok & Shorts"
                          : form.aspect_ratio === "1:1"
                            ? "Great for coloring pages"
                            : "Wide movie-style scenes"}

                    </span>

                  </div>

                  <ChevronDown
                    className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${openDropdowns.format ? "rotate-180" : ""
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
                        className={`px-4 py-3 cursor-pointer transition-colors border-l-[3px] ${form.aspect_ratio === value
                            ? "bg-indigo-50 border-l-indigo-600"
                            : "bg-white border-l-transparent hover:bg-slate-50"
                          }`}
                      >

                        <div className={`font-semibold text-sm ${form.aspect_ratio === value ? "text-indigo-700" : "text-slate-900"}`}>
                          {title}
                        </div>

                        <div className="text-[11px] mt-0.5 text-slate-500">
                          {description}
                        </div>

                      </div>

                    ))}

                  </div>

                )}

              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div className="space-y-2.5">
              <button
                onClick={generateStory}
                disabled={loadingStory}
                className="font-display w-full h-12 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 text-white rounded-xl flex items-center justify-center gap-2 font-semibold text-[15px] transition-all shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5 disabled:hover:translate-y-0"
              >
                {loadingStory ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Writing your story…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Step 1 · Generate Story
                  </>
                )}
              </button>

              <button
                onClick={generateImages}
                disabled={loadingImages || !comic}
                className="font-display w-full h-12 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none text-white rounded-xl flex items-center justify-center gap-2 font-semibold text-[15px] transition-all shadow-lg shadow-purple-500/25 hover:-translate-y-0.5 disabled:hover:translate-y-0"
              >
                {loadingImages ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Drawing panels…
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Step 2 · Illustrate Pages
                  </>
                )}
              </button>

              {!comic && (
                <p className="text-[11px] text-slate-400 text-center pt-0.5">
                  Generate the story first to unlock illustration
                </p>
              )}
            </div>

          </div>

        </div>

        {/* RIGHT CONTENT - PAGES AND CHARACTERS */}

        <div className="space-y-6">

          {!comic && (
            <div className="relative overflow-hidden bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] px-8 py-16 flex flex-col items-center justify-center text-center">
              {/* soft backdrop */}
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-50 via-violet-50 to-transparent pointer-events-none" />

              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/25">
                <ImageIcon className="w-7 h-7 text-white" />
              </div>

              <h3 className="font-display font-semibold text-slate-900 text-xl relative">
                Your comic will appear here
              </h3>
              <p className="text-sm text-slate-500 mt-1.5 max-w-sm relative">
                Fill in your story idea on the left, then run the two steps to write and illustrate it.
              </p>

              {/* ghost page placeholders */}
              <div className="relative mt-9 flex items-end gap-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-24 h-32 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 flex items-center justify-center"
                    style={{ transform: `rotate(${(i - 1) * 4}deg)` }}
                  >
                    <span className="font-display text-xs font-semibold text-slate-300">
                      Page {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CHARACTERS */}

          {comic?.characters && (
            <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Users className="w-[18px] h-[18px] text-white" />
                </div>

                <h2 className="font-display text-[17px] font-semibold text-slate-900">
                  Characters
                </h2>
                <span className="ml-auto text-[11px] font-medium text-slate-400">
                  Editable
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {comic.characters.map((char: any, index: number) => (
                  <div
                    key={index}
                    className="bg-slate-50 rounded-xl p-4 ring-1 ring-slate-200"
                  >

                    <input
                      value={char.name}
                      onChange={(e) => {

                        const updated = [...comic.characters]

                        updated[index].name = e.target.value

                        setComic({
                          ...comic,
                          characters: updated
                        })
                      }}
                      className="font-display w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg px-3 py-2.5 mb-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-300"
                    />

                    <textarea
                      value={char.description}
                      onChange={(e) => {

                        const updated = [...comic.characters]

                        updated[index].description = e.target.value

                        setComic({
                          ...comic,
                          characters: updated
                        })
                      }}
                      className="w-full h-24 bg-white rounded-lg p-3 text-sm text-slate-700 resize-none outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 transition-all"
                    />

                  </div>
                ))}

              </div>

            </div>
          )}

          {/* COMIC PAGES */}

          {comic?.pages?.map((page: any, index: number) => (
            <div
              key={page.page_number}
              className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500"
            >

              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Page {page.page_number} &middot; Editable Prompt
              </h3>

              <textarea
                value={page.final_prompt}
                onChange={(e) => {

                  const updated = [...comic.pages]

                  updated[index].final_prompt = e.target.value

                  setComic({
                    ...comic,
                    pages: updated
                  })
                }}
                className="w-full h-28 bg-slate-50 rounded-xl p-3.5 mb-5 text-sm text-slate-700 resize-none outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
              />

              <div className="flex flex-col items-center">

                {/* PAGE NUMBER */}
                <div className="mb-3 text-center">
                  <span className="font-display bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-3.5 py-1 rounded-full text-[11px] font-semibold">
                    Page {page.page_number}
                  </span>
                </div>

                <div
                  className="comic-page-export relative overflow-hidden bg-white rounded-xl ring-1 ring-slate-200"
                  style={getAspectRatioSize()}
                >

                  {page.image_url ? (

                    <img
                      src={page.image_url}
                      alt="comic"
                      className="w-full h-full object-contain p-2 bg-white"
                    />

                  ) : (

                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400 text-sm">
                      <ImageIcon className="w-6 h-6" />
                      Run Step 2 to illustrate this page
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
