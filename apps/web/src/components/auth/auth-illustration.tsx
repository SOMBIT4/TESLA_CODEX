import { MapPin, Route } from "lucide-react";

export default function AuthIllustration() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/10 sm:p-7">
      <div className="absolute -right-16 -top-16 size-48 rounded-full bg-indigo-500/30 blur-3xl" />
      <div className="absolute -bottom-20 -left-12 size-48 rounded-full bg-teal-400/20 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Route preview
            </p>
            <p className="mt-1 text-xl font-semibold">Made for Dhaka days</p>
          </div>
          <Route aria-hidden="true" className="size-6 text-teal-300" />
        </div>

        <svg
          aria-label="Dhaka route from Banani to Mohakhali"
          className="mt-8 h-auto w-full"
          role="img"
          viewBox="0 0 420 280"
        >
          <path
            d="M62 204 C110 168 128 78 218 96 S304 218 366 132"
            fill="none"
            stroke="#334155"
            strokeDasharray="6 10"
            strokeWidth="2"
          />
          <path
            d="M62 204 C110 168 128 78 218 96 S304 218 366 132"
            fill="none"
            stroke="#5eead4"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <circle cx="62" cy="204" fill="#818cf8" r="13" />
          <circle cx="218" cy="96" fill="#fbbf24" r="10" />
          <circle cx="366" cy="132" fill="#2dd4bf" r="13" />
          <circle cx="62" cy="204" fill="#0f172a" r="4" />
          <circle cx="366" cy="132" fill="#0f172a" r="4" />
          <text fill="#e2e8f0" fontSize="15" fontWeight="600" x="43" y="242">
            Banani
          </text>
          <text fill="#e2e8f0" fontSize="15" fontWeight="600" x="183" y="66">
            Gulshan 1
          </text>
          <text fill="#e2e8f0" fontSize="15" fontWeight="600" x="315" y="170">
            Mohakhali
          </text>
        </svg>

        <div className="flex items-center gap-2 border-t border-white/10 pt-4 text-sm text-slate-300">
          <MapPin aria-hidden="true" className="size-4 text-indigo-300" />
          <span>Clear pickup, clear destination, clear fare.</span>
        </div>
      </div>
    </div>
  );
}
