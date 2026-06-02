// =============================================
//  DigiCART – Editable Data
//  Edit this file to update events, memos, and news
//  without touching the main HTML or JS files.
// =============================================

const DIGICART_DATA = {

  // ── LIVE EVENTS SOURCE (Google Sheet) ─────────────────────
  // Paste the PUBLISHED CSV link of your "Events" sheet tab here to load
  // Upcoming Events live from Google Sheets. Leave it as "" to use the
  // static list below instead.
  //
  // Expected sheet layout (tab named "Events"):
  //   A1 = Month (e.g. November)   B1 = Year (e.g. 2026)
  //   A2:A = Day of month          B2:B = Event name for that day
  //
  // How to get the link: in your Google Sheet →
  //   File → Share → Publish to web → pick the "Events" sheet
  //   + "Comma-separated values (.csv)" → Publish → copy the link.
  eventsCsvUrl: "",

  // ── UPCOMING EVENTS (static fallback) ─────────────────────
  // Format: { month: "Month YYYY", day: "DD", name: "Event Name" }
  // Use <sup>ordinal</sup> for ordinals like 52<sup>nd</sup>
  events: [
    {
      month: "November 2026",
      items: [
        { day: "28", name: "CHE 52<sup>nd</sup> Foundation Anniversary" },
        { day: "28", name: "HEALS Awarding Ceremony" },
        { day: "29", name: "Alumni Talks" },
        { day: "30", name: "CHE Student Research Congress" },
      ]
    }
    // Add more months below:
    // {
    //   month: "December 2026",
    //   items: [
    //     { day: "20", name: "Holiday Party" },
    //   ]
    // }
  ],

  // ── MEMOS ────────────────────────────────────────────────
  // Format: { tag: "SOURCE TAG", text: "Memo description" }
  memos: [
    {
      tag: "CHE",
      text: "Constitution of Ad Hoc Committees for the CHE Testimonial and Recognition Ceremonies for the Graduating Class of 2026"
    },
    {
      tag: "UPLB",
      text: "OC Memorandum No. 053, Series of 2026, Invitation to Participate in 'KONTRATAlakayan: Kontrata Busisiin, Karapatan Alamin'"
    }
    // Add more memos here
  ],

  // ── NEWS ─────────────────────────────────────────────────
  // Format: { text: "News headline or summary" }
  news: [
    { text: "CHE hosts Sustainability and Social Impact Forum, honors HEALS awardees" }
    // Add more news items here
  ],

  // ── TAGLINE (rotates on load) ─────────────────────────────
  taglines: [
    "Serving CHE with Innovation.",
    "One Portal. All Apps.",
  ],

};
