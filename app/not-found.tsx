export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="text-center max-w-2xl">

        {/* Coloring Book Illustration */}
        <div className="flex justify-center mb-8">
          <svg
            width="220"
            height="220"
            viewBox="0 0 220 220"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_0_20px_rgba(250,204,21,0.4)]"
          >
            {/* Coloring Book */}
            <rect
              x="40"
              y="40"
              width="140"
              height="120"
              rx="8"
              stroke="#FACC15"
              strokeWidth="4"
            />

            <line
              x1="110"
              y1="40"
              x2="110"
              y2="160"
              stroke="#FACC15"
              strokeWidth="4"
            />

            {/* Left Page */}
            <circle
              cx="80"
              cy="85"
              r="18"
              stroke="#FACC15"
              strokeWidth="3"
            />

            <path
              d="M65 120C70 105 90 105 95 120"
              stroke="#FACC15"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Right Page */}
            <path
              d="M135 80L150 60L165 80L150 100Z"
              stroke="#FACC15"
              strokeWidth="3"
            />

            <circle
              cx="150"
              cy="120"
              r="15"
              stroke="#FACC15"
              strokeWidth="3"
            />

            {/* Pencil */}
            <g transform="rotate(-25 170 170)">
              <rect
                x="145"
                y="145"
                width="50"
                height="12"
                rx="3"
                fill="#FACC15"
              />
              <path
                d="M195 145L210 151L195 157Z"
                fill="#FFF"
              />
            </g>
          </svg>
        </div>

        <h1 className="text-yellow-400 text-8xl font-bold mb-4">
          404
        </h1>

        <h2 className="text-white text-3xl font-semibold mb-3">
          Page Not Found
        </h2>

        <p className="text-gray-400 mb-8">
          Oops! This coloring page seems to have wandered outside the lines.
        </p>

        <a
          href="/"
          className="inline-flex items-center px-8 py-3 bg-yellow-400 text-black font-bold rounded-xl hover:bg-yellow-300 transition-all duration-300 hover:scale-105"
        >
          Return Home
        </a>
      </div>
    </div>
  );
}