"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/db"
import { Download, Trash2, Loader2, FileText, Search, Film, Play, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { Footer } from '@/components/footer'
import { PdfThumbnail } from '@/components/pdf-thumbnail'

interface ComicFile {
  name: string
  pdf_path: string
  title: string
  created_at: string
  type: "comic" | "coloring"
}

interface VideoFile {
  name: string
  video_path: string
  url: string
  created_at: string
}

export default function MyComicsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"comics" | "videos">("comics")
  const [comics, setComics] = useState<ComicFile[]>([])
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState("")

  // Signed URLs for PDF previews, keyed by storage path.
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

  // Video currently open in the lightbox.
  const [activeVideo, setActiveVideo] = useState<VideoFile | null>(null)

  useEffect(() => {
    const checkUserAndFetchComics = async () => {
      try {
        // GET CURRENT USER
        const {
          data: { user }
        } = await supabase.auth.getUser()

        if (!user) {
          // The login form lives at the app root.
          router.push("/")
          return
        }

        setUser(user)
        await fetchUserComics(user.id)
        await fetchUserVideos(user.id)
      } catch (err) {
        console.log("[v0] Error checking user:", err)
      }
    }

    checkUserAndFetchComics()
  }, [router])

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!activeVideo) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveVideo(null)
    }

    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [activeVideo])

  const fetchUserComics = async (userId: string) => {
    try {
      setLoading(true)

      // FETCH COMICS FROM DATABASE
      const { data: comicsData, error: comicsError } = await supabase
        .from("comics")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      // FETCH COLORINGS FROM DATABASE
      const { data: coloringsData, error: coloringsError } = await supabase
        .from("colorings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (comicsError) {
        console.log("[v0] Comics fetch error:", comicsError)
      }

      if (coloringsError) {
        console.log("[v0] Colorings fetch error:", coloringsError)
      }

      // COMBINE COMICS AND COLORINGS
      const allFiles: ComicFile[] = []

      if (comicsData) {
        allFiles.push(
          ...comicsData.map((comic: any) => ({
            ...comic,
            type: "comic" as const
          }))
        )
      }

      if (coloringsData) {
        allFiles.push(
          ...coloringsData.map((coloring: any) => ({
            ...coloring,
            type: "coloring" as const
          }))
        )
      }

      // SORT BY CREATED_AT
      allFiles.sort((a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      )

      setComics(allFiles)
      await loadPreviewUrls(allFiles)
    } catch (err) {
      console.log("[v0] Error fetching files:", err)
    } finally {
      setLoading(false)
    }
  }

  // Sign every PDF in one batch so the thumbnails can render.
  const loadPreviewUrls = async (files: ComicFile[]) => {
    const paths = files.map((f) => f.pdf_path).filter(Boolean)
    if (paths.length === 0) return

    try {
      const { data, error } = await supabase.storage
        .from("comic-pdfs")
        .createSignedUrls(paths, 3600)

      if (error) {
        console.log("[v0] Error signing preview URLs:", error)
        return
      }

      const map: Record<string, string> = {}
      for (const row of data || []) {
        if (row.signedUrl && row.path) map[row.path] = row.signedUrl
      }
      setPreviewUrls(map)
    } catch (err) {
      console.log("[v0] Error signing preview URLs:", err)
    }
  }

  const fetchUserVideos = async (userId: string) => {
    try {
      // List all video files for the user from storage
      const { data: videosList, error: listError } = await supabase.storage
        .from("video")
        .list(userId)

      if (listError) {
        console.log("[v0] Error listing videos:", listError)
        return
      }

      if (!videosList || videosList.length === 0) {
        setVideos([])
        return
      }

      // Filter only video files (exclude folders)
      const videoFiles = videosList.filter(file => file.id && !file.id.includes("/") && file.name.includes("."))

      const formattedVideos: VideoFile[] = videoFiles.map(file => {
        const video_path = `${userId}/${file.name}`
        return {
          name: file.name,
          video_path,
          url: supabase.storage.from("video").getPublicUrl(video_path).data.publicUrl,
          created_at: file.created_at || new Date().toISOString()
        }
      })

      setVideos(formattedVideos)
    } catch (err) {
      console.log("[v0] Error fetching videos:", err)
    }
  }

  const handleDownload = async (pdfPath: string, title: string) => {
    try {
      setDownloading(pdfPath)

      // GET SIGNED URL
      const { data, error } = await supabase.storage
        .from("comic-pdfs")
        .createSignedUrl(pdfPath, 3600)

      if (error) {
        console.log("[v0] Error creating signed URL:", error)
        alert("Failed to download PDF")
        setDownloading(null)
        return
      }

      // DOWNLOAD FILE
      const response = await fetch(data.signedUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${title}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.log("[v0] Error downloading:", err)
      alert("Failed to download PDF")
    } finally {
      setDownloading(null)
    }
  }

  const handleDownloadVideo = async (videoPath: string, videoName: string) => {
    try {
      setDownloading(videoPath)

      // GET SIGNED URL
      const { data, error } = await supabase.storage
        .from("video")
        .createSignedUrl(videoPath, 3600)

      if (error) {
        console.log("[v0] Error creating signed URL:", error)
        alert("Failed to download video")
        setDownloading(null)
        return
      }

      // DOWNLOAD FILE
      const response = await fetch(data.signedUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = videoName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.log("[v0] Error downloading video:", err)
      alert("Failed to download video")
    } finally {
      setDownloading(null)
    }
  }

  const handleDelete = async (pdfPath: string) => {
    try {
      if (!confirm("Are you sure you want to delete this comic?")) {
        return
      }

      setDeleting(pdfPath)

      // DELETE FROM STORAGE
      const { error: storageError } = await supabase.storage
        .from("comic-pdfs")
        .remove([pdfPath])

      if (storageError) {
        console.log("[v0] Error deleting from storage:", storageError)
        alert("Failed to delete PDF")
        setDeleting(null)
        return
      }

      // DELETE FROM DATABASE
      const { error: dbError } = await supabase
        .from("comics")
        .delete()
        .eq("pdf_path", pdfPath)

      if (dbError) {
        console.log("[v0] Error deleting from database:", dbError)
        alert("Failed to delete comic record")
        setDeleting(null)
        return
      }

      // UPDATE LOCAL STATE
      setComics(comics.filter((comic) => comic.pdf_path !== pdfPath))
      alert("Comic deleted successfully")
    } catch (err) {
      console.log("[v0] Error deleting:", err)
      alert("Failed to delete comic")
    } finally {
      setDeleting(null)
    }
  }

  const filteredComics = comics.filter(comic => {
    const titleMatches = comic.title.toLowerCase().includes(searchTerm.toLowerCase())
    if (searchTerm === "") return true
    if (searchTerm.toLowerCase() === "comic") return comic.type === "comic"
    if (searchTerm.toLowerCase() === "coloring") return comic.type === "coloring"
    return titleMatches
  })

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-slate-500 text-sm">Loading your library...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="flex flex-col min-h-full">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-8 flex-1 w-full">
        {/* HEADER */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold mb-1 text-slate-900">
            My Library
          </h1>
          <p className="text-slate-500 text-sm">
            Manage and download your generated comics, coloring pages and videos
          </p>
        </div>

        {/* TABS */}
        <div className="mb-6 inline-flex gap-1 p-1 bg-white ring-1 ring-slate-200 rounded-xl shadow-sm">
          <button
            onClick={() => {
              setActiveTab("comics")
              setSearchTerm("")
            }}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === "comics"
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Comics &amp; Colorings
          </button>
          <button
            onClick={() => {
              setActiveTab("videos")
              setSearchTerm("")
            }}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === "videos"
                ? "bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Videos
          </button>
        </div>

        {/* SEARCH BAR */}
        {activeTab === "comics" && (
          <div className="mb-6 relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by title or filter by 'comic' or 'coloring'..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl focus-visible:ring-indigo-200"
            />
          </div>
        )}

        {/* COMICS TAB */}
        {activeTab === "comics" && (
          <>
            {comics.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-7 h-7 text-indigo-500" />}
                title="No comics yet"
                subtitle="Start by creating a comic on the comics page"
                actionLabel="Create Comic"
                onAction={() => router.push("/comic")}
              />
            ) : filteredComics.length === 0 ? (
              <EmptyState
                icon={<Search className="w-7 h-7 text-indigo-500" />}
                title="No results found"
                subtitle="Try adjusting your search filters"
                actionLabel="Clear Search"
                onAction={() => setSearchTerm("")}
              />
            ) : (
              /* COMICS GRID */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredComics.map((comic, index) => (
                  <div
                    key={comic.pdf_path}
                    className="group bg-white rounded-2xl overflow-hidden ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_32px_-12px_rgba(15,23,42,0.18)] hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                    style={{ animationDelay: `${Math.min(index, 8) * 60}ms`, animationDuration: '400ms' }}
                  >
                    {/* THUMBNAIL — first page of the actual PDF */}
                    <div className="relative aspect-[4/3] bg-slate-50 border-b border-slate-100">
                      <PdfThumbnail
                        url={previewUrls[comic.pdf_path] ?? null}
                        tone={comic.type === "comic" ? "blue" : "purple"}
                        className="w-full h-full"
                      />

                      <span
                        className={`absolute top-2.5 left-2.5 px-2.5 py-1 text-[10px] font-bold rounded-full backdrop-blur-sm ${
                          comic.type === "comic"
                            ? "bg-blue-600/90 text-white"
                            : "bg-purple-600/90 text-white"
                        }`}
                      >
                        {comic.type === "comic" ? "Comic" : "Coloring"}
                      </span>
                    </div>

                    <div className="p-4">
                      <h3 className="font-display font-semibold text-slate-900 truncate text-[15px]">
                        {comic.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 mb-3">
                        {new Date(comic.created_at).toLocaleDateString()}
                      </p>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleDownload(comic.pdf_path, comic.title)}
                          disabled={downloading === comic.pdf_path || deleting !== null}
                          className="flex-1 h-9 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                        >
                          {downloading === comic.pdf_path ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              Downloading
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5 mr-1.5" />
                              Download
                            </>
                          )}
                        </Button>

                        <Button
                          onClick={() => handleDelete(comic.pdf_path)}
                          disabled={deleting === comic.pdf_path || downloading !== null}
                          className="h-9 w-9 p-0 bg-rose-50 hover:bg-rose-100 text-rose-600 shadow-none rounded-lg"
                        >
                          {deleting === comic.pdf_path ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* VIDEOS TAB */}
        {activeTab === "videos" && (
          <>
            {videos.length === 0 ? (
              <EmptyState
                icon={<Film className="w-7 h-7 text-pink-500" />}
                title="No videos yet"
                subtitle="Start by creating a video on the videos page"
                actionLabel="Create Video"
                onAction={() => router.push("/video")}
                tone="pink"
              />
            ) : (
              /* VIDEOS GRID — compact poster tiles, click to open the player */
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {videos.map((video, index) => (
                  <div
                    key={video.video_path}
                    className="group bg-white rounded-2xl overflow-hidden ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_32px_-12px_rgba(15,23,42,0.18)] hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                    style={{ animationDelay: `${Math.min(index, 8) * 60}ms`, animationDuration: '400ms' }}
                  >
                    {/* POSTER — muted preview frame, click to open lightbox */}
                    <button
                      onClick={() => setActiveVideo(video)}
                      className="relative block w-full aspect-[3/4] bg-slate-900 overflow-hidden"
                      aria-label={`Play ${video.name}`}
                    >
                      <video
                        src={`${video.url}#t=0.1`}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-11 h-11 rounded-full bg-white/95 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                          <Play className="w-5 h-5 text-pink-600 fill-pink-600 ml-0.5" />
                        </div>
                      </div>
                    </button>

                    <div className="p-3">
                      <p className="text-xs font-semibold text-slate-900 truncate" title={video.name}>
                        {video.name}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 mb-2.5">
                        {new Date(video.created_at).toLocaleDateString()}
                      </p>

                      <Button
                        onClick={() => handleDownloadVideo(video.video_path, video.name)}
                        disabled={downloading !== null}
                        className="w-full h-8 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-[11px] font-semibold rounded-lg shadow-sm"
                      >
                        {downloading === video.video_path ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                            Downloading
                          </>
                        ) : (
                          <>
                            <Download className="w-3 h-3 mr-1.5" />
                            Download
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* VIDEO LIGHTBOX */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActiveVideo(null)}
        >
          <div
            className="relative w-full max-w-3xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveVideo(null)}
              className="absolute -top-11 right-0 flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              Close
            </button>

            <video
              src={activeVideo.url}
              controls
              autoPlay
              className="w-full max-h-[75vh] rounded-2xl bg-black shadow-2xl"
            />

            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="text-sm text-white/90 font-medium truncate">{activeVideo.name}</p>
              <Button
                onClick={() => handleDownloadVideo(activeVideo.video_path, activeVideo.name)}
                disabled={downloading !== null}
                className="h-9 shrink-0 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-xs font-semibold rounded-lg"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  )
}

function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  tone = "indigo",
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  actionLabel: string
  onAction: () => void
  tone?: "indigo" | "pink"
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white ring-1 ring-dashed ring-slate-300 rounded-3xl">
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
          tone === "pink" ? "bg-pink-50" : "bg-indigo-50"
        }`}
      >
        {icon}
      </div>
      <h2 className="font-display text-lg font-semibold mb-1 text-slate-900">{title}</h2>
      <p className="text-slate-500 mb-5 text-sm">{subtitle}</p>
      <Button
        onClick={onAction}
        className={`font-display h-11 px-6 rounded-xl text-white font-semibold shadow-lg ${
          tone === "pink"
            ? "bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 shadow-pink-500/25"
            : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-500/25"
        }`}
      >
        {actionLabel}
      </Button>
    </div>
  )
}
