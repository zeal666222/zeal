// ZEAL_CORS_FIX — stub legal page so prefetches don't 404
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-black text-white mb-6">Terms of Service</h1>
      <p className="text-slate-400 mb-4">
        The full terms of service live on the Zeal web portal.
      </p>
      <a
        href="https://zeal-web-red.vercel.appapps/admin/app/terms/page.tsx"
        className="inline-block mt-6 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold"
      >
        Read the full document →
      </a>
    </div>
  );
}
