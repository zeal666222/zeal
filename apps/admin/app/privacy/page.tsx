// ZEAL_FIX_PHASE1_PRIVACY — same-origin stub so prefetches never 404 or CORS.
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-black text-white mb-6">Privacy Policy</h1>
      <p className="text-slate-400 mb-4">
        The full Privacy Policy lives on the Zeal seeker portal.
      </p>
      <a
        href="https://zeal-web-red.vercel.app/privacy"
        className="inline-block mt-6 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold"
      >
        Read the full document →
      </a>
    </div>
  );
}
