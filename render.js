/**
 * Profitzon Brand Audit Report Renderer v9.0-corporate
 * Clean white infographic style — Inter font, corporate palette.
 * Pages: The Paradox | Asset X-Ray | Cost of Friction
 *
 * Usage:
 *   As Express API:  node render.js --serve --port 3100
 *   As CLI:          node render.js --data '{"brandName":"Nano Clear",...}' --output report.pdf
 *
 * API:
 *   POST /render  — body: JSON audit data → returns PDF binary
 *   POST /render?format=html — returns rendered HTML instead
 */

const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const COVER_TEMPLATE_PATH = path.join(__dirname, 'cover-template.html');
const LOGO_PATH = path.join(__dirname, 'profitzon-logo.png');

const logoBase64 = fs.existsSync(LOGO_PATH)
  ? 'data:image/png;base64,' + fs.readFileSync(LOGO_PATH).toString('base64')
  : '';

// ============================================================
// HELPERS
// ============================================================

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmt(n) {
  const num = Number(n || 0);
  return isNaN(num) ? '0' : num.toLocaleString();
}

// ============================================================
// GAUGE SVG (Speedometer)
// ============================================================

function renderGaugeSVG(score) {
  const s = Math.max(0, Math.min(100, score));

  let color = '#dc2626';
  if (s >= 70) color = '#16a34a';
  else if (s >= 50) color = '#f5a623';
  else if (s >= 30) color = '#ea580c';

  const label = s < 45 ? 'NEEDS WORK' : s < 60 ? 'FAIR' : s < 75 ? 'GOOD' : s < 88 ? 'STRONG' : 'EXCELLENT';

  // Speedometer gauge like the Nomatic reference
  const cx = 130, cy = 140, r = 110;
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle - (s / 100) * Math.PI;
  const needleX = cx + (r - 20) * Math.cos(angle);
  const needleY = cy - (r - 20) * Math.sin(angle);

  // Arc segments: red, orange, gold, green
  const arcPath = (start, end, clr) => {
    const x1 = cx + r * Math.cos(Math.PI - start * Math.PI);
    const y1 = cy - r * Math.sin(Math.PI - start * Math.PI);
    const x2 = cx + r * Math.cos(Math.PI - end * Math.PI);
    const y2 = cy - r * Math.sin(Math.PI - end * Math.PI);
    return `<path d="M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}" stroke="${clr}" stroke-width="18" fill="none" stroke-linecap="round"/>`;
  };

  return `<svg width="260" height="180" viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <!-- Track -->
    <path d="M${cx - r},${cy} A${r},${r} 0 0,1 ${cx + r},${cy}" stroke="#e5e7eb" stroke-width="20" fill="none" stroke-linecap="round"/>
    ${arcPath(0, 0.3, '#dc2626')}
    ${arcPath(0.3, 0.5, '#ea580c')}
    ${arcPath(0.5, 0.7, '#f5a623')}
    ${arcPath(0.7, 1.0, '#16a34a')}
    <!-- Needle -->
    <line x1="${cx}" y1="${cy}" x2="${needleX}" y2="${needleY}" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="#1a1a1a"/>
    <!-- Score -->
    <text x="${cx}" y="${cy - 30}" text-anchor="middle" font-family="Inter, sans-serif" font-size="44" font-weight="900" fill="#1a1a1a">${s}/100</text>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="Inter, sans-serif" font-size="16" font-weight="700" fill="${color}" letter-spacing="2">${label}</text>
    <!-- Min/Max labels -->
    <text x="${cx - r + 10}" y="${cy + 20}" font-family="Inter, sans-serif" font-size="11" fill="#9ca3af">0</text>
    <text x="${cx + r - 22}" y="${cy + 20}" font-family="Inter, sans-serif" font-size="11" fill="#9ca3af">100</text>
  </svg>`;
}

// ============================================================
// STRENGTHS & VULNERABILITIES (Page 1)
// ============================================================

// Infographic strength cards (icon + big value + label)
function renderStrengthCards(data) {
  const cards = [];
  const bp = parseInt(data.brandProductCount || 0);
  const tr = parseInt(data.totalResults || 1);
  const pct = Math.round((bp / tr) * 100);
  const fba = parseInt(data.fbaPercent || 0);
  const rating = parseFloat(data.avgRating || 0);

  if (pct > 0) {
    cards.push({ icon: '&#9632;', color: 'green', val: pct + '%', label: 'Brand Search Dominance' });
  }
  if (rating > 0) {
    const stars = '&#9733;'.repeat(Math.round(rating));
    cards.push({ icon: stars, color: 'gold', val: rating.toFixed(1) + ' Average', label: 'Customer Rating' });
  }
  if (data.priceRange && data.priceRange !== 'N/A') {
    cards.push({ icon: '$', color: 'green', val: escapeHtml(data.priceRange), label: 'Stable Pricing Mechanics' });
  }
  if (fba >= 70) {
    cards.push({ icon: '&#10003;', color: 'green', val: fba + '% Prime', label: 'Fulfillment Coverage' });
  }
  if (data.buyBoxIsTheBrand !== false) {
    cards.push({ icon: '&#10003;', color: 'green', val: 'Brand Owned', label: 'Buy Box Control' });
  }
  if (cards.length === 0) {
    cards.push({ icon: '&#10003;', color: 'green', val: 'Present', label: 'Amazon Brand Presence' });
  }

  return cards.slice(0, 3).map(c =>
    `<div class="info-card">
      <div class="ic-icon ${c.color}">${c.icon}</div>
      <div><div class="ic-val">${c.val}</div><div class="ic-label">${c.label}</div></div>
    </div>`
  ).join('\n');
}

// Infographic vulnerability cards (icon + value + label)
function renderVulnCards(data) {
  const cards = [];
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);
  const bp = parseInt(data.brandProductCount || 0);

  if (fba < 50) {
    cards.push({ icon: '!', color: 'red', val: `Only ${fba}% Prime Coverage`, label: bp > 0 ? `(${Math.round(fba * bp / 100)} of ${bp} SKUs FBA)` : 'Missing Prime badge' });
  }
  if (onPage >= 3) {
    cards.push({ icon: String(onPage), color: 'red', val: 'Competitor Ads on', label: 'Top Product Pages (Search Siphoning)' });
  }
  if (sc > 3) {
    cards.push({ icon: String(sc), color: 'red', val: 'Unauthorized Sellers', label: 'Competing on Your Products' });
  }
  if (data.listingQuality === 'Weak/No A+' || data.listingQuality === 'Adequate') {
    cards.push({ icon: '!', color: 'red', val: 'Mixed Listing Maturity', label: '(Suppressing Algorithm Visibility)' });
  }
  if (data.storefront === 'Missing' || data.storefront === 'Exists - needs work') {
    cards.push({ icon: '!', color: 'red', val: 'No Designed Storefront', label: 'Missing brand store presence' });
  }
  if (data.buyBoxIsTheBrand === false && sc > 5) {
    cards.push({ icon: '!', color: 'red', val: 'Buy Box at Risk', label: 'Non-authorized seller controlling sales' });
  }

  if (cards.length === 0) {
    cards.push({ icon: 'i', color: 'gold', val: 'Minor Optimizations', label: 'Available for growth' });
  }

  return cards.slice(0, 3).map(c =>
    `<div class="info-card red">
      <div class="ic-icon ${c.color}">${c.icon}</div>
      <div><div class="ic-val">${c.val}</div><div class="ic-label">${c.label}</div></div>
    </div>`
  ).join('\n');
}

// ============================================================
// PAGE 2: CALLOUT CARDS (around product image)
// ============================================================

function renderLeftCallouts(data) {
  const callouts = [];
  const imgs = parseInt(data.listingImageCount || 0);
  const hasVideo = data.listingHasVideo;
  const bullets = parseInt(data.listingBulletCount || 0);
  const rating = parseFloat(data.avgRating || 0);
  const best = data.topProducts && data.topProducts[0];
  const reviews = best ? (best.reviews_count || 0) : 0;

  // Content quality
  if (hasVideo && imgs >= 7) {
    callouts.push({ type: 'good', badge: 'g', icon: '&#10003;', title: `${imgs} High-Quality Images & Video`, desc: 'Present' });
  } else if (imgs >= 5) {
    callouts.push({ type: 'warn', badge: 'w', icon: '!', title: `${imgs} Images, No Video`, desc: 'Room for A+ content upgrade' });
  } else {
    callouts.push({ type: 'bad', badge: 'r', icon: '!', title: `Only ${imgs} Images${hasVideo ? ' + Video' : ', No Video'}`, desc: 'Weak content suppressing conversion' });
  }

  // Rating
  if (rating >= 4.0) {
    callouts.push({ type: 'good', badge: 'g', icon: '&#9733;', title: `Excellent ${rating.toFixed(1)} Rating`, desc: `(${fmt(reviews)} Reviews)` });
  } else if (rating >= 3.5) {
    callouts.push({ type: 'warn', badge: 'w', icon: '&#9733;', title: `${rating.toFixed(1)} Rating`, desc: `(${fmt(reviews)} Reviews)` });
  } else if (rating > 0) {
    callouts.push({ type: 'bad', badge: 'r', icon: '!', title: `Low ${rating.toFixed(1)} Rating`, desc: `Below purchase threshold` });
  }

  // Buy Box
  if (data.buyBoxIsTheBrand !== false) {
    callouts.push({ type: 'good', badge: 'g', icon: '&#10003;', title: 'Brand Owns Buy Box', desc: escapeHtml(data.buyBoxSellerName || 'Brand seller') });
  }

  return callouts.slice(0, 3).map(c =>
    `<div class="callout ${c.type}">
      <div class="co-badge ${c.badge}">${c.icon}</div>
      <div class="co-title">${c.title}</div>
      <div class="co-desc">${c.desc}</div>
    </div>`
  ).join('\n');
}

function renderRightCallouts(data) {
  const callouts = [];
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);

  // FBA status
  if (fba === 0) {
    callouts.push({ type: 'bad', badge: 'r', icon: '!', title: 'Missing Prime Badge:', desc: 'Fulfilled by Merchant (FBM) status artificially lowering conversion.' });
  } else if (fba < 50) {
    callouts.push({ type: 'bad', badge: 'r', icon: '!', title: `Only ${fba}% Prime Coverage:`, desc: 'Most products missing Prime badge.' });
  } else if (fba < 100) {
    callouts.push({ type: 'warn', badge: 'w', icon: '!', title: `${fba}% Prime Coverage:`, desc: 'Some SKUs still missing Prime.' });
  }

  // Competitor ads
  if (onPage >= 3) {
    callouts.push({ type: 'bad', badge: 'r', icon: '&#10007;', title: `Competitor Intercept:`, desc: `${onPage} active rival ad placements blocking the Add to Cart path.` });
  }

  // Seller issues
  if (sc > 3) {
    callouts.push({ type: 'bad', badge: 'r', icon: '!', title: `${sc} Active Sellers:`, desc: 'Price competition and inconsistent customer experience.' });
  }

  // Storefront
  if (data.storefront === 'Missing' || data.storefront === 'Exists - needs work') {
    callouts.push({ type: 'warn', badge: 'w', icon: '!', title: 'No Designed Storefront:', desc: 'Missing branded shopping experience.' });
  }

  if (data.buyBoxIsTheBrand === false && sc > 5) {
    callouts.push({ type: 'bad', badge: 'r', icon: '!', title: 'Buy Box Lost:', desc: `${escapeHtml(data.buyBoxSellerName || 'Third party')} controls the purchase button.` });
  }

  if (callouts.length === 0) {
    callouts.push({ type: 'neutral', badge: 'g', icon: '&#10003;', title: 'Clean Product Page', desc: 'No major issues detected.' });
  }

  return callouts.slice(0, 3).map(c =>
    `<div class="callout ${c.type}">
      <div class="co-badge ${c.badge}">${c.icon}</div>
      <div class="co-title">${c.title}</div>
      <div class="co-desc">${c.desc}</div>
    </div>`
  ).join('\n');
}


// ============================================================
// PRODUCT IMAGE (Page 2)
// ============================================================

function renderProductImage(data) {
  if (data.productImageUrl) {
    return `<img src="${escapeHtml(data.productImageUrl)}" alt="${escapeHtml(data.brandName)} product">`;
  }
  return `<div class="product-placeholder">${escapeHtml(data.brandName || 'Product Image')}</div>`;
}


// ============================================================
// REVENUE LEAK & GROWTH PLAN (Page 3)
// ============================================================

function renderRevenueLeak(data) {
  const leaks = [];
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);

  // Only flag Buy Box as a leak if many unauthorized sellers suggest it's not an authorized partner
  if (data.buyBoxIsTheBrand === false && sc > 5) {
    leaks.push({ title: 'Buy Box at Risk', severity: 'High', text: `With ${sc} sellers competing, the Buy Box holder may not be an authorized partner. Revenue could be leaking to unauthorized resellers.` });
  }
  if (fba < 50) {
    leaks.push({ title: 'No Prime Badge', severity: fba === 0 ? 'Critical' : 'High', text: `Only ${fba}% of your products have Prime. Customers filter for Prime - products without it are invisible to 200M+ shoppers.` });
  }
  if (sc > 3) {
    leaks.push({ title: 'Seller Chaos', severity: sc > 6 ? 'Critical' : 'High', text: `${sc} sellers are competing on your products, undercutting each other and destroying your margins.` });
  }
  if (data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') {
    leaks.push({ title: 'Search Hijacked', severity: 'High', text: 'Competitors are bidding on your brand name. Customers searching for you see their products first.' });
  }
  if (data.listingQuality === 'Weak/No A+') {
    leaks.push({ title: 'Content Gap', severity: 'Medium', text: 'Product pages missing A+ enhanced brand content, video, or optimized storefront. We handle the full build.' });
  }

  // Always show at least one growth-related item
  const catalogSize = parseInt(data.catalogSize || data.brandProductCount || 0);
  if (catalogSize > 0 && catalogSize <= 3) {
    leaks.push({ title: 'Single-SKU Risk', severity: 'Medium', text: `Only ${catalogSize} product${catalogSize > 1 ? 's' : ''} in the catalog. One listing suspension or stockout means zero revenue. Expanding with variations and bundles protects against this.` });
  }
  const onPage = parseInt(data.onPageCompetitorCount || 0);
  if (onPage >= 3 && !leaks.find(l => l.title.includes('Search'))) {
    leaks.push({ title: 'Ad Leakage', severity: 'Medium', text: `${onPage} competitor ads appear on your product page and brand search results. Every click they capture is revenue walking away from your brand.` });
  }
  if (data.storefront === 'Missing' || data.storefront === 'Exists - needs work') {
    if (!leaks.find(l => l.title.includes('Content'))) {
      leaks.push({ title: 'Storefront Gap', severity: 'Medium', text: 'No designed brand storefront on Amazon. A premium storefront with curated collections increases browse-to-purchase conversion by 15-25%.' });
    }
  }
  if (leaks.length === 0) {
    leaks.push({ title: 'Scale Opportunity', severity: 'Low', text: 'No critical leaks detected, but funded inventory scaling and catalog expansion can accelerate revenue growth significantly.' });
  }

  return leaks.slice(0, 3).map(l =>
    `<div class="leak-card">
      <div class="leak-title">${escapeHtml(l.title)}</div>
      <div class="leak-desc">${escapeHtml(l.text)}</div>
      <div class="leak-impact">${escapeHtml(l.severity === 'Critical' ? 'Critical Impact' : l.severity === 'High' ? 'High Impact' : 'Medium Impact')}</div>
    </div>`
  ).join('\n');
}

function renderGrowthPlan(data) {
  const plans = [];
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);

  if (data.buyBoxIsTheBrand === false && sc > 5) {
    plans.push({ title: 'Secure Your Buy Box', impact: 'Revenue Recovery', text: 'We remove unauthorized sellers and ensure the Buy Box is held by authorized partners only.' });
  }
  if (fba < 70) {
    plans.push({ title: 'Prime Badge Strategy', impact: '+30-50% Sales', text: `Ship ${fba === 0 ? 'your entire catalog' : 'remaining products'} through our Las Vegas FBA hub. Prime products convert dramatically more.` });
  }
  if (sc > 3) {
    plans.push({ title: 'Clean Seller Map', impact: 'Margin Protection', text: 'Enforce brand authorization and MAP pricing. Remove unauthorized resellers to stabilize your prices.' });
  }
  if (data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') {
    plans.push({ title: 'Brand Defense Ads', impact: 'Traffic Protection', text: 'Launch search ads on your brand name to keep competitors off your results. Protect every search.' });
  }
  if (data.listingQuality === 'Weak/No A+' || data.listingQuality === 'Adequate') {
    plans.push({ title: 'A+ Storefront & Content', impact: '+15-25% Conversion', text: 'We build your Amazon storefront with A+ enhanced brand content, professional video, premium images, and optimized bullets — all funded by us.' });
  }
  // Always add catalog + storefront growth plans for any brand
  const catSize = parseInt(data.catalogSize || data.brandProductCount || 0);
  if (catSize > 0 && catSize <= 5 && !plans.find(p => p.title.includes('Catalog'))) {
    plans.push({ title: 'Catalog Expansion', impact: '+40-80% Revenue', text: `With only ${catSize} product${catSize > 1 ? 's' : ''}, adding variations, bundles, and new SKUs captures more search real estate and reduces single-product risk. We fund all new launches.` });
  }
  if ((data.storefront === 'Missing' || data.storefront === 'Exists - needs work') && !plans.find(p => p.title.includes('Storefront'))) {
    plans.push({ title: 'Premium Storefront', impact: '+15-25% Conversion', text: 'We build a custom multi-page brand storefront with curated collections, branded imagery, and A+ enhanced content — all funded by us.' });
  }
  const onPageComp = parseInt(data.onPageCompetitorCount || 0);
  if (onPageComp >= 3 && !plans.find(p => p.title.includes('Defense') || p.title.includes('Ads'))) {
    plans.push({ title: 'Brand Defense Ads', impact: 'Traffic Protection', text: `${onPageComp} competitor ads on your pages. We launch Sponsored Brand and Display campaigns to defend your search results and product pages.` });
  }
  if (plans.length === 0) {
    plans.push({ title: 'Scale Revenue', impact: 'Growth', text: 'We focus on volume growth through funded wholesale orders, new product launches, and advanced advertising — all our capital, your brand.' });
  }

  return plans.slice(0, 3).map(p =>
    `<div class="plan-card">
      <div class="plan-title">${escapeHtml(p.title)}</div>
      <div class="plan-desc">${escapeHtml(p.text)}</div>
      <div class="plan-impact">${escapeHtml(p.impact)}</div>
    </div>`
  ).join('\n');
}


// ============================================================
// NORMALIZE AGENT OUTPUT → RENDERER FORMAT
// ============================================================

function normalizeAgentData(input) {
  if (input.brandName) return input;

  const rd = input.report_data || {};
  const sa = input.seller_analysis || {};
  const sections = rd.sections || {};
  const topAsins = input.top_asins || [];
  const bestProduct = topAsins[0] || {};
  const ps = parseInt(input.priority_score || 50);

  let issueSeverity = 'Low Impact';
  if (ps > 70) issueSeverity = 'High Impact';
  else if (ps > 40) issueSeverity = 'Medium Impact';

  let ratingDist = rd.rating_stars_distribution || input.ratingDistribution || [];
  if (ratingDist.length && ratingDist[0].rating !== undefined && ratingDist[0].stars === undefined) {
    ratingDist = ratingDist.map(d => ({ stars: d.rating, percentage: d.percentage }));
  }

  return {
    brandName: input.brand_name || rd.brand_name || 'Unknown Brand',
    reportDate: rd.report_date || input.report_date || new Date().toISOString().split('T')[0],
    priorityScore: ps,
    brandMaturity: input.brand_maturity || 'Mixed',
    outreachApproach: input.outreach_approach || 'Operational',
    issueSeverity: issueSeverity,

    storefront: (sections.storefront || {}).status || 'Missing',
    fbaStatus: (sections.fulfillment || {}).status || 'FBM Only',
    listingQuality: (sections.listings || {}).status || 'Adequate',
    ppcStatus: (sections.advertising || {}).status || 'None',
    priceStability: (sections.pricing || {}).status || 'Stable',

    sellerCount: sa.total_sellers || rd.seller_count || 0,
    catalogSize: rd.catalog_size || rd.brand_product_count || 0,
    brandProductCount: rd.brand_product_count || rd.catalog_size || 0,
    totalResults: rd.total_results || 0,
    competitorCount: rd.competitor_count || 0,
    fbaPercent: Math.round(rd.fba_percent || 0),
    avgRating: rd.avg_rating || '0.0',
    ppcCount: rd.ppc_count || 0,
    priceRange: rd.price_range || 'N/A',

    bestAsin: bestProduct.asin || '',
    bestAsinTitle: bestProduct.title || '',
    buyBoxSellerName: rd.buy_box_seller || sa.buy_box_holder || '',
    buyBoxIsTheBrand: rd.buy_box_is_brand !== undefined ? rd.buy_box_is_brand : true,
    buyBoxIsFba: rd.buy_box_is_fba !== undefined ? rd.buy_box_is_fba : false,
    buyBoxPrice: bestProduct.price || 0,
    pricingOfferCount: bestProduct.sellers || sa.total_sellers || 0,

    bsrSubcategory: bestProduct.bsr_sub || '',

    listingHasVideo: rd.listing_has_video || false,
    listingImageCount: rd.listing_image_count || 0,
    listingBulletCount: rd.listing_bullet_count || 0,
    answeredQuestionsCount: rd.answered_questions || 0,
    onPageCompetitorCount: rd.on_page_competitor_count || 0,
    reviewHighlights: rd.review_highlights || '',

    ratingDistribution: ratingDist,
    opportunitySummary: input.opportunity_summary || '',

    dateFirstAvailable: rd.date_first_available || '',
    priceStrikethroughValue: rd.price_strikethrough || 0,
    discountPercentage: rd.discount_percentage || 0,
    activeCoupon: rd.coupon_text || '',

    // Product image URL from Oxylabs (url_image from search or images[0] from product detail)
    productImageUrl: rd.product_image_url || input.product_image_url || bestProduct.image_url || '',

    findings: rd.findings || input.findings || [],
    topProducts: topAsins.map(p => ({
      asin: p.asin,
      title: p.title,
      price: p.price,
      rating: p.rating,
      reviews_count: p.reviews_count,
      is_prime: p.is_prime,
      sellers: p.sellers,
      monthly_sales: p.monthly_sales,
      bsr: p.bsr,
      bsr_sub: p.bsr_sub,
      sales_volume: p.sales_volume,
      is_amazons_choice: p.is_amazons_choice,
      best_seller: p.best_seller,
      is_sponsored: p.is_sponsored,
      notBrand: p.notBrand,
      pos: p.pos,
      image_url: p.image_url
    }))
  };
}

// ============================================================
// MAIN RENDER
// ============================================================

function renderHTML(data) {
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  const priority = parseInt(data.priorityScore || '50');
  // Compressed health score — even troubled brands show 50+, avoids insulting brand owners
  const healthScore = Math.max(50, Math.min(88, Math.round(100 - priority * 0.55)));
  const reportId = `PZ-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  // Best product for page 2
  const best = data.topProducts && data.topProducts[0];
  const bestPrice = best ? parseFloat(best.price || 0) : 0;
  const bestTitle = data.bestAsinTitle || (best && best.title) || data.brandName + ' - Top Product';
  const salesVol = best ? (best.sales_volume || best.monthly_sales || '') : '';
  // Gross run rate = price × monthly sales × 12
  const monthlySales = best ? parseInt(best.monthly_sales || best.sales_volume || 0) : 0;
  const grossRunRate = monthlySales > 0 && bestPrice > 0
    ? '$' + fmt(Math.round(bestPrice * monthlySales * 12)) + '/yr'
    : 'N/A';

  const replacements = {
    '{{brandName}}': escapeHtml(data.brandName || 'Unknown Brand'),
    '{{reportDate}}': data.reportDate || new Date().toISOString().split('T')[0],
    '{{reportId}}': reportId,

    // Page 1: The Paradox
    '{{strengthCards}}': renderStrengthCards(data),
    '{{gaugeSVG}}': renderGaugeSVG(healthScore),
    '{{vulnCards}}': renderVulnCards(data),
    '{{opportunitySummary}}': escapeHtml(data.opportunitySummary || 'This brand has significant untapped potential on Amazon. Strategic intervention in fulfillment, content, and advertising can unlock substantial revenue growth.'),

    // Page 2: Asset X-Ray
    '{{bestAsinTitleShort}}': escapeHtml(truncate(bestTitle, 50)),
    '{{bestAsin}}': data.bestAsin || 'N/A',
    '{{bestAsinSalesVolume}}': String(salesVol || 'N/A'),
    '{{bestAsinPrice}}': bestPrice > 0 ? bestPrice.toFixed(2) : 'N/A',
    '{{grossRunRate}}': grossRunRate,
    '{{leftCallouts}}': renderLeftCallouts(data),
    '{{productImageHtml}}': renderProductImage(data),
    '{{rightCallouts}}': renderRightCallouts(data),
    '{{priceRange}}': escapeHtml(data.priceRange || 'N/A'),
    '{{sellerCount}}': String(data.sellerCount || '0'),
    '{{competitorCount}}': String(data.competitorCount || 0),
    '{{catalogSize}}': String(data.catalogSize || 0),

    // Page 3: Cost of Friction
    '{{leakCards}}': renderRevenueLeak(data),
    '{{planCards}}': renderGrowthPlan(data),
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }
  return html;
}

// ============================================================
// PDF GENERATION
// ============================================================

const DECK_PATH = path.join(__dirname, 'profitzon-deck.pdf');

function renderCoverHTML(data, deckPageCount) {
  let html = fs.readFileSync(COVER_TEMPLATE_PATH, 'utf8');
  const reportId = `PZ-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  // Product image watermark on cover (faded)
  const productWatermark = data.productImageUrl
    ? `<img class="product-watermark" src="${escapeHtml(data.productImageUrl)}" alt="">`
    : '';

  const replacements = {
    '{{logoBase64}}': logoBase64,
    '{{brandName}}': escapeHtml(data.brandName || 'Unknown Brand'),
    '{{reportDate}}': data.reportDate || new Date().toISOString().split('T')[0],
    '{{reportId}}': reportId,
    '{{productImageWatermark}}': productWatermark,
  };
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }
  return html;
}

async function renderPDF(data) {
  const puppeteer = require('puppeteer');
  const { PDFDocument } = require('pdf-lib');
  const os = require('os');

  let deckPageCount = 0;
  let deckDoc = null;
  if (fs.existsSync(DECK_PATH)) {
    try {
      const deckBytes = fs.readFileSync(DECK_PATH);
      deckDoc = await PDFDocument.load(deckBytes, { ignoreEncryption: true });
      deckPageCount = deckDoc.getPageCount();
    } catch (e) {
      console.error('Could not load deck PDF:', e.message);
    }
  }

  const auditHtml = renderHTML(data);
  const coverHtml = renderCoverHTML(data, deckPageCount);

  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  await page.setViewport({ width: 1000, height: 1414, deviceScaleFactor: 3 });

  // Render cover page
  await page.setContent(coverHtml, { waitUntil: 'domcontentloaded' });
  const coverPdfBytes = await page.pdf({
    width: '1000px', height: '1414px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  // Render audit pages (allow network load for product images)
  await page.setContent(auditHtml, { waitUntil: 'load', timeout: 15000 });
  const auditPdfBytes = await page.pdf({
    width: '1000px', height: '1414px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await browser.close();

  // Merge: Cover → Audit → Deck
  const merged = await PDFDocument.create();

  const coverDoc = await PDFDocument.load(coverPdfBytes);
  const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices());
  coverPages.forEach(p => merged.addPage(p));

  const auditDoc = await PDFDocument.load(auditPdfBytes);
  const auditPages = await merged.copyPages(auditDoc, auditDoc.getPageIndices());
  auditPages.forEach(p => merged.addPage(p));

  if (deckDoc) {
    try {
      const deckPages = await merged.copyPages(deckDoc, deckDoc.getPageIndices());
      deckPages.forEach(p => merged.addPage(p));
    } catch (e) {
      console.error('Could not merge deck PDF:', e.message);
    }
  }

  const mergedBytes = await merged.save();
  const tmpPath = path.join(os.tmpdir(), `audit-${Date.now()}.pdf`);
  fs.writeFileSync(tmpPath, mergedBytes);
  return tmpPath;
}

// ============================================================
// EXPRESS SERVER
// ============================================================

async function startServer(port) {
  const express = require('express');
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.post('/render', async (req, res) => {
    try {
      const raw = req.body;
      if (!raw || (!raw.brandName && !raw.report_data && !raw.brand_name)) {
        return res.status(400).json({ error: 'Missing brand data in request body' });
      }
      const data = normalizeAgentData(raw);
      if (req.query.format === 'html') {
        return res.setHeader('Content-Type', 'text/html').send(renderHTML(data));
      }
      const pdfPath = await renderPDF(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${data.brandName.replace(/[^a-zA-Z0-9]/g, '_')}_Amazon_Audit.pdf"`);
      const stream = fs.createReadStream(pdfPath);
      stream.pipe(res);
      stream.on('end', () => { try { fs.unlinkSync(pdfPath); } catch (e) {} });
    } catch (err) {
      console.error('Render error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/deck', (req, res) => {
    const deckPath = path.join(__dirname, 'profitzon-deck.pdf');
    if (!fs.existsSync(deckPath)) {
      return res.status(404).json({ error: 'Deck PDF not found' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Profitzon_Capital_Partner.pdf"');
    fs.createReadStream(deckPath).pipe(res);
  });

  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'profitzon-audit-renderer', version: 'v9.1-infographic' }));

  app.listen(port, () => {
    console.log(`Profitzon Audit Renderer v9.0-corporate running on port ${port}`);
    console.log(`POST /render — send JSON data, get PDF`);
  });
}

// ============================================================
// CLI / DEMO
// ============================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--serve')) {
    const portIdx = args.indexOf('--port');
    const port = process.env.PORT || (portIdx !== -1 ? parseInt(args[portIdx + 1]) : 3100);
    return startServer(port);
  }

  if (args.includes('--data')) {
    const dataIdx = args.indexOf('--data');
    const data = JSON.parse(args[dataIdx + 1]);
    const outputIdx = args.indexOf('--output');
    const output = outputIdx !== -1 ? args[outputIdx + 1] : `${data.brandName || 'audit'}_report.pdf`;
    if (args.includes('--html')) {
      fs.writeFileSync(output.replace('.pdf', '.html'), renderHTML(data));
      console.log('HTML saved to', output.replace('.pdf', '.html'));
    } else {
      const tmpPdf = await renderPDF(data);
      fs.copyFileSync(tmpPdf, output);
      fs.unlinkSync(tmpPdf);
      console.log('PDF saved to', output);
    }
    return;
  }

  // Demo with sample data
  const sampleData = {
    brandName: "Nano Clear",
    reportDate: "2026-03-19",
    priorityScore: "75",
    brandMaturity: "Weak",
    outreachApproach: "Operational",
    issueSeverity: "High Impact",
    storefront: "Weak/Unoptimized",
    fbaStatus: "FBM Only",
    listingQuality: "Adequate",
    ppcStatus: "None",
    priceStability: "Minor Fluctuation",
    sellerCount: 8,
    catalogSize: 6,
    brandProductCount: 6,
    totalResults: 100,
    competitorCount: 14,
    fbaPercent: 0,
    avgRating: "4.0",
    ppcCount: 0,
    priceRange: "$19 - $95",
    bestAsin: "B0DQSK8Y52",
    bestAsinTitle: "Nano Clear Watch Crystal Scratch Remover Kit Complete - Professional Grade",
    buyBoxSellerName: "ClearDealz LLC",
    buyBoxIsTheBrand: false,
    buyBoxIsFba: true,
    buyBoxPrice: 49.99,
    priceStrikethroughValue: 69.99,
    discountPercentage: 29,
    activeCoupon: "",
    pricingOfferCount: 5,
    bsrSubcategory: "#1,234 in Watch Repair Kits",
    bsrMainCategory: "#46,921 in Tools & Home Improvement",
    ratingDistribution: [
      { stars: 5, percentage: 58 },
      { stars: 4, percentage: 18 },
      { stars: 3, percentage: 8 },
      { stars: 2, percentage: 4 },
      { stars: 1, percentage: 12 }
    ],
    listingHasVideo: false,
    listingImageCount: 4,
    listingBulletCount: 5,
    answeredQuestionsCount: 3,
    dateFirstAvailable: "August 15, 2023",
    onPageCompetitorCount: 7,
    reviewHighlights: "Customers praise the effectiveness on minor scratches and ease of use. Common complaints include the small bottle size for the price and mixed results on deeper scratches.",
    productImageUrl: "",
    opportunitySummary: "Nano Clear has 6 products on Amazon but zero Prime coverage, 8 unauthorized sellers, and a third-party controls the Buy Box on the top product. Moving to FBA, cleaning up sellers, and launching brand defense ads could recover 30-50% in lost revenue.",
    findings: [
      { type: "issue", text: "Buy Box on your top product is controlled by ClearDealz LLC - a third-party seller, not Nano Clear. They are capturing your revenue from your best listing." },
      { type: "issue", text: "0% FBA coverage - all Nano Clear products ship FBM. No Prime badge means 30-50% lower Buy Box win rate." },
      { type: "issue", text: "8 different sellers detected on your ASINs. Multiple unauthorized resellers are eroding margins and causing price instability." },
      { type: "competitor", text: "14 competitor products appear when customers search Nano Clear - with no defensive PPC running." }
    ],
    topProducts: [
      { title: "Nano Clear Watch Crystal Scratch Remover Kit Complete", price: 49.99, rating: 4.2, reviews_count: 312, is_prime: false, is_amazons_choice: false, best_seller: false, is_sponsored: false, asin: "B0DQSK8Y52", pos: 3, sales_volume: "200+ bought" },
      { title: "Nano Clear Watch Cleaner & Scratch Remover 2.1", price: 94.49, rating: 4.0, reviews_count: 86, is_prime: false, is_amazons_choice: false, best_seller: false, is_sponsored: false, asin: "B0ABC12345", pos: 5, sales_volume: "100+ bought" },
      { title: "Nano Clear Jewelry Cleaning Cloth Microfiber", price: 19.99, rating: 3.8, reviews_count: 45, is_prime: false, is_amazons_choice: false, best_seller: false, is_sponsored: false, asin: "B0DEF67890", pos: 8, sales_volume: "" },
      { title: "Generic Screen Protector (NOT Nano Clear)", price: 12.99, rating: 4.5, reviews_count: 2340, is_prime: true, is_amazons_choice: true, best_seller: true, is_sponsored: false, notBrand: true, asin: "B0GHI11111", pos: 1, sales_volume: "5K+ bought" },
      { title: "Competitor Watch Polish Premium Kit", price: 34.99, rating: 4.6, reviews_count: 1890, is_prime: true, is_amazons_choice: false, best_seller: false, is_sponsored: true, notBrand: true, asin: "B0JKL22222", pos: 2, sales_volume: "1K+ bought" }
    ]
  };

  const html = renderHTML(sampleData);
  fs.writeFileSync(path.join(__dirname, 'demo-report.html'), html);
  console.log('Demo report v8 saved to demo-report.html');

  try {
    const tmpPdf = await renderPDF(sampleData);
    const outPath = path.join(__dirname, 'demo-report.pdf');
    fs.copyFileSync(tmpPdf, outPath);
    fs.unlinkSync(tmpPdf);
    const stats = fs.statSync(outPath);
    console.log(`Demo PDF saved to demo-report.pdf (${(stats.size / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.log('PDF generation skipped:', e.message);
  }
}

main().catch(console.error);
