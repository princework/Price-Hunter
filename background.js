// ================================
//  PRICE HUNTER AI — background.js
//  Now with REAL prices via SerpAPI
// ================================

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {

  if (req.type === "HUNT_PRICES") {
    huntPrices(req.product, req.serpApiKey)
      .then(results => sendResponse(results))
      .catch(err => { console.error(err); sendResponse([]); });
    return true;
  }

  if (req.type === "AI_ANALYZE") {
    aiAnalyze(req.product, req.apiKey, req.comparisons)
      .then(result => sendResponse(result))
      .catch(err => { console.error(err); sendResponse("AI analysis failed."); });
    return true;
  }
});

// ===========================
//  SITE MAP — logo + metadata
// ===========================
const SITE_META = {
  "amazon.in":     { name: "Amazon",    siteKey: "amazon",   emoji: "📦", color: "#ff9900", bg: "rgba(255,153,0,0.15)" },
  "amazon.com":    { name: "Amazon",    siteKey: "amazon",   emoji: "📦", color: "#ff9900", bg: "rgba(255,153,0,0.15)" },
  "flipkart.com":  { name: "Flipkart",  siteKey: "flipkart", emoji: "🛒", color: "#2874f0", bg: "rgba(40,116,240,0.15)" },
  "myntra.com":    { name: "Myntra",    siteKey: "myntra",   emoji: "👗", color: "#ff3f6c", bg: "rgba(255,63,108,0.15)" },
  "croma.com":     { name: "Croma",     siteKey: "croma",    emoji: "📱", color: "#67b346", bg: "rgba(103,179,70,0.15)" },
  "snapdeal.com":  { name: "Snapdeal",  siteKey: "snapdeal", emoji: "⚡", color: "#e40046", bg: "rgba(228,0,70,0.15)" },
  "meesho.com":    { name: "Meesho",    siteKey: "meesho",   emoji: "🏷️", color: "#9b2fae", bg: "rgba(155,47,174,0.15)" },
  "reliancedigital.in": { name: "Reliance", siteKey: "reliance", emoji: "🔵", color: "#0061d5", bg: "rgba(0,97,213,0.15)" },
  "vijaysales.com":{ name: "Vijay Sales", siteKey: "vijay", emoji: "🏪", color: "#e63900", bg: "rgba(230,57,0,0.15)" },
  "tatacliq.com":  { name: "Tata CLiQ", siteKey: "tatacliq", emoji: "🟣", color: "#7b2fff", bg: "rgba(123,47,255,0.15)" },
  "nykaa.com":     { name: "Nykaa",     siteKey: "nykaa",   emoji: "💄", color: "#fc2779", bg: "rgba(252,39,121,0.15)" },
};

function getSiteMeta(url) {
  if (!url) return null;
  for (const [domain, meta] of Object.entries(SITE_META)) {
    if (url.includes(domain)) return meta;
  }
  // Generic fallback
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return { name: hostname, siteKey: hostname, emoji: "🛒", color: "#aaa", bg: "rgba(170,170,170,0.1)" };
  } catch { return null; }
}

// ===========================
//  SERP API — GOOGLE SHOPPING
// ===========================

async function huntPrices(product, serpApiKey) {
  if (!product || !serpApiKey) return [];

  const query = buildSearchQuery(product);
  console.log("[PriceHunter] Searching SerpAPI for:", query);

  try {
    // 1. Google Shopping results
    const shoppingResults = await fetchGoogleShopping(query, serpApiKey);

    // 2. Also fetch inline shopping from regular Google search for more results
    const inlineResults = await fetchInlineShopping(query, serpApiKey);

    // Merge and deduplicate by source
    const all = [...shoppingResults, ...inlineResults];
    const seen = new Set();
    const unique = all.filter(r => {
      const key = r.siteKey + "_" + r.price;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Always include current page price at top
    const currentMeta = getSiteMeta(product.url);
    const currentEntry = {
      siteKey: currentMeta?.siteKey || product.siteKey || "current",
      site: currentMeta?.name || product.site || "Current Page",
      emoji: currentMeta?.emoji || "🛍️",
      color: currentMeta?.color || "#00d4ff",
      bg: currentMeta?.bg || "rgba(0,212,255,0.1)",
      price: product.price,
      url: product.url,
      availability: "You are here",
      isCurrent: true,
      rating: product.rating || null
    };

    // Remove duplicate of current site if found in results
    const filtered = unique.filter(r => r.siteKey !== currentEntry.siteKey);

    const final = [currentEntry, ...filtered];
    return final.sort((a, b) => a.price - b.price);

  } catch (err) {
    console.error("[PriceHunter] SerpAPI error:", err);
    return [];
  }
}

async function fetchGoogleShopping(query, apiKey) {
  const params = new URLSearchParams({
    engine: "google_shopping",
    q: query,
    api_key: apiKey,
    gl: "in",           // India
    hl: "en",
    num: "20"
  });

  const res = await fetch(`https://serpapi.com/search?${params}`);
  const data = await res.json();

  if (data.error) {
    console.error("[SerpAPI] Shopping error:", data.error);
    return [];
  }

  const results = [];

  (data.shopping_results || []).forEach(item => {
    const price = parsePrice(item.price || item.extracted_price);
    if (!price) return;

    const source = item.source || item.link || "";
    const meta = getSiteMeta(source) || getSiteMeta(item.link);

    results.push({
      siteKey: meta?.siteKey || slugifyDomain(source),
      site: meta?.name || item.source || "Store",
      emoji: meta?.emoji || "🛒",
      color: meta?.color || "#aaaaaa",
      bg: meta?.bg || "rgba(170,170,170,0.1)",
      price,
      url: item.link || item.product_link || "#",
      availability: item.delivery || "Check store",
      rating: item.rating,
      reviews: item.reviews,
      thumbnail: item.thumbnail,
      tag: item.tag || null
    });
  });

  return results;
}

async function fetchInlineShopping(query, apiKey) {
  const params = new URLSearchParams({
    engine: "google",
    q: query + " buy",
    api_key: apiKey,
    gl: "in",
    hl: "en",
    num: "10"
  });

  const res = await fetch(`https://serpapi.com/search?${params}`);
  const data = await res.json();

  if (data.error) return [];

  const results = [];

  // inline_shopping_results
  (data.inline_shopping_results || []).forEach(item => {
    const price = parsePrice(item.price);
    if (!price) return;

    const source = item.source || "";
    const meta = getSiteMeta(source);

    results.push({
      siteKey: meta?.siteKey || slugifyDomain(source),
      site: meta?.name || source || "Store",
      emoji: meta?.emoji || "🛒",
      color: meta?.color || "#aaaaaa",
      bg: meta?.bg || "rgba(170,170,170,0.1)",
      price,
      url: item.link || "#",
      availability: "Available online",
    });
  });

  return results;
}

// ===========================
//  HELPERS
// ===========================

function buildSearchQuery(product) {
  // Clean title — remove noise, keep brand + model
  return (product.title || "")
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[|–—]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 7)
    .join(" ");
}

function parsePrice(priceStr) {
  if (typeof priceStr === "number") return priceStr;
  if (!priceStr) return null;
  const cleaned = String(priceStr).replace(/[₹$,\s]/g, "").replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

function slugifyDomain(str) {
  if (!str) return "store";
  try {
    return new URL(str.startsWith("http") ? str : "https://" + str)
      .hostname.replace("www.", "").split(".")[0];
  } catch {
    return str.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  }
}

function cleanProductTitle(title) {
  return (title || "")
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ");
}

// ===========================
//  AI ANALYSIS (Claude)
//  Now includes real comparisons
// ===========================

async function aiAnalyze(product, apiKey, comparisons) {
  if (!apiKey || !product) return "Missing product or API key.";

  // Build comparison context if available
  let compContext = "";
  if (comparisons && comparisons.length > 1) {
    const sorted = [...comparisons].sort((a, b) => a.price - b.price);
    const cheapest = sorted[0];
    const lines = sorted.slice(0, 5).map(r =>
      `  - ${r.site}: ₹${r.price?.toLocaleString("en-IN")}${r.isCurrent ? " (current)" : ""}`
    ).join("\n");
    compContext = `\nReal-time prices found:\n${lines}\nBest price: ${cheapest.site} at ₹${cheapest.price?.toLocaleString("en-IN")}`;
  }

  const prompt = `You are a smart Indian shopping assistant helping users decide if they're getting a good deal.

Product: ${product.title}
Current Price: ₹${product.price?.toLocaleString("en-IN")}
MRP / Original Price: ${product.mrp ? "₹" + product.mrp.toLocaleString("en-IN") : "N/A"}
Discount: ${product.discount ? product.discount + "%" : "N/A"}
Store: ${product.site}
Rating: ${product.rating || "N/A"}
Reviews: ${product.reviews || "N/A"}
${compContext}

Please analyze and give:
1. 💰 **Deal Rating** — Great Deal / Fair Price / Overpriced (be direct)
2. 📊 **Price Insight** — Typical market range in India for this product
3. 🏆 **Best Option** — Which store to buy from based on the prices above
4. 🛒 **Buy Now or Wait?** — Is this a good time or should they wait for a sale?
5. ⚡ **Pro Tip** — One smart money-saving trick specific to this product

Be concise, use ₹, keep it under 220 words. Be specific not generic.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 450,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return `API Error: ${data.error.message}`;
    if (data.content?.[0]?.text) return data.content[0].text;
    return "Unexpected response from AI.";

  } catch (err) {
    console.error("[PriceHunter AI]", err);
    return "Network error. Check your API key and connection.";
  }
}
