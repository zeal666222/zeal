// Original, tailored prose for Zeal's legal surface. Written for this product
// (India-based astrology/therapy marketplace, ₹ wallet, Razorpay rails,
// Supabase-hosted data, Cloudflare edge). Not a copy of any other site.
// Kept in one module so the four pages render identically and stay in sync.

export interface LegalSection {
  title: string;
  paragraphs: string[];
  list?: string[];
}

type Doc = "privacy" | "terms" | "refund" | "cookies";

const PRIVACY: LegalSection[] = [
  {
    title: "What we collect",
    paragraphs: [
      "We only collect what a session actually needs. When you sign up we store an email, a display name, a username and (optionally) a profile picture. When you consult an astrologer or therapist we store your birth details — date, time and place — so the ephemeris engine can compute a kundali. Chat transcripts, wallet ledger entries and booking records stay with your account.",
      "We do not ask for government ID, bank credentials, or health data. Anything sensitive you type into a chat is visible to the consultant on the other side and to our moderation queue only if either of you raises a dispute.",
    ],
    list: [
      "Account data — email, name, username, avatar, role, verification state.",
      "Astrological inputs — date / time / place of birth, partner details for matching.",
      "Financial data — wallet balance, escrow holds, session minutes billed, refund history. Razorpay card and UPI numbers never reach our servers; only the payment id and last four digits come back to us.",
      "Usage data — pages viewed, referrer, coarse country derived from IP, and a session identifier so realtime chat can reconnect.",
    ],
  },
  {
    title: "Why we process it",
    paragraphs: [
      "Each byte we hold ties back to something you asked for: a reading, a chat with a real astrologer, a booking, or a support ticket. We don't sell data, we don't run third-party ad pixels, and we don't build shadow profiles of you across other apps.",
    ],
    list: [
      "Deliver the service you paid or clicked for.",
      "Keep the platform honest — rate-limit abuse, detect fraud, resolve disputes.",
      "Meet our obligations under the Digital Personal Data Protection Act, 2023 (India) and the Information Technology Act, 2000.",
    ],
  },
  {
    title: "Where your data lives",
    paragraphs: [
      "Primary storage is Postgres hosted by Supabase in their ap-south-1 (Mumbai) region. Realtime chat fan-out uses Supabase Realtime. File uploads — avatars, palm photographs, kundali screenshots — go to a Cloudflare R2 bucket pinned to the same region. Our application servers run on Vercel (edge + serverless) and Cloudflare Workers for chat streaming.",
      "We do not currently have an on-disk backup outside these two providers. If that changes we'll tell you here first.",
    ],
  },
  {
    title: "How long we keep it",
    paragraphs: [
      "Account data lives as long as your account does. If you delete your account we tombstone the row for 30 days (so an accidental deletion is recoverable) and then hard-remove it. Financial records — invoices, escrow releases, refund history — we keep for eight years because Indian tax law requires it. Chat transcripts older than 24 months are anonymised: user id and any birth details are replaced with a hash so we can still count sessions.",
    ],
  },
  {
    title: "Sharing with processors",
    paragraphs: [
      "These are the only third parties that ever see identifiable data, each under a written data-processing agreement:",
    ],
    list: [
      "Supabase — database, auth, realtime.",
      "Cloudflare — R2 storage, Workers runtime, image delivery.",
      "Vercel — Next.js hosting and edge cache.",
      "Razorpay — payment processing under PCI-DSS; we never see card numbers.",
      "Groq, Workers AI and Pollinations — the AI reading providers. Prompts sent to them contain the birth details and the specific question, not your account id.",
    ],
  },
  {
    title: "Your rights",
    paragraphs: [
      "Under India's DPDP Act, 2023 and, where you're from elsewhere, the GDPR, you can ask us to (a) show you what we hold, (b) fix anything inaccurate, (c) erase your data, (d) hand it to you in a machine-readable file, and (e) withdraw marketing consent. Any of these can be done from the app: Settings → Account. For the machine-readable export or a full erasure of the eight-year financial history, email support@zealer.co.in and we'll respond within 30 days.",
    ],
  },
  {
    title: "Children",
    paragraphs: [
      "Zeal is for adults. We don't knowingly accept users under 18, and we don't market to them. If you tell us a minor has an account we'll close it within 72 hours and delete the profile.",
    ],
  },
  {
    title: "If something goes wrong",
    paragraphs: [
      "A breach of unencrypted personal data will be reported to the Indian Computer Emergency Response Team (CERT-In) and to the Data Protection Board as the DPDP Act requires, and to every affected user by email within 72 hours of our confirming it. You'll get the specific data involved, not a boilerplate apology.",
    ],
  },
  {
    title: "Changes to this policy",
    paragraphs: [
      "When we change anything material we'll email every active user 14 days before the change takes effect and stamp the new date at the top of this page. Non-material edits (typo fixes, clarifications) go live with a shorter notice in the changelog.",
    ],
  },
];

const TERMS: LegalSection[] = [
  {
    title: "Who you're dealing with",
    paragraphs: [
      "Zeal (operating as zealer.co.in) is the marketplace. We connect you with consultants who offer astrological, therapeutic and wellness services, and we run free AI tools — kundali, tarot, numerology, horoscope, panchang, dream interpretation, guna milan and palmistry — for anyone to try. The consultants are independent; when you book, you're hiring them, not us. Our job is escrow, quality, safety rails, and getting your money back if the session didn't happen.",
    ],
  },
  {
    title: "Using the product",
    paragraphs: [
      "You need an account to book, chat or post. One person, one account. Do not share credentials, scrape the platform, or automate the AI services in ways that starve other users. Reverse-engineering the realtime protocol, mining the DB, or probing the API without permission violates these terms and, in some cases, Indian law.",
    ],
  },
  {
    title: "What you own",
    paragraphs: [
      "Your birth details, your chat transcripts, your posts, your profile picture — all yours. By uploading you give us a limited, revocable licence to display, cache and moderate them so the product works. Consultants own their readings; you get a personal-use licence. Neither of us gets to sublicense what the other made.",
    ],
  },
  {
    title: "Money, minutes, and escrow",
    paragraphs: [
      "Live sessions bill by the minute at the rate the consultant published when you booked. When you start, we move the estimated cost into escrow; when the session ends, we release the actual minutes and refund the difference to your wallet. Consultations that never start are fully refundable. Read the Refund Policy for the details.",
    ],
  },
  {
    title: "Conduct",
    paragraphs: [
      "We take safety seriously on a platform where people talk about grief, breakups, addiction and family pressure. Zero tolerance for:",
    ],
    list: [
      "Sexual harassment or unwanted advances toward a consultant or another user.",
      "Requests that a consultant break confidentiality or share another client's data.",
      "Medical, legal, or financial advice being given by someone who is not licensed to give it.",
      "Hate speech, slurs, or content targeting a religion, caste, gender or ethnicity.",
    ],
  },
  {
    title: "Consultant obligations",
    paragraphs: [
      "Verified consultants pass an identity check, a domain-credential check where applicable, and a trial session. Once verified they must keep their availability calendar honest, respond to bookings within 12 hours, and never offer to move the conversation off-platform. Break these and we can freeze earnings and unlist the profile.",
    ],
  },
  {
    title: "Free services and AI output",
    paragraphs: [
      "Every free reading is AI-generated. It's offered for reflection, not as a substitute for medical, legal, or financial advice. Sometimes the AI is wrong. Do not make irreversible life decisions based on a tarot spread or a numerology number.",
    ],
  },
  {
    title: "Termination",
    paragraphs: [
      "You can close your account from Settings at any time. If you still hold wallet balance we'll refund it to the original payment method. We can also suspend or terminate accounts that clearly break these terms — with notice where the breach is fixable, without notice where continuing the account endangers other users.",
    ],
  },
  {
    title: "Governing law",
    paragraphs: [
      "These terms are governed by the laws of India. Any dispute we can't resolve informally goes to the courts of Bengaluru, Karnataka.",
    ],
  },
];

const REFUND: LegalSection[] = [
  {
    title: "Free services",
    paragraphs: [
      "Nothing to refund — kundali, tarot, numerology, horoscope, panchang, guna milan, palmistry and dream interpretation are free. If one fails to produce a reading, we log it as a bug and let you retry without hitting any rate limit.",
    ],
  },
  {
    title: "Live consultations (per-minute billing)",
    paragraphs: [
      "You're charged by the minute while the session is active. When the session ends we release the actual minutes from escrow and return the unused portion to your wallet within seconds — no waiting for a banking cycle.",
    ],
  },
  {
    title: "Full refund cases",
    paragraphs: [
      "We refund the escrowed amount in full to your original payment method when:",
    ],
    list: [
      "The consultant never joins within 15 minutes of the booked start time.",
      "The consultant joins but terminates without providing the agreed service.",
      "You cancel at least 12 hours before a scheduled booking.",
      "The platform itself fails — a bug, an outage, or a payment that hit our gateway but never appeared in your wallet.",
    ],
  },
  {
    title: "Partial refunds",
    paragraphs: [
      "If the session started and something went materially wrong — you had to leave partway through for a legitimate reason, or the connection dropped and the transcript shows only a fragment — raise it from the booking detail page. Our team reviews within 5 business days and typically credits the unwatched minutes back to your wallet.",
    ],
  },
  {
    title: "No refund cases",
    paragraphs: [
      "You change your mind after the consultant joins, you disconnect yourself without telling them, or you simply didn't like the reading — these are not refundable. Astrology and therapy are subjective; you're paying for a professional's time, and once they've spent it it's theirs.",
    ],
  },
  {
    title: "Wallet balance",
    paragraphs: [
      "Money that goes into your wallet can come back out to the same UPI id, card or bank account it came from. Refund requests on unused wallet balance are honoured within 10 business days of a written request, minus the payment gateway fee (currently 2.3% + GST) if the balance is under ₹500. Above ₹500 the gateway fee is on us.",
    ],
  },
  {
    title: "Disputes",
    paragraphs: [
      "Email support@zealer.co.in with your booking id. Escalate within 14 days of the session. We keep the chat transcript and billing ledger for the review, so the more specific your complaint, the faster we can rule.",
    ],
  },
];

const COOKIES: LegalSection[] = [
  {
    title: "The short version",
    paragraphs: [
      "We use three kinds of cookies. The first are absolutely necessary to keep you logged in and to defend against CSRF. The second are performance cookies that count page loads. The third are preferences — dark-mode toggle, which tab you last had open on your profile. No advertising cookies, ever.",
    ],
  },
  {
    title: "Necessary",
    paragraphs: [
      "`sb-<ref>-access-token`, `sb-<ref>-refresh-token`, and `sb-<ref>-cookie-name-counter` are set by Supabase's auth library. Without them you can't sign in. `__Secure-NextAuth.csrf` guards state-changing form submissions. `zeal.session` holds a per-tab id so realtime chat knows which browser to reconnect.",
    ],
  },
  {
    title: "Preferences",
    paragraphs: [
      "`zeal.theme` remembers dark or light mode so a page refresh doesn't flash white. `zeal.last-tab` remembers whether you last left the profile page on Posts, About or Security. Both are optional — clearing them costs you a click, nothing else.",
    ],
  },
  {
    title: "Performance",
    paragraphs: [
      "Vercel Analytics sets a single `_vercel` cookie to sample a percentage of your traffic for LCP / INP / CLS. No cross-site identifiers, no fingerprinting. You can opt out via the Settings → Privacy screen; we also honour `Global Privacy Control` and `Do Not Track` from the browser.",
    ],
  },
  {
    title: "Local storage",
    paragraphs: [
      "Zustand persists `zeal-storage` in localStorage — your cached user object, wallet snapshot and up to 50 unread notifications, so the app looks warm on a cold reload. This stays inside the browser and never leaves your device unless the account signs back in. Clearing site data removes it.",
    ],
  },
  {
    title: "Managing cookies",
    paragraphs: [
      "You can delete or block them from the browser's own settings. Blocking the Supabase auth cookies will log you out of Zeal everywhere and stop realtime chat from working; the preferences and analytics cookies are safe to disable.",
    ],
  },
];

export function legalSectionData(doc: Doc): LegalSection[] {
  switch (doc) {
    case "privacy": return PRIVACY;
    case "terms":   return TERMS;
    case "refund":  return REFUND;
    case "cookies": return COOKIES;
  }
}
