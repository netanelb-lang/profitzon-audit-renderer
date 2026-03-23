/**
 * Profitzon Brand Audit Report Renderer v12.0-premium
 * Dark navy + gold + dark red/green — premium consulting aesthetic.
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
  const label = s < 45 ? 'NEEDS WORK' : s < 60 ? 'FAIR' : s < 75 ? 'GOOD' : s < 88 ? 'STRONG' : 'EXCELLENT';
  // Gold donut ring on dark background
  const circ = 2 * Math.PI * 54;
  const filled = (s / 100) * circ;
  return `<svg width="140" height="140" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
    <circle cx="70" cy="70" r="54" fill="none" stroke="#1e293b" stroke-width="10"/>
    <circle cx="70" cy="70" r="54" fill="none" stroke="#f5a623" stroke-width="10" stroke-dasharray="${filled} ${circ}" stroke-dashoffset="${circ / 4}" stroke-linecap="round" transform="rotate(-90 70 70)"/>
    <text x="70" y="64" text-anchor="middle" font-family="Inter,sans-serif" font-size="34" font-weight="900" fill="#fff">${s}</text>
    <text x="70" y="82" text-anchor="middle" font-family="Inter,sans-serif" font-size="9" font-weight="700" fill="#f5a623" letter-spacing="2">${label}</text>
  </svg>`;
}

// ============================================================
// PAGE 1: METRICS GRID (on dark bg)
// ============================================================

function renderMetricsGrid(data) {
  const rating = parseFloat(data.avgRating || 0);
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);
  const cat = parseInt(data.catalogSize || data.brandProductCount || 0);
  const bp = parseInt(data.brandProductCount || 0);
  const tr = parseInt(data.totalResults || 1);
  const pct = bp > 0 ? Math.round((bp / tr) * 100) : 0;
  const onPage = parseInt(data.onPageCompetitorCount || 0);
  const metrics = [
    { val: rating > 0 ? rating.toFixed(1) + ' &#9733;' : 'N/A', label: 'Avg Rating' },
    { val: fba + '%', label: 'Prime / FBA' },
    { val: String(sc), label: 'Sellers' },
    { val: String(cat), label: 'Catalog SKUs' },
    { val: pct + '%', label: 'Search Share' },
    { val: escapeHtml(data.priceRange || 'N/A'), label: 'Price Range' },
    { val: String(onPage), label: 'Competitor Ads' },
    { val: data.buyBoxIsTheBrand !== false ? 'Brand' : 'Lost', label: 'Buy Box' },
  ];
  return metrics.map(m =>
    `<div class="mt"><div class="mt-val">${m.val}</div><div class="mt-label">${m.label}</div></div>`
  ).join('\n');
}

// ============================================================
// PAGE 1: STRENGTHS & VULNERABILITIES (gold/slate dots)
// ============================================================

function renderStrengthCards(data) {
  const items = [];
  const bp = parseInt(data.brandProductCount || 0);
  const tr = parseInt(data.totalResults || 1);
  const pct = Math.round((bp / tr) * 100);
  const fba = parseInt(data.fbaPercent || 0);
  const rating = parseFloat(data.avgRating || 0);
  const best = data.topProducts && data.topProducts[0];
  const reviews = best ? (best.reviews_count || 0) : 0;

  if (rating > 0) items.push({ val: rating.toFixed(1) + ' Customer Rating', desc: fmt(reviews) + ' reviews — strong social proof driving purchases' });
  if (pct > 0) items.push({ val: pct + '% Search Dominance', desc: 'Brand products lead organic search results' });
  if (data.priceRange && data.priceRange !== 'N/A') items.push({ val: escapeHtml(data.priceRange) + ' Price Range', desc: 'Stable pricing mechanics across catalog' });
  if (fba >= 70) items.push({ val: fba + '% Prime Coverage', desc: 'Strong fulfillment footprint on Amazon' });
  if (data.buyBoxIsTheBrand !== false) items.push({ val: 'Buy Box Controlled', desc: 'Brand holds the primary purchase button' });
  if (best && best.monthly_sales > 0) items.push({ val: fmt(best.monthly_sales) + '+ Units/Month', desc: 'Proven demand on top-selling product' });
  if (items.length === 0) items.push({ val: 'Brand Presence Active', desc: 'Listed and discoverable on Amazon marketplace' });

  return items.slice(0, 5).map(i =>
    `<div class="finding"><div class="finding-dot green"></div><div><div class="finding-title">${i.val}</div><div class="finding-desc">${i.desc}</div></div></div>`
  ).join('\n');
}

function renderVulnCards(data) {
  const items = [];
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);
  const bp = parseInt(data.brandProductCount || 0);

  if (data.buyBoxIsTheBrand === false && sc > 5) items.push({ val: 'Buy Box Lost to Reseller', desc: escapeHtml(data.buyBoxSellerName || 'Third party') + ' controls the primary purchase button' });
  if (sc > 3) items.push({ val: sc + ' Unauthorized Sellers', desc: 'Price erosion, margin compression, brand inconsistency' });
  if (fba < 50) items.push({ val: 'Only ' + fba + '% Prime Coverage', desc: 'Missing Prime badge suppressing conversion rate' });
  if (onPage >= 3) items.push({ val: onPage + ' Competitor Ads on Page', desc: 'Rivals siphoning traffic from your product listings' });
  if (data.listingQuality === 'Weak/No A+' || data.listingQuality === 'Adequate') items.push({ val: 'Weak Listing Content', desc: 'Missing A+ content suppressing algorithm visibility' });
  if (data.storefront === 'Missing' || data.storefront === 'Exists - needs work') items.push({ val: 'No Optimized Storefront', desc: 'Missing branded shopping experience on Amazon' });
  if (bp > 0 && bp <= 3) items.push({ val: 'Only ' + bp + ' SKU' + (bp > 1 ? 's' : '') + ' in Catalog', desc: 'Single-product risk — one suspension means zero revenue' });
  if (items.length === 0) items.push({ val: 'Minor Optimizations Available', desc: 'No critical gaps — room for strategic growth' });

  return items.slice(0, 5).map(i =>
    `<div class="finding"><div class="finding-dot red"></div><div><div class="finding-title">${i.val}</div><div class="finding-desc">${i.desc}</div></div></div>`
  ).join('\n');
}

// ============================================================
// PAGE 2: ASSESSMENT CARDS (replaces callouts)
// ============================================================

function renderAssessmentCards(data) {
  const cards = [];
  const imgs = parseInt(data.listingImageCount || 0);
  const hasVideo = data.listingHasVideo;
  const rating = parseFloat(data.avgRating || 0);
  const best = data.topProducts && data.topProducts[0];
  const reviews = best ? (best.reviews_count || 0) : 0;
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);

  // Content
  const contentScore = (hasVideo && imgs >= 7) ? 90 : (imgs >= 5) ? 60 : 30;
  const contentBadge = contentScore >= 80 ? 'strong' : contentScore >= 50 ? 'ok' : 'needs';
  const contentLabel = contentScore >= 80 ? 'Strong' : contentScore >= 50 ? 'Adequate' : 'Weak';
  cards.push({ cat: 'Content', val: `${imgs} Images${hasVideo ? ' + Video' : ', No Video'}`, note: hasVideo && imgs >= 7 ? 'Rich listing content present' : 'A+ content and video recommended', badge: contentBadge, label: contentLabel, pct: contentScore });

  // Rating
  const ratingScore = rating >= 4.0 ? 85 : rating >= 3.5 ? 60 : 30;
  const ratingBadge = ratingScore >= 80 ? 'strong' : ratingScore >= 50 ? 'ok' : 'needs';
  const ratingLabel = ratingScore >= 80 ? 'Strong' : ratingScore >= 50 ? 'OK' : 'Low';
  cards.push({ cat: 'Rating', val: `${rating.toFixed(1)} &#9733; (${fmt(reviews)} Reviews)`, note: rating >= 4.0 ? 'Above purchase decision threshold' : 'Review strategy improvement recommended', badge: ratingBadge, label: ratingLabel, pct: ratingScore });

  // Buy Box
  const bbOwned = data.buyBoxIsTheBrand !== false;
  cards.push({ cat: 'Buy Box', val: bbOwned ? 'Brand Controlled' : escapeHtml(data.buyBoxSellerName || 'Third Party'), note: bbOwned ? 'Purchase button held by brand' : 'Non-authorized seller controls the sale', badge: bbOwned ? 'strong' : 'needs', label: bbOwned ? 'Owned' : 'Lost', pct: bbOwned ? 90 : 15 });

  // Fulfillment
  const fbaScore = fba >= 90 ? 95 : fba >= 70 ? 75 : fba >= 40 ? 50 : 20;
  cards.push({ cat: 'Fulfillment', val: fba + '% Prime / FBA', note: fba >= 90 ? 'Full Prime visibility' : 'Expand FBA coverage for conversion lift', badge: fbaScore >= 80 ? 'strong' : fbaScore >= 50 ? 'ok' : 'needs', label: fbaScore >= 80 ? 'Strong' : fbaScore >= 50 ? 'Partial' : 'Weak', pct: fbaScore });

  // Competition
  const compScore = onPage === 0 ? 90 : onPage <= 2 ? 65 : 25;
  cards.push({ cat: 'Ad Defense', val: onPage > 0 ? `${onPage} Competitor Ads` : 'No Competitor Ads', note: onPage > 0 ? 'Rivals targeting your product pages' : 'Clean — no rival ad placements', badge: compScore >= 80 ? 'strong' : compScore >= 50 ? 'ok' : 'needs', label: compScore >= 80 ? 'Clean' : compScore >= 50 ? 'Moderate' : 'At Risk', pct: compScore });

  // Sellers
  const sellerScore = sc <= 1 ? 95 : sc <= 3 ? 70 : sc <= 6 ? 40 : 15;
  cards.push({ cat: 'Seller Map', val: `${sc} Active Seller${sc !== 1 ? 's' : ''}`, note: sc > 3 ? 'Price competition eroding margins' : 'Clean seller distribution', badge: sellerScore >= 70 ? 'strong' : sellerScore >= 40 ? 'ok' : 'needs', label: sellerScore >= 70 ? 'Clean' : sellerScore >= 40 ? 'Crowded' : 'Chaotic', pct: sellerScore });

  return cards.map(c => {
    const barColor = c.badge === 'strong' ? 'green' : c.badge === 'needs' ? 'red' : 'gold';
    return `<div class="assess">
      <div class="assess-top"><div class="assess-cat">${c.cat}</div><div class="assess-badge ${c.badge}">${c.label}</div></div>
      <div class="assess-val">${c.val}</div>
      <div class="assess-note">${c.note}</div>
      <div class="assess-bar"><div class="assess-fill ${barColor}" style="width:${c.pct}%"></div></div>
    </div>`;
  }).join('\n');
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
// PAGE 3: FRICTION PAIRS (leak → plan side by side)
// ============================================================

function buildLeaks(data) {
  const leaks = [];
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);

  if (data.buyBoxIsTheBrand === false && sc > 5) {
    leaks.push({ title: 'Buy Box at Risk', severity: 'High', text: `With ${sc} sellers competing, the Buy Box holder may not be authorized. Revenue leaking to resellers.` });
  }
  if (fba < 50) {
    leaks.push({ title: 'No Prime Badge', severity: fba === 0 ? 'Critical' : 'High', text: `Only ${fba}% Prime coverage. Products without Prime are invisible to 200M+ Prime shoppers.` });
  }
  if (sc > 3) {
    leaks.push({ title: 'Seller Chaos', severity: sc > 6 ? 'Critical' : 'High', text: `${sc} sellers competing on your products, undercutting each other and destroying margins.` });
  }
  if (data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') {
    leaks.push({ title: 'Search Hijacked', severity: 'High', text: 'Competitors bidding on your brand name. Customers searching for you see their products first.' });
  }
  if (data.listingQuality === 'Weak/No A+') {
    leaks.push({ title: 'Content Gap', severity: 'Medium', text: 'Missing A+ content, video, or optimized storefront. We handle the full build.' });
  }
  const catalogSize = parseInt(data.catalogSize || data.brandProductCount || 0);
  if (catalogSize > 0 && catalogSize <= 3) {
    leaks.push({ title: 'Single-SKU Risk', severity: 'Medium', text: `Only ${catalogSize} product${catalogSize > 1 ? 's' : ''} — one suspension means zero revenue.` });
  }
  const onPage = parseInt(data.onPageCompetitorCount || 0);
  if (onPage >= 3 && !leaks.find(l => l.title.includes('Search'))) {
    leaks.push({ title: 'Ad Leakage', severity: 'Medium', text: `${onPage} competitor ads on your pages — every click is revenue walking away.` });
  }
  if (data.storefront === 'Missing' || data.storefront === 'Exists - needs work') {
    if (!leaks.find(l => l.title.includes('Content'))) {
      leaks.push({ title: 'Storefront Gap', severity: 'Medium', text: 'No brand storefront. Premium storefronts lift conversion 15-25%.' });
    }
  }
  if (leaks.length === 0) {
    leaks.push({ title: 'Scale Opportunity', severity: 'Low', text: 'No critical leaks — funded scaling can accelerate growth significantly.' });
  }
  return leaks.slice(0, 3);
}

function buildPlans(data) {
  const plans = [];
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);

  if (data.buyBoxIsTheBrand === false && sc > 5) {
    plans.push({ title: 'Secure Buy Box', impact: 'Revenue Recovery', text: 'Remove unauthorized sellers, ensure Buy Box held by authorized partners.' });
  }
  if (fba < 70) {
    plans.push({ title: 'Prime Badge Strategy', impact: '+30-50% Sales', text: `Ship ${fba === 0 ? 'entire catalog' : 'remaining SKUs'} through our Las Vegas FBA hub.` });
  }
  if (sc > 3) {
    plans.push({ title: 'Clean Seller Map', impact: 'Margin Protection', text: 'Enforce brand authorization and MAP pricing. Remove unauthorized resellers.' });
  }
  if (data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') {
    plans.push({ title: 'Brand Defense Ads', impact: 'Traffic Protection', text: 'Launch brand search ads to keep competitors off your results.' });
  }
  if (data.listingQuality === 'Weak/No A+' || data.listingQuality === 'Adequate') {
    plans.push({ title: 'A+ Content Build', impact: '+15-25% Conversion', text: 'Full A+ storefront, video, premium images — all funded by us.' });
  }
  const catSize = parseInt(data.catalogSize || data.brandProductCount || 0);
  if (catSize > 0 && catSize <= 5 && !plans.find(p => p.title.includes('Catalog'))) {
    plans.push({ title: 'Catalog Expansion', impact: '+40-80% Revenue', text: 'Add variations, bundles, new SKUs. We fund all launches.' });
  }
  if ((data.storefront === 'Missing' || data.storefront === 'Exists - needs work') && !plans.find(p => p.title.includes('Storefront') || p.title.includes('A+'))) {
    plans.push({ title: 'Premium Storefront', impact: '+15-25% Conversion', text: 'Custom multi-page storefront with curated collections — funded by us.' });
  }
  const onPageComp = parseInt(data.onPageCompetitorCount || 0);
  if (onPageComp >= 3 && !plans.find(p => p.title.includes('Defense') || p.title.includes('Ads'))) {
    plans.push({ title: 'Brand Defense Ads', impact: 'Traffic Protection', text: 'Sponsored Brand + Display campaigns to defend your pages.' });
  }
  if (plans.length === 0) {
    plans.push({ title: 'Scale Revenue', impact: 'Growth', text: 'Volume growth through funded wholesale, new launches, advanced advertising.' });
  }
  return plans.slice(0, 3);
}

function renderFrictionPairs(data) {
  const leaks = buildLeaks(data);
  const plans = buildPlans(data);
  const count = Math.max(leaks.length, plans.length);
  const arrow = `<svg viewBox="0 0 18 18" fill="none"><path d="M4 9h8M9 5l4 4-4 4" stroke="#f5a623" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  let html = '';
  for (let i = 0; i < count; i++) {
    const leak = leaks[i] || { title: '', severity: '', text: '' };
    const plan = plans[i] || { title: '', impact: '', text: '' };
    const sevTag = leak.severity === 'Critical' ? 'Critical' : leak.severity === 'High' ? 'High Impact' : 'Medium';
    html += `<div class="pair">
      <div class="pair-card leak-c">
        <div class="pair-title">${escapeHtml(leak.title)}</div>
        <div class="pair-desc">${escapeHtml(leak.text)}</div>
        ${leak.severity ? `<div class="pair-tag dark">${sevTag}</div>` : ''}
      </div>
      <div class="pair-arrow">${arrow}</div>
      <div class="pair-card plan-c">
        <div class="pair-title">${escapeHtml(plan.title)}</div>
        <div class="pair-desc">${escapeHtml(plan.text)}</div>
        ${plan.impact ? `<div class="pair-tag gold">${escapeHtml(plan.impact)}</div>` : ''}
      </div>
    </div>`;
  }
  return html;
}

// ============================================================
// PAGE 3: EXPECTED RESULTS
// ============================================================

function renderExpectedResults(data) {
  const lift = (data.expectedLift || {});
  const results = [
    { val: lift.buy_box || '>=90%', label: 'Buy Box Win' },
    { val: lift.cvr_lift || '+10-30%', label: 'Conv. Lift' },
    { val: lift.revenue_growth || '15-40%', label: 'Revenue Growth' },
    { val: lift.map_compliance || '>=95%', label: 'MAP Compliance' },
  ];
  return results.map(r =>
    `<div class="result"><div class="result-val">${escapeHtml(r.val)}</div><div class="result-label">${r.label}</div></div>`
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
    expectedLift: rd.expected_lift || input.expected_lift || {},
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
    '{{gaugeSVG}}': renderGaugeSVG(healthScore),
    '{{metricsGrid}}': renderMetricsGrid(data),
    '{{strengthCards}}': renderStrengthCards(data),
    '{{vulnCards}}': renderVulnCards(data),
    '{{opportunitySummary}}': escapeHtml(data.opportunitySummary || 'This brand has significant untapped potential on Amazon. Strategic intervention in fulfillment, content, and advertising can unlock substantial revenue growth.'),

    // Page 2: Asset X-Ray
    '{{bestAsinTitleShort}}': escapeHtml(truncate(bestTitle, 50)),
    '{{bestAsin}}': data.bestAsin || 'N/A',
    '{{bestAsinSalesVolume}}': String(salesVol || 'N/A'),
    '{{bestAsinPrice}}': bestPrice > 0 ? bestPrice.toFixed(2) : 'N/A',
    '{{grossRunRate}}': grossRunRate,
    '{{productImageHtml}}': renderProductImage(data),
    '{{assessmentCards}}': renderAssessmentCards(data),
    '{{priceRange}}': escapeHtml(data.priceRange || 'N/A'),
    '{{sellerCount}}': String(data.sellerCount || '0'),
    '{{competitorCount}}': String(data.competitorCount || 0),
    '{{catalogSize}}': String(data.catalogSize || 0),

    // Page 3: Friction Pairs + Expected Results
    '{{frictionPairs}}': renderFrictionPairs(data),
    '{{expectedResults}}': renderExpectedResults(data),
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

  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'profitzon-audit-renderer', version: 'v12.0-premium' }));

  app.listen(port, () => {
    console.log(`Profitzon Audit Renderer v12.0-premium running on port ${port}`);
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
