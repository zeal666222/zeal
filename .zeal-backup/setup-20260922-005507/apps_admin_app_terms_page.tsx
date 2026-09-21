// ZEAL_FIX_PHASE1_TERMS — same-origin stub so prefetches never 404 or CORS.
export const dynamic = "force-dynamic";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-black text-white mb-6">Terms of Service</h1>
      <p className="text-slate-400 mb-4">
        The full Terms of Service live on the Zeal seeker portal.
      </p>
      <a
        href="https://zeal-web-red.vercel.app/terms"
        className="inline-block mt-6 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold"
      >
        Read the full document →
      </a>
    </div>
  );
}
