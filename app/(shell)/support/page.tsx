'use client'

import Link from "next/link";
import { HelpCircle, Mail, KeyRound, ArrowLeft } from "lucide-react";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-black flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl text-center bg-white border border-gray-100 shadow-sm rounded-3xl p-8 md:p-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
          <HelpCircle className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold mb-4 text-black">
          Contact Support
        </h1>

        <p className="text-gray-500 text-base mb-8">
          Need help or have questions? Reach out to us via email and we’ll get
          back to you as soon as possible.
        </p>

        {/* Forgot Password Notice */}
        <div className="mb-8 p-5 rounded-2xl bg-blue-50 text-left flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-blue-700 mb-1">
              Forgot Your Password?
            </h2>

            <p className="text-gray-600 text-sm">
              If you have forgotten your password, please contact one of the
              support email addresses below. To help us verify your account and
              assist you faster, make sure to include the email address you used
              when registering your account.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 items-center">
          <a
            href="mailto:aipippipinfo@gmail.com"
            className="w-full md:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            aipippipinfo@gmail.com
          </a>

          <a
            href="mailto:gdev615x@gmail.com"
            className="w-full md:w-auto px-8 py-3.5 rounded-xl border border-gray-200 text-black font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4 text-blue-600" />
            gdev@gmail.com
          </a>

          <Link
            href="/dashboard"
            className="mt-2 w-full md:w-auto px-8 py-3.5 rounded-xl bg-gray-100 text-black font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        <footer className="mt-10 text-sm text-gray-400">
          © 2026 ComicAgent AI. All rights reserved.
        </footer>
      </div>
    </main>
  );
}