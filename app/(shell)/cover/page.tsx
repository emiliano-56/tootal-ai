"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  ImageIcon,
  Download,
  ChevronDown,
  ArrowLeft,
  Save,
  Palette,
  X,
  Trash2,
  Upload,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase"

const aspectRatios = [
  {
    label: "KDP Paperback Cover (2:3)",
    value: "2:3",
  },
  {
    label: "Kindle Cover (9:16)",
    value: "9:16",
  },
  {
    label: "Square Book Cover (1:1)",
    value: "1:1",
  },
  {
    label: "Cinematic Book Cover (16:9)",
    value: "16:9",
  },
];

// 👉 BOOK COVER NICHES (ONLY 3 FOR NOW)
const niches = [
  {
    label: "Fantasy Book Cover",
    value: "fantasy book cover design",
  },
  {
    label: "Business Book Cover",
    value: "business book cover design",
  },
  {
    label: "Romance Book Cover",
    value: "romance book cover design",
  },
  {
    label: "Sci-Fi Book Cover",
    value: "sci-fi book cover design",
  },
  {
    label: "Horror Book Cover",
    value: "horror book cover design",
  },
  {
    label: "Mystery Thriller Book Cover",
    value: "mystery thriller book cover design",
  },
  {
    label: "Comic Book Cover",
    value: "comic book cover design",
  },
  {
    label: "Anime Manga Book Cover",
    value: "anime manga book cover design",
  },
  {
    label: "Children's Book Cover",
    value: "children's book cover design",
  },
  {
    label: "Self-Help Book Cover",
    value: "self-help book cover design",
  },
  {
    label: "Motivational Book Cover",
    value: "motivational book cover design",
  },
  {
    label: "Spiritual Book Cover",
    value: "spiritual book cover design",
  },
  {
    label: "Health & Fitness Book Cover",
    value: "health and fitness book cover design",
  },
  {
    label: "Cookbook Cover",
    value: "cookbook cover design",
  },
  {
    label: "Biography Book Cover",
    value: "biography book cover design",
  },
  {
    label: "Historical Fiction Book Cover",
    value: "historical fiction book cover design",
  },
  {
    label: "Adventure Book Cover",
    value: "adventure book cover design",
  },
  {
    label: "Cyberpunk Book Cover",
    value: "cyberpunk book cover design",
  },
  {
    label: "Minimalist Modern Book Cover",
    value: "minimalist modern book cover design",
  },
  {
    label: "Luxury Elegant Book Cover",
    value: "luxury elegant book cover design",
  },
];

interface SavedCover {
  id: string;
  name: string;
  url: string;
  created_at: string;
  image_path: string;
}

export default function Page() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState("");
  const [savedCovers, setSavedCovers] = useState<SavedCover[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [savingCover, setSavingCover] = useState(false);
  const [loadingCovers, setLoadingCovers] = useState(false);

  const [aspectRatio, setAspectRatio] = useState("2:3");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [nicheOpen, setNicheOpen] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState("");

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://zoop-a1-v2.onrender.com";



  const loadSavedCovers = async () => {
    try {
      setLoadingCovers(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("book_covers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const coversWithUrls = await Promise.all(
        (data || []).map(async (cover) => {
          const { data: signed } = await supabase.storage
            .from("book-covers")
            .createSignedUrl(cover.image_path, 3600);

          return {
            ...cover,
            url: signed?.signedUrl || "",
          };
        })
      );

      setSavedCovers(coversWithUrls);
    } catch (error) {
      console.error("Error loading covers:", error);
    } finally {
      setLoadingCovers(false);
    }
  };

  const selectAspectRatio = (ratio: string) => {
    setAspectRatio(ratio);

    const cleanedPrompt = prompt.replace(
      /aspect ratio\s*:\s*\d+:\d+/gi,
      ""
    );

    const updatedPrompt = cleanedPrompt.trim().replace(/,+$/, "");

    setPrompt(
      updatedPrompt
        ? `${updatedPrompt}, aspect ratio: ${ratio}`
        : `aspect ratio: ${ratio}`
    );

    setDropdownOpen(false);
  };

  const selectNiche = (niche: string) => {
    setSelectedNiche(niche);

    const cleanedPrompt = prompt.replace(/niche\s*:\s*[^,]+/gi, "");

    const updatedPrompt = cleanedPrompt.trim().replace(/,+$/, "");

    setPrompt(
      updatedPrompt
        ? `${updatedPrompt}, niche: ${niche}`
        : `niche: ${niche}`
    );

    setNicheOpen(false);
  };

  const deductCredits = async (userId: string) => {
    try {
      // get current credits
      const { data, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single()

      if (error || !data) return false

      const currentCredits = Number(data.credits || 0)

      if (currentCredits < 10) {
        toast.error('Not enough credits (10 credits required)')
        return false
      }

      const newCredits = currentCredits - 10

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ credits: newCredits })
        .eq('id', userId)

      if (updateError) {
        console.error(updateError)
        return false
      }

      return true
    } catch (err) {
      console.error(err)
      return false
    }
  }

  const generateImage = async () => {
    if (!prompt.trim()) return;

    let userId: string | null = null;

    try {
      setLoading(true);
      setGeneratedImage("");

      // GET USER FIRST
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Please login first");
        return;
      }

      userId = user.id;

      // CHECK + DEDUCT CREDITS BEFORE GENERATION
      const allowed = await deductCredits(user.id);

      if (!allowed) {
        setLoading(false);
        return;
      }

      // GENERATE IMAGE
      const response = await fetch(
        `${API_BASE}/nano/generate-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            aspect_ratio: aspectRatio,
            output_format: "png",
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setGeneratedImage(data.image_url);
        toast.success("Book cover generated (10 credits used)");
      } else {
        toast.error(data.message || "Generation failed");

        // OPTIONAL REFUND LOGIC (recommended)
        // you can add refund later if API fails
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;

    const encoded = encodeURIComponent(generatedImage);

    window.open(
      `${API_BASE}/nano/download-image?image_url=${encoded}`,
      "_blank"
    );
  };

  const downloadSavedCover = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download image");
    }
  };

  const uploadCover = async () => {
    if (!generatedImage) {
      toast.error("Generate a book cover first");
      return;
    }

    try {
      setSavingCover(true);

      // GET USER
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Please login");
        return;
      }

      // FILE NAME
      const filename = `book-cover-${Date.now()}.png`;

      // STORAGE PATH
      const filePath = `${user.id}/${filename}`;

      // PROXY IMAGE TO GET BASE64
      const proxyResponse = await fetch("/api/upload-cover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: generatedImage,
        }),
      });

      const proxyData = await proxyResponse.json();

      if (!proxyResponse.ok || proxyData.error) {
        toast.error(proxyData.error || "Failed to process image");
        return;
      }

      // UPLOAD TO SUPABASE
      const base64Data = proxyData.base64;
      const mimeType = proxyData.mimeType;
      const binaryString = Buffer.from(base64Data, "base64");

      const { error: uploadError } = await supabase.storage
        .from("book-covers")
        .upload(filePath, binaryString, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        toast.error("Failed to upload to storage");
        return;
      }

      // SAVE METADATA TO DATABASE
      const { error: dbError } = await supabase
        .from("book_covers")
        .insert([
          {
            user_id: user.id,
            name: filename,
            image_path: filePath,
            prompt,
          },
        ]);

      if (dbError) {
        toast.error("Failed to save cover metadata");
        return;
      }

      toast.success("Book cover uploaded successfully!");

      await loadSavedCovers();

      setShowModal(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload cover");
    } finally {
      setSavingCover(false);
    }
  };

  const deleteCover = async (
    id: string,
    imagePath: string
  ) => {
    try {
      // DELETE STORAGE FILE
      const { error: storageError } = await supabase.storage
        .from("book-covers")
        .remove([imagePath]);

      if (storageError) throw storageError;

      // DELETE DATABASE RECORD
      const { error: dbError } = await supabase
        .from("book_covers")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      setSavedCovers(
        savedCovers.filter((cover) => cover.id !== id)
      );
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <main className="min-h-screen bg-white text-black">
      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            background: "#F5F5F5",
            color: "#2563EB",
            border: "1px solid rgba(37, 99, 235, 0.2)",
            borderRadius: "0.75rem",
            padding: "12px 16px",
            fontSize: "0.875rem",
          },
        }}
      />

      {/* TOP BAR */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-black transition hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25">
              <ImageIcon className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
      </section>

      {/* HERO */}
      <section className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold leading-tight md:text-4xl text-black">
              AI Amazon KDP
              <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Book Cover Generator
              </span>
            </h1>

            <p className="mt-3 text-sm text-gray-500">
              Generate professional Amazon KDP book covers for ebooks, paperback, and Kindle publishing instantly.
            </p>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-2 bg-gray-50">

        {/* LEFT PANEL */}
        <div className="space-y-4">
          <div className="rounded-3xl border border-gray-100 shadow-sm bg-white p-5">

            {/* HEADER */}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-black">Prompt</h2>

              {/* ACTIONS */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowModal(true);
                    loadSavedCovers();
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-blue-600 hover:bg-blue-600 hover:text-white transition"
                >
                  <Save className="h-4 w-4" />
                </button>

                {/* RATIO */}
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-black hover:border-blue-400 transition"
                  >
                    <ImageIcon className="h-4 w-4 text-blue-600" />
                    Ratio
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                      {aspectRatios.map((ratio) => (
                        <button
                          key={ratio.value}
                          onClick={() => selectAspectRatio(ratio.value)}
                          className={`mb-1 w-full rounded-xl px-3 py-3 text-left text-xs transition-colors ${
                            aspectRatio === ratio.value
                              ? "bg-blue-50 text-blue-700 font-semibold"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {ratio.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* NICHE */}
                <div className="relative">
                  <button
                    onClick={() => setNicheOpen(!nicheOpen)}
                    className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-black hover:border-blue-400 transition"
                  >
                    <Palette className="h-4 w-4 text-blue-600" />
                    Niche
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>

                  {nicheOpen && (
                    <div className="absolute right-0 z-20 mt-2 h-60 w-72 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                      {niches.map((niche) => (
                        <button
                          key={niche.value}
                          onClick={() => selectNiche(niche.value)}
                          className={`mb-1 w-full rounded-xl px-3 py-3 text-left text-xs transition-colors ${
                            selectedNiche === niche.value
                              ? "bg-blue-50 text-blue-700 font-semibold"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {niche.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TEXTAREA */}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Professional Amazon KDP book cover design, typography, cinematic composition, high quality..."
              className="h-52 w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
            />

            {/* BUTTON */}
            <button
              onClick={generateImage}
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 px-4 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all"
            >
              {loading ? (
                "Generating..."
              ) : (
                <>
                  <Palette className="h-4 w-4" />
                  Create Book Cover (10 credits)
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex min-h-[500px] items-center justify-center rounded-3xl border border-gray-100 shadow-sm bg-white p-4">

          {!generatedImage && !loading && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 mx-auto">
                <ImageIcon className="h-7 w-7 text-blue-500" />
              </div>
              <p className="text-sm text-gray-500">Generated book cover will appear here</p>
            </div>
          )}

          {loading && (
            <div className="text-center">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-sm text-gray-500 mt-3">Generating...</p>
            </div>
          )}

          {generatedImage && (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <img
                src={generatedImage}
                className="max-h-[400px] max-w-full object-contain rounded-2xl shadow-lg"
              />

              <div className="mt-4 flex w-full gap-2">
                <button
                  onClick={downloadImage}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-3 text-white font-semibold shadow-md shadow-blue-500/25 transition-all"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>

                <button
                  onClick={uploadCover}
                  disabled={savingCover}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gray-100 hover:bg-gray-200 px-4 py-3 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </button>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* MODAL - ALWAYS VISIBLE */}
      <div
        className={`fixed inset-0 z-50 flex transition-opacity duration-300 ${
          showModal ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        {/* Backdrop */}
        {showModal && (
          <div
            className="flex-1 bg-black/40 pointer-events-auto"
            onClick={() => setShowModal(false)}
          />
        )}

        {/* Modal Panel - Right Side */}
        <div
          className={`ml-auto w-full max-w-md bg-white border-l border-gray-200 flex flex-col transition-transform duration-300 shadow-2xl ${
            showModal ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <h2 className="text-lg font-bold text-black">Saved Book Covers</h2>
            <button
              onClick={() => setShowModal(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-blue-600 hover:bg-blue-600 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {loadingCovers ? (
              <p className="text-center text-gray-500 text-sm">Loading covers...</p>
            ) : savedCovers.length === 0 ? (
              <p className="text-center text-gray-500 text-sm">No saved covers yet</p>
            ) : (
              <div className="space-y-4">
                {savedCovers.map((cover) => (
                  <div
                    key={cover.id}
                    className="rounded-2xl border border-gray-100 shadow-sm bg-white p-3 overflow-hidden"
                  >
                    <img
                      src={cover.url}
                      alt={cover.name}
                      className="w-full rounded-lg mb-3"
                    />

                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 truncate">
                        {new Date(cover.created_at).toLocaleDateString()}
                      </p>

                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadSavedCover(cover.url, cover.name)}
                          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-3 py-2 text-xs font-bold text-white"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </button>

                        <button
                          onClick={() => deleteCover(cover.id, cover.image_path)}
                          className="flex items-center justify-center gap-1 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


        </div>
      </div>
    </main>
  );
}
