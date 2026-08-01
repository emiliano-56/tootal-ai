"use client"

import { useRouter } from "next/navigation"
import { Film, BookOpen } from "lucide-react"
import { Footer } from "@/components/footer"

export default function SelectPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      <div className="flex-1 px-6 py-10">
        {/* TOP LEFT: BACK HOME BUTTON */}
        <div className="mb-8 pb-4 border-b border-gray-200">
          <a
            href="/dashboard"
            className="inline-block px-4 py-2 bg-white hover:bg-blue-700 hover:text-white transition rounded-lg text-sm font-medium border border-gray-200"
          >
            ← Back home
          </a>
        </div>

        {/* CENTER: TITLE AND SUBTITLE */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-2 text-black">
            What would you like to create?
          </h1>

          <p className="text-lg text-gray-500">
            Choose your creative format
          </p>
        </div>

        {/* SELECTION CARDS */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* VIDEO CARD */}
          <button
            onClick={() => router.push("/video")}
            className="group p-8 rounded-2xl bg-white hover:bg-blue-50 transition border border-gray-200 cursor-pointer"
          >
            <div className="text-center space-y-4">

              <div className="flex justify-center mb-4">
                <Film className="w-16 h-16 text-blue-600" />
              </div>

              <h2 className="text-3xl font-bold text-black">
                Video
              </h2>

              <p className="text-gray-500">
                Transform your ideas into stunning AI-generated videos with custom aspect ratios and audio
              </p>

              <div className="pt-4 inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 transition rounded-lg font-medium text-white group-hover:scale-105 transform">
                Create Video
              </div>

            </div>
          </button>

          {/* COMIC CARD */}
          <button
            onClick={() => router.push("/comic")}
            className="group p-8 rounded-2xl bg-white hover:bg-blue-50 transition border border-gray-200 cursor-pointer"
          >
            <div className="text-center space-y-4">

              <div className="flex justify-center mb-4">
                <BookOpen className="w-16 h-16 text-blue-600" />
              </div>

              <h2 className="text-3xl font-bold text-black">
                Comic
              </h2>

              <p className="text-gray-500">
                Create engaging comic strips with your unique story and visual style
              </p>

              <div className="pt-4 inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 transition rounded-lg font-medium text-white group-hover:scale-105 transform">
                Create Comic
              </div>

            </div>
          </button>

        </div>
      </div>

      <Footer />
    </div>
  )
}