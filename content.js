// ================================
//  PRICE HUNTER AI — content.js
//  Scrapes product data from page
// ================================

(function () {
  function getPrice(text) {
    if (!text) return null;
    const cleaned = text.replace(/[^\d.,]/g, "").replace(/,/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  function scrape() {
    const url = window.location.href;
    let product = null;

    // ===== AMAZON =====
    if (url.includes("amazon")) {
      const title = document.querySelector("#productTitle")?.innerText?.trim()
        || document.querySelector(".product-title-word-break")?.innerText?.trim();

      const priceEl =
        document.querySelector(".priceToPay .a-price-whole") ||
        document.querySelector("#priceblock_ourprice") ||
        document.querySelector("#priceblock_dealprice") ||
        document.querySelector(".apexPriceToPay .a-price-whole") ||
        document.querySelector(".a-price .a-price-whole");

      const mrpEl =
        document.querySelector(".basisPrice .a-price-whole") ||
        document.querySelector(".a-text-price .a-offscreen");

      const price = getPrice(priceEl?.innerText);
      const mrp = getPrice(mrpEl?.innerText);
      const discount = mrp && price ? Math.round((1 - price / mrp) * 100) : 0;

      const rating = document.querySelector("#acrPopover")?.title?.trim()
        || document.querySelector(".a-icon-star .a-icon-alt")?.innerText;
      const reviews = document.querySelector("#acrCustomerReviewText")?.innerText;

      if (title && price) {
        product = { title, price, mrp, discount, rating, reviews, site: "Amazon", siteKey: "amazon", url };
      }
    }

    // ===== FLIPKART =====
    else if (url.includes("flipkart")) {

      // --- TITLE: try many known selectors + fallback to og:title ---
      const title =
        document.querySelector("span.B_NuCI")?.innerText?.trim() ||
        document.querySelector("h1.yhB1nd")?.innerText?.trim() ||
        document.querySelector("._35KyD6")?.innerText?.trim() ||
        document.querySelector("h1.VU-ZEz")?.innerText?.trim() ||
        document.querySelector("h1")?.innerText?.trim() ||
        document.querySelector('meta[property="og:title"]')?.content?.trim();

      // --- PRICE: Flipkart uses dynamic class names, use multiple strategies ---
      // Strategy 1: known class names
      let priceEl =
        document.querySelector("._30jeq3._16Jk6d") ||
        document.querySelector("._30jeq3") ||
        document.querySelector(".CEmiEU div") ||
        document.querySelector(".Nx9bqj.CxhGGd") ||
        document.querySelector(".Nx9bqj") ||
        document.querySelector("._16Jk6d");

      // Strategy 2: find element with ₹ sign that looks like a price
      if (!priceEl) {
        const allEls = [...document.querySelectorAll("*")];
        priceEl = allEls.find(el =>
          el.children.length === 0 &&
          el.innerText?.trim().startsWith("₹") &&
          el.innerText.length < 12 &&
          getPrice(el.innerText) > 100
        );
      }

      // --- MRP ---
      const mrpEl =
        document.querySelector("._3I9_wc._2p6lqe") ||
        document.querySelector("._3I9_wc") ||
        document.querySelector(".yRaY8j.ZYYwLA") ||
        document.querySelector(".yRaY8j");

      // --- DISCOUNT ---
      const discEl =
        document.querySelector("._3Ay6Sb._31Dcoz span") ||
        document.querySelector("._3Ay6Sb") ||
        document.querySelector(".UkUFwK span") ||
        document.querySelector("._2Tpdn3");

      const price = getPrice(priceEl?.innerText);
      const mrp = getPrice(mrpEl?.innerText);
      const discText = discEl?.innerText || "";
      const discount = parseInt(discText) || (mrp && price ? Math.round((1 - price / mrp) * 100) : 0);

      // --- RATING & REVIEWS ---
      const rating =
        document.querySelector("._3LWZlK")?.innerText ||
        document.querySelector(".XQDdHH")?.innerText;
      const reviews =
        document.querySelector("._2_R_DZ")?.innerText ||
        document.querySelector(".Wphh3N")?.innerText;

      if (title && price) {
        product = { title, price, mrp, discount, rating, reviews, site: "Flipkart", siteKey: "flipkart", url };
      }
    }

    // ===== MYNTRA =====
    else if (url.includes("myntra")) {
      const title =
        document.querySelector(".pdp-title")?.innerText?.trim() ||
        document.querySelector("h1.pdp-name")?.innerText?.trim();

      const priceEl =
        document.querySelector(".pdp-price strong") ||
        document.querySelector(".pdp-mrp strong");

      const mrpEl = document.querySelector("s.pdp-mrp");
      const discEl = document.querySelector(".pdp-discount");

      const price = getPrice(priceEl?.innerText);
      const mrp = getPrice(mrpEl?.innerText);
      const discount = parseInt(discEl?.innerText) || (mrp && price ? Math.round((1 - price / mrp) * 100) : 0);

      if (title && price) {
        product = { title, price, mrp, discount, site: "Myntra", siteKey: "myntra", url };
      }
    }

    // ===== CROMA =====
    else if (url.includes("croma")) {
      const title =
        document.querySelector("h1.pdp-title")?.innerText?.trim() ||
        document.querySelector(".product-name h1")?.innerText?.trim();

      const priceEl =
        document.querySelector("[class*='pdp-price']") ||
        document.querySelector(".new-price");

      const mrpEl = document.querySelector(".old-price");
      const price = getPrice(priceEl?.innerText);
      const mrp = getPrice(mrpEl?.innerText);
      const discount = mrp && price ? Math.round((1 - price / mrp) * 100) : 0;

      if (title && price) {
        product = { title, price, mrp, discount, site: "Croma", siteKey: "croma", url };
      }
    }

    // ===== SNAPDEAL =====
    else if (url.includes("snapdeal")) {
      const title =
        document.querySelector("h1.pdp-e-i-head")?.innerText?.trim() ||
        document.querySelector(".product-title")?.innerText?.trim();

      const priceEl =
        document.querySelector("span.payBlkBig") ||
        document.querySelector(".product-price");

      const mrpEl = document.querySelector("span.product-desc-price.strike");
      const price = getPrice(priceEl?.innerText);
      const mrp = getPrice(mrpEl?.innerText);
      const discount = mrp && price ? Math.round((1 - price / mrp) * 100) : 0;

      if (title && price) {
        product = { title, price, mrp, discount, site: "Snapdeal", siteKey: "snapdeal", url };
      }
    }

    // ===== MEESHO =====
    else if (url.includes("meesho")) {
      const title = document.querySelector("p.sc-eDvSVe")?.innerText?.trim()
        || document.querySelector("h1")?.innerText?.trim();

      const priceEl = document.querySelector("h4.sc-dkrFOg");
      const price = getPrice(priceEl?.innerText);

      if (title && price) {
        product = { title, price, site: "Meesho", siteKey: "meesho", url };
      }
    }

    return product;
  }

  // Store product in window so popup can access it
  const product = scrape();
  if (product) {
    window.__priceHunterProduct = product;
    console.log("[PriceHunter AI] Detected:", product);

    // Inject small floating badge
    injectBadge(product);
  }

  function injectBadge(p) {
    if (document.getElementById("ph-badge")) return;
    const badge = document.createElement("div");
    badge.id = "ph-badge";
    const savings = p.discount > 0 ? ` · ${p.discount}% off` : "";
    badge.innerHTML = `
      <div style="
        position:fixed; bottom:20px; right:20px; z-index:999999;
        background:#080b10; color:#00d4ff;
        border:1px solid rgba(0,212,255,0.35); border-radius:12px;
        padding:7px 14px; font-size:12px; font-family:monospace;
        box-shadow:0 4px 24px rgba(0,0,0,0.5), 0 0 20px rgba(0,212,255,0.1);
        cursor:default; user-select:none;
        animation: phFadeIn 0.4s ease;
      ">
        🔍 PriceHunter ready · ₹${p.price?.toLocaleString("en-IN")}${savings}
      </div>
      <style>
        @keyframes phFadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      </style>
    `;
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 4000);
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.type === "GET_PRODUCT") {
      sendResponse(window.__priceHunterProduct || null);
    }
    return true;
  });
})();