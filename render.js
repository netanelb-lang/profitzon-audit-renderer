/**
 * Profitzon Brand Audit Report Renderer v3
 * 3-page report with product intelligence, competitive analysis, and action plan.
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

function statusToClass(status) {
  const green = ['Exists', 'Full FBA', 'Strong', 'Active', 'Stable', 'No Issues'];
  const yellow = ['Weak/Unoptimized', 'Partial FBA', 'Adequate', 'Minor Fluctuation', 'Medium Impact', 'Low Impact'];
  const red = ['Missing', 'FBM Only', 'Weak/No A+', 'MAP Violated', 'Competitor Dominated', 'High Impact'];
  if (green.includes(status)) return 's-green';
  if (yellow.includes(status)) return 's-yellow';
  if (red.includes(status)) return 's-red';
  return 's-gray';
}

function statusToCardColor(status) {
  const green = ['Exists', 'Full FBA', 'Strong', 'Active', 'Stable', 'No Issues'];
  const yellow = ['Weak/Unoptimized', 'Partial FBA', 'Adequate', 'Minor Fluctuation', 'Medium Impact', 'Low Impact'];
  const red = ['Missing', 'FBM Only', 'Weak/No A+', 'MAP Violated', 'Competitor Dominated', 'High Impact'];
  if (green.includes(status)) return 'green';
  if (yellow.includes(status)) return 'yellow';
  if (red.includes(status)) return 'red';
  return 'gray';
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

// ============================================================
// SECTION RENDERERS
// ============================================================

function renderBuyBoxAlert(data) {
  if (data.buyBoxIsTheBrand !== false) return '';
  const seller = escapeHtml(data.buyBoxSellerName || 'an unknown third-party');
  const brand = escapeHtml(data.brandName || 'your brand');
  const offers = parseInt(data.pricingOfferCount || 0);
  const extra = offers > 1 ? ` with ${offers} total sellers competing on this product` : '';
  return `<div class="buybox-alert">
    <div class="buybox-alert-icon">&#9888;</div>
    <div class="buybox-alert-text">
      <strong>Buy Box Alert:</strong> Your top product's Buy Box is controlled by <strong>${seller}</strong>, not ${brand}${extra}. This means a third-party seller is capturing the revenue from your best listing.
    </div>
  </div>`;
}

function renderExecutiveSummary(data) {
  const bullets = [];
  const brand = escapeHtml(data.brandName || 'This brand');
  const bp = parseInt(data.brandProductCount || 0);
  const tr = parseInt(data.totalResults || 0);
  const fba = parseInt(data.fbaPercent || 0);
  const cc = parseInt(data.competitorCount || 0);
  const sc = parseInt(data.sellerCount || 0);

  // Bullet 1: Presence
  bullets.push({ color: 'blue', text: `${brand} has <strong>${bp} product${bp !== 1 ? 's' : ''}</strong> on Amazon out of ${tr} total results for the brand search term.` });

  // Bullet 2: Buy Box (if issue) or FBA
  if (data.buyBoxIsTheBrand === false) {
    bullets.push({ color: 'red', text: `<strong>Buy Box is controlled by a third-party seller</strong> — the brand does not own the Buy Box on its best product.` });
  } else if (fba < 50) {
    bullets.push({ color: 'red', text: `Only <strong>${fba}% of products are FBA/Prime eligible</strong> — limiting Buy Box win rate and visibility.` });
  } else {
    bullets.push({ color: 'green', text: `<strong>${fba}% FBA coverage</strong> — ${fba >= 80 ? 'strong' : 'adequate'} Prime eligibility across the catalog.` });
  }

  // Bullet 3: Competitors
  if (cc > 0) {
    bullets.push({ color: 'amber', text: `<strong>${cc} competitor product${cc !== 1 ? 's' : ''}</strong> appear when customers search the brand name${data.ppcStatus === 'None' ? ' — with no defensive advertising running' : ''}.` });
  }

  // Bullet 4: Sellers
  if (sc > 3) {
    bullets.push({ color: 'red', text: `<strong>${sc} different sellers</strong> detected across listings — unauthorized resellers may be eroding margins.` });
  }

  return `<div class="exec-summary">${bullets.map(b =>
    `<div class="exec-summary-row"><div class="exec-bullet ${b.color}">&#8226;</div><div>${b.text}</div></div>`
  ).join('\n')}</div>`;
}

function renderSearchOwnership(data) {
  const bp = parseInt(data.brandProductCount || 0);
  const tr = parseInt(data.totalResults || 1);
  const pct = Math.round((bp / tr) * 100);
  const cls = pct < 20 ? 'low' : pct < 50 ? 'mid' : 'high';
  const compPct = 100 - pct;

  return `<div class="ownership-bar">
    <div class="ownership-pct ${cls}">${pct}%</div>
    <div class="ownership-info">
      <div class="ownership-label">You own ${pct}% of search results for your brand name</div>
      <div class="ownership-desc">Competitors capture the other ${compPct}% — ${bp} of ${tr} results are yours</div>
    </div>
    <div class="ownership-track" style="width:180px"><div class="ownership-fill ${cls}" style="width:${Math.max(pct, 3)}%"></div></div>
  </div>`;
}

function renderRatingDistribution(data) {
  const dist = data.ratingDistribution;
  if (!dist || !dist.length) return '<div class="dd-sub">No rating data available</div>';

  return `<div class="rating-bars">${dist.map(d => {
    const w = Math.max(d.percentage || 0, 1);
    return `<div class="rating-bar-row">
      <div class="rating-bar-label">${d.stars}&#9733;</div>
      <div class="rating-bar-track"><div class="rating-bar-fill r${d.stars}" style="width:${w}%"></div></div>
      <div class="rating-bar-pct">${d.percentage}%</div>
    </div>`;
  }).join('\n')}</div>`;
}

function renderListingHealth(data) {
  const checks = [];
  const imgs = parseInt(data.listingImageCount || 0);
  const bullets = parseInt(data.listingBulletCount || 0);
  const qa = parseInt(data.answeredQuestionsCount || 0);

  checks.push({ ok: data.listingHasVideo, label: 'Video', good: 'Yes', bad: 'No' });
  checks.push({ ok: imgs >= 6, label: `${imgs} Images`, good: imgs >= 6 ? null : null, warn: imgs >= 4 && imgs < 6 });
  checks.push({ ok: bullets >= 5, label: `${bullets} Bullets`, warn: bullets >= 3 && bullets < 5 });
  checks.push({ ok: qa > 0, label: `${qa} Q&A`, good: qa > 0 ? null : null });

  return `<div class="listing-health">${checks.map(c => {
    const cls = c.ok ? 'good' : (c.warn ? 'warn' : 'bad');
    const icon = c.ok ? '&#10003;' : (c.warn ? '!' : '&#10007;');
    return `<div class="health-item"><div class="health-check ${cls}">${icon}</div>${c.label}</div>`;
  }).join('\n')}</div>`;
}

function renderBrandVsCompetitor(data) {
  const products = data.topProducts || [];
  const brandProducts = products.filter(p => !p.notBrand);
  const compProducts = products.filter(p => p.notBrand);

  if (brandProducts.length === 0 || compProducts.length === 0) {
    return '<div style="font-size:11px;color:#94a3b8;text-align:center;padding:20px;">Not enough data for comparison</div>';
  }

  const avg = (arr, key) => arr.length ? (arr.reduce((s, p) => s + (parseFloat(p[key]) || 0), 0) / arr.length) : 0;
  const brandAvgPrice = avg(brandProducts, 'price');
  const compAvgPrice = avg(compProducts, 'price');
  const brandAvgRating = avg(brandProducts, 'rating');
  const compAvgRating = avg(compProducts, 'rating');
  const brandAvgReviews = avg(brandProducts, 'reviews_count');
  const compAvgReviews = avg(compProducts, 'reviews_count');
  const brandPrime = brandProducts.filter(p => p.is_prime).length;
  const compPrime = compProducts.filter(p => p.is_prime).length;

  const row = (label, bVal, cVal, highlight) => {
    const bBetter = highlight === 'lower' ? bVal <= cVal : bVal >= cVal;
    return `<div style="display:flex;align-items:center;margin-bottom:6px;">
      <div style="flex:1;text-align:center;font-size:13px;font-weight:700;color:${bBetter ? '#34d399' : '#f87171'}">${bVal}</div>
      <div style="width:80px;text-align:center;font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">${label}</div>
      <div style="flex:1;text-align:center;font-size:13px;font-weight:700;color:${!bBetter ? '#34d399' : '#f87171'}">${cVal}</div>
    </div>`;
  };

  return `<div class="comparison">
    <div class="comp-col brand-col">
      <div class="comp-header">Your Brand (${brandProducts.length})</div>
      <div class="comp-metric-value" style="color:#f87171">$${brandAvgPrice.toFixed(2)}</div>
      <div class="comp-metric-sub">Avg Price</div>
      <div class="comp-metric-value" style="color:#f87171">${brandAvgRating.toFixed(1)} &#9733;</div>
      <div class="comp-metric-sub">Avg Rating</div>
      <div class="comp-metric-value" style="color:#f87171">${fmt(Math.round(brandAvgReviews))}</div>
      <div class="comp-metric-sub">Avg Reviews</div>
      <div class="comp-metric-value" style="color:#f87171">${brandPrime}/${brandProducts.length}</div>
      <div class="comp-metric-sub">Prime Eligible</div>
    </div>
    <div class="comp-col vs-col">
      <div style="font-size:20px;font-weight:900;color:#475569;margin-bottom:16px;">VS</div>
      <div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Price</div>
      <div style="height:24px"></div>
      <div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Rating</div>
      <div style="height:24px"></div>
      <div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Reviews</div>
      <div style="height:24px"></div>
      <div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Prime</div>
    </div>
    <div class="comp-col competitor-col">
      <div class="comp-header">Competitors (${compProducts.length})</div>
      <div class="comp-metric-value" style="color:#34d399">$${compAvgPrice.toFixed(2)}</div>
      <div class="comp-metric-sub">Avg Price</div>
      <div class="comp-metric-value" style="color:#34d399">${compAvgRating.toFixed(1)} &#9733;</div>
      <div class="comp-metric-sub">Avg Rating</div>
      <div class="comp-metric-value" style="color:#34d399">${fmt(Math.round(compAvgReviews))}</div>
      <div class="comp-metric-sub">Avg Reviews</div>
      <div class="comp-metric-value" style="color:#34d399">${compPrime}/${compProducts.length}</div>
      <div class="comp-metric-sub">Prime Eligible</div>
    </div>
  </div>`;
}

function renderFindings(findings) {
  if (!findings || !findings.length) {
    return `<div class="finding-row warning"><div class="finding-icon">&#128269;</div><div class="finding-content"><div class="finding-label">Info</div><div class="finding-text">No significant findings. Manual review recommended.</div></div></div>`;
  }
  const icons = { issue: '&#10060;', opportunity: '&#9989;', warning: '&#9888;', competitor: '&#128101;' };
  const labels = { issue: 'Critical Issue', opportunity: 'Opportunity', warning: 'Warning', competitor: 'Competitor Threat' };
  return findings.slice(0, 4).map(f => {
    const type = f.type || 'warning';
    return `<div class="finding-row ${type}"><div class="finding-icon">${icons[type] || '&#128269;'}</div><div class="finding-content"><div class="finding-label">${labels[type] || 'Info'}</div><div class="finding-text">${f.text}</div></div></div>`;
  }).join('\n');
}

function renderBadges(product) {
  const badges = [];
  if (product.is_prime) badges.push('<span class="badge-sm badge-prime">PRIME</span>');
  if (product.is_amazons_choice) badges.push('<span class="badge-sm badge-choice">CHOICE</span>');
  if (product.best_seller) badges.push('<span class="badge-sm badge-bestseller">#1</span>');
  if (product.is_sponsored) badges.push('<span class="badge-sm badge-sponsored">AD</span>');
  if (product.notBrand) badges.push('<span class="badge-sm badge-notbrand">OTHER</span>');
  return badges.join(' ') || '<span style="color:#94a3b8;font-size:9px">&#8212;</span>';
}

function renderProductRows(products) {
  if (!products || !products.length) {
    return '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:14px">No product data available</td></tr>';
  }
  return products.slice(0, 6).map(p => {
    const pos = p.pos ? `<span class="pos-badge">#${p.pos}</span>` : '<span style="color:#cbd5e1">-</span>';
    const asin = p.asin ? `<span style="font-size:9px;color:#d4a54a;font-family:monospace">${p.asin}</span>` : '-';
    return `<tr${p.notBrand ? ' style="opacity:0.6"' : ''}>
      <td>${pos}</td>
      <td style="font-weight:500">${escapeHtml(truncate(p.title, 40))}</td>
      <td>${asin}</td>
      <td>$${(p.price || 0).toFixed(2)}</td>
      <td>${(p.rating || 0).toFixed(1)} &#9733;</td>
      <td>${fmt(p.reviews_count || 0)}</td>
      <td>${renderBadges(p)}</td>
    </tr>`;
  }).join('');
}

function renderActionPlan(data) {
  const actions = [];
  const buyBoxOwned = data.buyBoxIsTheBrand !== false;

  if (!buyBoxOwned) {
    actions.push({ title: 'Reclaim Buy Box Ownership', desc: 'Remove unauthorized sellers and establish the brand as the primary seller through FBA injection and MAP enforcement.', impact: 'Revenue Recovery' });
  }
  if (data.fbaStatus === 'FBM Only' || data.fbaStatus === 'Partial FBA') {
    actions.push({ title: 'Move Top SKUs to FBA', desc: `Convert ${data.fbaStatus === 'FBM Only' ? 'all products' : 'remaining FBM products'} to Fulfilled by Amazon through our Las Vegas hub for Prime eligibility.`, impact: '+30-50% Buy Box' });
  }
  if (parseInt(data.sellerCount || 0) > 3) {
    actions.push({ title: 'Clean Up Unauthorized Sellers', desc: `${data.sellerCount} sellers detected. Enforce brand authorization and MAP policy to stabilize pricing and protect margins.`, impact: 'Margin Protection' });
  }
  if (data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') {
    actions.push({ title: 'Launch Brand Defense PPC', desc: 'Start Sponsored Brand and Sponsored Product campaigns on brand terms to block competitor advertising on your search results.', impact: 'Traffic Protection' });
  }
  if (data.listingQuality === 'Weak/No A+' || data.listingQuality === 'Adequate') {
    actions.push({ title: 'Optimize Listing Content', desc: 'Upgrade product listings with A+ Content, enhanced images, and keyword-optimized copy to improve conversion rates.', impact: '+15-25% Conversion' });
  }
  if (actions.length === 0) {
    actions.push({ title: 'Maintain & Scale', desc: 'Your Amazon presence is strong. Focus on scaling through expanded catalog, new product launches, and advanced advertising strategies.', impact: 'Growth' });
  }

  return actions.slice(0, 4).map((a, i) =>
    `<div class="action-item"><div class="action-num">${i + 1}</div><div class="action-content"><div class="action-title">${a.title}</div><div class="action-desc">${a.desc}</div><div class="action-impact">${a.impact}</div></div></div>`
  ).join('\n');
}

function computeLosses(data) {
  const fbm = data.fbaStatus === 'FBM Only';
  const partialFba = data.fbaStatus === 'Partial FBA';
  const noPpc = data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated';
  const manySellers = parseInt(data.sellerCount || 0) > 3;
  const weakListings = data.listingQuality === 'Weak/No A+';
  const noBuyBox = data.buyBoxIsTheBrand === false;

  let buyBox = 'Low';
  if (noBuyBox) buyBox = 'Critical';
  else if (fbm && manySellers) buyBox = 'Critical';
  else if (fbm || manySellers) buyBox = 'High';
  else if (partialFba) buyBox = 'Medium';

  let visibility = 'Low';
  if (noPpc && weakListings) visibility = 'Critical';
  else if (noPpc || weakListings) visibility = 'High';
  else visibility = 'Medium';

  let conversion = 'Low';
  if (fbm && weakListings) conversion = 'Critical';
  else if (fbm || weakListings || manySellers) conversion = 'High';
  else if (partialFba) conversion = 'Medium';

  return { buyBox, visibility, conversion };
}

// ============================================================
// NORMALIZE AGENT OUTPUT → RENDERER FORMAT
// ============================================================

function normalizeAgentData(input) {
  // If already in renderer format (has brandName), pass through
  if (input.brandName) return input;

  // Agent format has report_data, seller_analysis, top_asins, etc.
  const rd = input.report_data || {};
  const sa = input.seller_analysis || {};
  const sections = rd.sections || {};
  const topAsins = input.top_asins || [];
  const bestProduct = topAsins[0] || {};
  const ps = parseInt(input.priority_score || 50);

  // Compute issue severity from priority score
  let issueSeverity = 'Low Impact';
  if (ps > 70) issueSeverity = 'High Impact';
  else if (ps > 40) issueSeverity = 'Medium Impact';

  // Map rating_stars_distribution [{rating,percentage}] → [{stars,percentage}]
  let ratingDist = rd.rating_stars_distribution || input.ratingDistribution || [];
  if (ratingDist.length && ratingDist[0].rating !== undefined && ratingDist[0].stars === undefined) {
    ratingDist = ratingDist.map(d => ({ stars: d.rating, percentage: d.percentage }));
  }

  return {
    brandName: rd.brand_name || input.brand_name || 'Unknown Brand',
    reportDate: rd.report_date || input.report_date || new Date().toISOString().split('T')[0],
    priorityScore: ps,
    brandMaturity: input.brand_maturity || 'Mixed',
    outreachApproach: input.outreach_approach || 'Operational',
    issueSeverity: issueSeverity,

    // Section statuses
    storefront: (sections.storefront || {}).status || 'Missing',
    fbaStatus: (sections.fulfillment || {}).status || 'FBM Only',
    listingQuality: (sections.listings || {}).status || 'Adequate',
    ppcStatus: (sections.advertising || {}).status || 'None',
    priceStability: (sections.pricing || {}).status || 'Stable',

    // Counts
    sellerCount: sa.total_sellers || rd.seller_count || 0,
    catalogSize: rd.catalog_size || rd.brand_product_count || 0,
    brandProductCount: rd.brand_product_count || rd.catalog_size || 0,
    totalResults: rd.total_results || 0,
    competitorCount: rd.competitor_count || 0,
    fbaPercent: rd.fba_percent || 0,
    avgRating: rd.avg_rating || '0.0',
    ppcCount: rd.ppc_count || 0,
    priceRange: rd.price_range || 'N/A',

    // Best product
    bestAsin: bestProduct.asin || '',
    bestAsinTitle: bestProduct.title || '',
    buyBoxSellerName: rd.buy_box_seller || sa.buy_box_holder || '',
    buyBoxIsTheBrand: rd.buy_box_is_brand !== undefined ? rd.buy_box_is_brand : true,
    buyBoxIsFba: rd.buy_box_is_fba !== undefined ? rd.buy_box_is_fba : false,
    buyBoxPrice: bestProduct.price || 0,
    pricingOfferCount: bestProduct.sellers || sa.total_sellers || 0,

    // BSR
    bsrSubcategory: bestProduct.bsr_sub || '',

    // Listing details
    listingHasVideo: rd.listing_has_video || false,
    listingImageCount: rd.listing_image_count || 0,
    listingBulletCount: rd.listing_bullet_count || 0,
    answeredQuestionsCount: rd.answered_questions || 0,
    onPageCompetitorCount: rd.on_page_competitor_count || parseInt(rd.competitor_count || 0),
    reviewHighlights: rd.review_highlights || '',

    // Rating distribution
    ratingDistribution: ratingDist,

    // Findings & products (pass through)
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
      pos: p.pos
    }))
  };
}

// ============================================================
// MAIN RENDER
// ============================================================

function renderHTML(data) {
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  const priority = parseInt(data.priorityScore || '50');
  const healthScore = Math.max(0, Math.min(100, 100 - priority));
  const healthClass = healthScore < 40 ? 'critical' : healthScore < 65 ? 'warning' : 'healthy';
  const healthLabel = healthScore < 30 ? 'Critical' : healthScore < 50 ? 'Needs Attention' : healthScore < 70 ? 'Fair' : healthScore < 85 ? 'Good' : 'Excellent';
  const losses = computeLosses(data);
  const sc = parseInt(data.sellerCount || 0);
  const sellerRisk = sc <= 1 ? 'Controlled' : sc <= 3 ? 'Low Risk' : sc <= 6 ? 'Moderate' : 'High Risk';
  const reportId = `PZ-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  // Buy Box fields
  const buyBoxOwned = data.buyBoxIsTheBrand !== false;
  const buyBoxPrice = parseFloat(data.buyBoxPrice || 0);
  const strikethrough = parseFloat(data.priceStrikethroughValue || 0);
  const discount = parseInt(data.discountPercentage || 0);
  const coupon = data.activeCoupon || '';

  const replacements = {
    '{{logoBase64}}': logoBase64,
    '{{brandName}}': escapeHtml(data.brandName || 'Unknown Brand'),
    '{{reportDate}}': data.reportDate || new Date().toISOString().split('T')[0],
    '{{reportId}}': reportId,

    '{{healthScore}}': String(healthScore),
    '{{healthScoreClass}}': healthClass,
    '{{healthScoreLabel}}': healthLabel,

    '{{brandMaturity}}': data.brandMaturity || 'N/A',
    '{{brandMaturityClass}}': statusToClass(data.brandMaturity),
    '{{issueSeverity}}': data.issueSeverity || 'N/A',
    '{{issueSeverityClass}}': statusToClass(data.issueSeverity),
    '{{brandProductCount}}': String(data.brandProductCount || data.catalogSize || '?'),
    '{{totalResults}}': String(data.totalResults || '?'),
    '{{competitorCount}}': String(data.competitorCount || '0'),
    '{{competitorClass}}': parseInt(data.competitorCount || 0) > 5 ? 's-red' : parseInt(data.competitorCount || 0) > 2 ? 's-yellow' : 's-green',

    // Metric cards
    '{{storefront}}': data.storefront || 'N/A',
    '{{storefrontColor}}': statusToCardColor(data.storefront),
    '{{storefrontClass}}': statusToClass(data.storefront),
    '{{catalogSize}}': String(data.catalogSize || 0),

    '{{fbaStatus}}': data.fbaStatus || 'N/A',
    '{{fbaColor}}': statusToCardColor(data.fbaStatus),
    '{{fbaClass}}': statusToClass(data.fbaStatus),
    '{{fbaPercent}}': String(data.fbaPercent || 0),
    '{{fbaDetail}}': data.fbaStatus === 'FBM Only' ? 'No Prime = lower Buy Box' : data.fbaStatus === 'Partial FBA' ? 'Some products lack Prime' : 'Strong FBA coverage',

    '{{listingQuality}}': data.listingQuality || 'N/A',
    '{{listingColor}}': statusToCardColor(data.listingQuality),
    '{{listingClass}}': statusToClass(data.listingQuality),
    '{{avgRating}}': String(data.avgRating || '0.0'),

    '{{ppcStatus}}': data.ppcStatus || 'N/A',
    '{{ppcColor}}': statusToCardColor(data.ppcStatus),
    '{{ppcClass}}': statusToClass(data.ppcStatus),
    '{{ppcCount}}': String(data.ppcCount || 0),
    '{{ppcDetail}}': data.ppcStatus === 'None' ? 'Competitors capturing traffic' : data.ppcStatus === 'Competitor Dominated' ? 'Others bidding on your terms' : 'Brand is running ads',

    '{{priceStability}}': data.priceStability || 'N/A',
    '{{priceColor}}': statusToCardColor(data.priceStability),
    '{{priceClass}}': statusToClass(data.priceStability),
    '{{priceRange}}': data.priceRange || 'N/A',

    '{{sellerCount}}': String(sc),
    '{{sellerColor}}': sc <= 3 ? 'green' : sc <= 6 ? 'yellow' : 'red',
    '{{sellerClass}}': sc <= 3 ? 's-green' : sc <= 6 ? 's-yellow' : 's-red',
    '{{sellerRisk}}': sellerRisk,

    // Losses
    '{{lostBuyBox}}': losses.buyBox,
    '{{lostVisibility}}': losses.visibility,
    '{{lostConversion}}': losses.conversion,

    // Page 1 generated sections
    '{{buyBoxAlert}}': renderBuyBoxAlert(data),
    '{{executiveSummary}}': renderExecutiveSummary(data),
    '{{searchOwnership}}': renderSearchOwnership(data),

    // Page 2: Deep dive
    '{{bestAsin}}': data.bestAsin || 'N/A',
    '{{bestAsinTitleTruncated}}': escapeHtml(truncate(data.bestAsinTitle || data.brandName + ' — Top Product', 90)),
    '{{bestAsinSalesVolume}}': data.topProducts && data.topProducts[0] ? (data.topProducts[0].sales_volume || '') : '',
    '{{dateFirstAvailable}}': data.dateFirstAvailable ? 'Listed ' + data.dateFirstAvailable : '',

    '{{buyBoxSellerName}}': escapeHtml(data.buyBoxSellerName || 'Unknown'),
    '{{buyBoxBrandClass}}': buyBoxOwned ? 'brand' : 'thirdparty',
    '{{buyBoxBrandLabel}}': buyBoxOwned ? 'Brand Owner &#10003;' : 'Third-Party &#10007;',
    '{{buyBoxFbaClass}}': data.buyBoxIsFba ? 'fba' : 'fbm',
    '{{buyBoxFbaLabel}}': data.buyBoxIsFba ? 'FBA &#10003;' : 'FBM',
    '{{buyBoxPrice}}': buyBoxPrice > 0 ? buyBoxPrice.toFixed(2) : 'N/A',
    '{{priceStrikethroughHtml}}': strikethrough > 0 ? `<span style="text-decoration:line-through;color:#475569;font-size:11px;margin-left:4px">$${strikethrough.toFixed(2)}</span>` : '',
    '{{discountBadgeHtml}}': discount > 0 ? `<span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.15);color:#34d399;margin-left:4px">-${discount}%</span>` : '',
    '{{couponHtml}}': coupon ? `<div class="dd-sub" style="color:#34d399;font-weight:600">Coupon: ${escapeHtml(coupon)}</div>` : '',
    '{{pricingOfferCount}}': String(data.pricingOfferCount || 1),

    '{{bsrSubcategory}}': data.bsrSubcategory || 'N/A',
    '{{bsrMainCategory}}': data.bsrMainCategory || '',

    '{{ratingDistribution}}': renderRatingDistribution(data),
    '{{listingHealthChecks}}': renderListingHealth(data),
    '{{onPageCompetitorCount}}': String(data.onPageCompetitorCount || 0),
    '{{reviewHighlights}}': escapeHtml(data.reviewHighlights || 'No review data available.'),

    '{{brandVsCompetitor}}': renderBrandVsCompetitor(data),
    '{{productRows}}': renderProductRows(data.topProducts),

    // Page 3
    '{{findings}}': renderFindings(data.findings),
    '{{actionPlan}}': renderActionPlan(data),
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
  const deckEnd = 1 + deckPageCount;           // cover=1, deck starts at 2
  const auditStart = deckEnd + 1;
  const auditEnd = auditStart + 2;             // 3 audit pages
  const replacements = {
    '{{logoBase64}}': logoBase64,
    '{{brandName}}': escapeHtml(data.brandName || 'Unknown Brand'),
    '{{reportDate}}': data.reportDate || new Date().toISOString().split('T')[0],
    '{{deckEndPage}}': String(deckEnd),
    '{{auditStartPage}}': String(auditStart),
    '{{auditEndPage}}': String(auditEnd),
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

  // Determine deck page count for cover TOC
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

  // Render cover page (no external resources, fast load)
  await page.setContent(coverHtml, { waitUntil: 'domcontentloaded' });
  const coverPdfBytes = await page.pdf({
    width: '1000px', height: '1414px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  // Render audit pages
  await page.setContent(auditHtml, { waitUntil: 'load', timeout: 15000 });
  const auditPdfBytes = await page.pdf({
    width: '1000px', height: '1414px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await browser.close();

  // Merge: Cover → Deck → Audit
  const merged = await PDFDocument.create();

  // 1. Cover page
  const coverDoc = await PDFDocument.load(coverPdfBytes);
  const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices());
  coverPages.forEach(p => merged.addPage(p));

  // 2. Deck pages — native sizes
  if (deckDoc) {
    try {
      const deckPages = await merged.copyPages(deckDoc, deckDoc.getPageIndices());
      deckPages.forEach(p => merged.addPage(p));
    } catch (e) {
      console.error('Could not merge deck PDF:', e.message);
    }
  }

  // 3. Audit pages
  const auditDoc = await PDFDocument.load(auditPdfBytes);
  const auditPages = await merged.copyPages(auditDoc, auditDoc.getPageIndices());
  auditPages.forEach(p => merged.addPage(p));

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
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Profitzon_Capital_Partner.pdf"');
    fs.createReadStream(deckPath).pipe(res);
  });

  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'profitzon-audit-renderer', version: 'v8-uniform' }));

  app.listen(port, () => {
    console.log(`Profitzon Audit Renderer v3 running on port ${port}`);
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

  // Demo: Nano Clear with Buy Box owned by third-party (showcases the alert)
  const sampleData = {
    brandName: "Nano Clear",
    reportDate: "2026-03-05",
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

    // Product scraper fields (demo: 3P seller owns Buy Box)
    bestAsin: "B0DQSK8Y52",
    bestAsinTitle: "Nano Clear Watch Crystal Scratch Remover Kit Complete — Professional Grade",
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

    findings: [
      { type: "issue", text: "Buy Box on your top product is controlled by ClearDealz LLC — a third-party seller, not Nano Clear. They are capturing your revenue from your best listing." },
      { type: "issue", text: "0% FBA coverage — all Nano Clear products ship FBM. No Prime badge means 30-50% lower Buy Box win rate." },
      { type: "issue", text: "8 different sellers detected on your ASINs. Multiple unauthorized resellers are eroding margins and causing price instability." },
      { type: "competitor", text: "14 competitor products appear when customers search Nano Clear — with no defensive PPC running." },
      { type: "warning", text: "7 competitor ads are running directly on your top product's page, stealing traffic from customers already viewing your listing." },
      { type: "opportunity", text: "Moving top SKUs to FBA + reclaiming the Buy Box + launching brand defense campaigns could lift visibility and conversion by 30-50%." }
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
  console.log('Demo report v3 saved to demo-report.html');

  // Also generate PDF if puppeteer available
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
