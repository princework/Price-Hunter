// ================================
//  PRICE HUNTER AI — popup.js
// ================================

const $ = id => document.getElementById(id);

// ===== SITE CONFIGS =====
const SITES = {
  amazon: {
    name: "Amazon",
    color: "#ff9900",
    emoji: "📦",
    bg: "rgba(255,153,0,0.15)",
    searchUrl: q => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`
  },
  flipkart: {
    name: "Flipkart",
    color: "#2874f0",
    emoji: "🛒",
    bg: "rgba(40,116,240,0.15)",
    searchUrl: q => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`
  },
  croma: {
    name: "Croma",
    color: "#67b346",
    emoji: "📱",
    bg: "rgba(103,179,70,0.15)",
    searchUrl: q => `https://www.croma.com/search/?q=${encodeURIComponent(q)}`
  },
  snapdeal: {
    name: "Snapdeal",
    color: "#e40046",
    emoji: "⚡",
    bg: "rgba(228,0,70,0.15)",
    searchUrl: q => `https://www.snapdeal.com/search?keyword=${encodeURIComponent(q)}`
  },
  myntra: {
    name: "Myntra",
    color: "#ff3f6c",
    emoji: "👗",
    bg: "rgba(255,63,108,0.15)",
    searchUrl: q => `https://www.myntra.com/${encodeURIComponent(q)}`
  },
  meesho: {
    name: "Meesho",
    color: "#9b2fae",
    emoji: "🏷️",
    bg: "rgba(155,47,174,0.15)",
    searchUrl: q => `https://www.meesho.com/search?q=${encodeURIComponent(q)}`
  }
};

let currentProduct = null;
let priceChart = null;

// ===== INIT =====
document.addEventListener("DOMContentLoaded", async () => {
  // Load API keys
  const stored = await chrome.storage.local.get(["apiKey", "serpApiKey"]);
  if (stored.apiKey) {
    $("apiKeyInput").value = stored.apiKey;
    $("statusDot").classList.add("live");
  }
  if (stored.serpApiKey) {
    $("serpKeyInput").value = stored.serpApiKey;
  }

  // Get product from active tab
  await loadProduct();

  // Tab switching
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Buttons
  $("settingsBtn").addEventListener("click", () => {
    $("apiPanel").classList.toggle("hidden");
  });

  $("saveKeyBtn").addEventListener("click", async () => {
    const key = $("apiKeyInput").value.trim();
    const serpKey = $("serpKeyInput").value.trim();
    const toSave = {};
    if (key) toSave.apiKey = key;
    if (serpKey) toSave.serpApiKey = serpKey;
    await chrome.storage.local.set(toSave);
    $("statusDot").classList.add("live");
    $("apiPanel").classList.add("hidden");
    // Show confirmation
    $("footerText").textContent = "✓ Keys saved!";
    setTimeout(() => { $("footerText").textContent = "PriceHunter AI v1.0"; }, 2000);
  });

  $("huntBtn").addEventListener("click", runPriceHunt);
  $("aiAnalyzeBtn").addEventListener("click", runAIAnalysis);
  $("refreshBtn").addEventListener("click", loadProduct);
});

// ===== LOAD PRODUCT FROM PAGE =====
async function loadProduct() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url || "";

    const supportedSites = ["amazon.in", "amazon.com", "flipkart.com", "myntra.com",
                            "meesho.com", "snapdeal.com", "croma.com", "reliancedigital.in"];
    const isSupported = supportedSites.some(s => url.includes(s));

    if (!isSupported) {
      showEmptyState();
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__priceHunterProduct || null
    });

    const product = results?.[0]?.result;

    if (!product || !product.title) {
      showEmptyState();
      return;
    }

    currentProduct = product;
    showProduct(product);
    renderHistoryChart(product);

  } catch (e) {
    console.error("loadProduct error:", e);
    showEmptyState();
  }
}

function showEmptyState() {
  $("emptyState").classList.remove("hidden");
  $("productView").classList.add("hidden");
}

function showProduct(p) {
  $("emptyState").classList.add("hidden");
  $("productView").classList.remove("hidden");

  $("productName").textContent = p.title || "Unknown Product";
  $("currentPrice").textContent = formatPrice(p.price);
  $("currentSite").textContent = p.site || "—";

  // Deal badge based on discount
  const badge = $("dealBadge");
  if (p.discount && p.discount > 20) {
    badge.textContent = `🔥 ${p.discount}% OFF`;
    badge.className = "badge badge-deal";
  } else if (p.discount && p.discount > 0) {
    badge.textContent = `${p.discount}% off`;
    badge.className = "badge badge-fair";
  } else {
    badge.textContent = "";
    badge.className = "badge";
  }
}

// ===== PRICE HUNT =====
async function runPriceHunt() {
  if (!currentProduct) return;

  $("compareLoading").classList.remove("hidden");
  $("compareResults").innerHTML = "";
  $("huntBtn").disabled = true;

  const stored = await chrome.storage.local.get("serpApiKey");
  const serpApiKey = stored.serpApiKey || null;

  if (!serpApiKey) {
    $("compareLoading").classList.add("hidden");
    $("huntBtn").disabled = false;
    $("compareResults").innerHTML = `
      <div style="text-align:center;padding:14px;">
        <div style="color:var(--yellow);font-size:13px;margin-bottom:6px">⚠️ SerpAPI key not set</div>
        <div style="color:var(--text-muted);font-size:11px">Click ⚙ and add your SerpAPI key for live prices.</div>
      </div>`;
    return;
  }

  chrome.runtime.sendMessage(
    { type: "HUNT_PRICES", product: currentProduct, serpApiKey },
    (results) => {
      $("compareLoading").classList.add("hidden");
      $("huntBtn").disabled = false;

      if (!results || results.length === 0) {
        $("compareResults").innerHTML = `<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:12px">No results found for this product.</div>`;
        return;
      }

      renderCompareResults(results);
    }
  );
}

let lastComparisons = [];

function renderCompareResults(results) {
  lastComparisons = results;

  const sorted = [...results].sort((a, b) => a.price - b.price);
  const lowestPrice = sorted[0].price;
  const currentPrice = currentProduct.price;

  let html = "";
  sorted.forEach((item, i) => {
    const isLowest = i === 0 && !item.isCurrent;
    const isBest = item.price === lowestPrice;
    const diff = item.price - currentPrice;
    const diffText = item.isCurrent ? "Current page"
      : diff < 0 ? `Save ₹${Math.abs(diff).toLocaleString("en-IN")}`
      : diff > 0 ? `+₹${diff.toLocaleString("en-IN")} more`
      : "Same price";
    const diffClass = diff < 0 ? "saving" : diff > 0 ? "extra" : "";
    const priceClass = isBest ? "lowest" : item.price > lowestPrice * 1.15 ? "highest" : "";

    const emoji = item.emoji || "🛒";
    const bg = item.bg || "rgba(170,170,170,0.1)";
    const color = item.color || "#aaa";
    const ratingStr = item.rating ? `⭐ ${item.rating}` : item.availability || "Check store";

    html += `
      <a class="compare-item ${isBest ? "best-deal" : ""}" href="${item.url}" target="_blank">
        <div class="compare-left">
          <div class="site-logo" style="background:${bg};color:${color}">${emoji}</div>
          <div>
            <div class="compare-site">${item.site} ${isBest ? '<span class="best-tag">BEST</span>' : ""}</div>
            <div class="compare-availability">${ratingStr}</div>
          </div>
        </div>
        <div class="compare-right">
          <div class="compare-price ${priceClass}">${formatPrice(item.price)}</div>
          <div class="compare-diff ${diffClass}">${diffText}</div>
        </div>
      </a>`;
  });

  $("compareResults").innerHTML = html || `<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:12px">No other stores found for this product.</div>`;

  if (currentProduct) saveToHistory(currentProduct, sorted[0].price);
}

// ===== HISTORY CHART =====
function renderHistoryChart(product) {
  const historyKey = `history_${slugify(product.title)}`;
  chrome.storage.local.get(historyKey, (data) => {
    let history = data[historyKey] || [];

    // Add current price if not already today's
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    if (!history.length || history[history.length - 1].date !== today) {
      history.push({ date: today, price: product.price });
      if (history.length > 30) history = history.slice(-30);
      chrome.storage.local.set({ [historyKey]: history });
    }

    drawChart(history, product.price);
    renderHistoryStats(history);
  });
}

function saveToHistory(product, lowestFound) {
  const historyKey = `history_${slugify(product.title)}`;
  chrome.storage.local.get(historyKey, (data) => {
    let history = data[historyKey] || [];
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    const existing = history.findIndex(h => h.date === today);
    const entry = { date: today, price: Math.min(product.price, lowestFound) };
    if (existing >= 0) history[existing] = entry;
    else history.push(entry);
    if (history.length > 30) history = history.slice(-30);
    chrome.storage.local.set({ [historyKey]: history });
    drawChart(history, product.price);
    renderHistoryStats(history);
  });
}

function drawChart(history, currentPrice) {
  const canvas = $("priceChart");
  const labels = history.map(h => h.date);
  const prices = history.map(h => h.price);

  if (priceChart) priceChart.destroy();

  priceChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Price (₹)",
        data: prices,
        borderColor: "#00d4ff",
        backgroundColor: "rgba(0,212,255,0.07)",
        borderWidth: 2,
        pointBackgroundColor: prices.map((p, i) =>
          i === prices.length - 1 ? "#00d4ff" :
          p === Math.min(...prices) ? "#00ff88" :
          p === Math.max(...prices) ? "#ff3d5a" : "#00d4ff"
        ),
        pointRadius: prices.map((_, i) => i === prices.length - 1 ? 5 : 3),
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0e1218",
          borderColor: "#1e2d40",
          borderWidth: 1,
          titleColor: "#00d4ff",
          bodyColor: "#d4e8ff",
          callbacks: {
            label: ctx => `₹${ctx.raw?.toLocaleString()}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#5a7a99", font: { family: "JetBrains Mono", size: 9 } },
          grid: { color: "rgba(30,45,64,0.8)" }
        },
        y: {
          ticks: {
            color: "#5a7a99",
            font: { family: "JetBrains Mono", size: 9 },
            callback: v => `₹${v?.toLocaleString()}`
          },
          grid: { color: "rgba(30,45,64,0.8)" }
        }
      }
    }
  });
}

function renderHistoryStats(history) {
  const prices = history.map(h => h.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const cur = prices[prices.length - 1];

  $("historyStats").innerHTML = `
    <div class="stat-box"><div class="stat-val low">${formatPrice(low)}</div><div class="stat-lbl">ALL TIME LOW</div></div>
    <div class="stat-box"><div class="stat-val cur">${formatPrice(cur)}</div><div class="stat-lbl">CURRENT</div></div>
    <div class="stat-box"><div class="stat-val high">${formatPrice(high)}</div><div class="stat-lbl">ALL TIME HIGH</div></div>
  `;
}

// ===== AI ANALYSIS =====
async function runAIAnalysis() {
  if (!currentProduct) return;

  const stored = await chrome.storage.local.get("apiKey");
  if (!stored.apiKey) {
    $("apiPanel").classList.remove("hidden");
    $("aiOutput").textContent = "⚠️ Please add your Anthropic API key first.";
    $("aiOutput").classList.remove("hidden");
    return;
  }

  $("aiAnalyzeBtn").classList.add("hidden");
  $("aiLoading").classList.remove("hidden");
  $("aiOutput").classList.add("hidden");

  chrome.runtime.sendMessage(
    { type: "AI_ANALYZE", product: currentProduct, apiKey: stored.apiKey, comparisons: lastComparisons },
    (response) => {
      $("aiLoading").classList.add("hidden");
      $("aiAnalyzeBtn").classList.remove("hidden");
      $("aiOutput").textContent = response || "No response from AI.";
      $("aiOutput").classList.remove("hidden");
    }
  );
}

// ===== TABS =====
function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
  document.querySelectorAll(".tab-content").forEach(c => {
    c.classList.toggle("active", c.id === `tab-${tabName}`);
    c.classList.toggle("hidden", c.id !== `tab-${tabName}`);
  });
}

// ===== UTILS =====
function formatPrice(price) {
  if (!price && price !== 0) return "—";
  return `₹${Number(price).toLocaleString("en-IN")}`;
}

function slugify(str) {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60);
}
