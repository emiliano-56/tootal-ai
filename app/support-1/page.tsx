'use client'

import Link from "next/link";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-white text-black flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Contact Support
        </h1>

        <p className="text-gray-500 text-base md:text-lg mb-10">
          Need help or have questions? Reach out to us via email and we’ll get
          back to you as soon as possible.
        </p>

        {/* Forgot Password Notice */}
        <div className="mb-10 p-5 rounded-2xl border border-gray-200 bg-blue-50">
          <h2 className="text-xl font-semibold text-blue-600 mb-2">
            Forgot Your Password?
          </h2>

          <p className="text-gray-500">
            If you have forgotten your password, please contact one of the
            support email addresses below. To help us verify your account and
            assist you faster, make sure to include the email address you used
            when registering your account.
          </p>
        </div>

        <div className="flex flex-col gap-4 items-center">
          <a
            href="mailto:aipippipinfo@gmail.com"
            className="w-full md:w-auto px-8 py-4 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            aipippipinfo@gmail.com
          </a>

          <a
            href="mailto:gdev615x@gmail.com"
            className="w-full md:w-auto px-8 py-4 rounded-2xl border border-gray-200 text-blue-600 font-semibold hover:bg-blue-600 hover:text-white transition"
          >
            aipippipinfo@gmail.com
          </a>

          <Link
            href="/"
            className="mt-4 w-full md:w-auto px-8 py-4 rounded-2xl bg-white border border-gray-200 text-black font-semibold hover:bg-blue-700 hover:text-white transition"
          >
            Back to Home
          </Link>
        </div>

        <footer className="mt-16 text-sm text-gray-500">
          © 2026 ComicTale AI. All rights reserved.
        </footer>
      </div>
    </main>
  );
}