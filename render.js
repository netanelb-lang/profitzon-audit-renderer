/**
 * Profitzon Brand Audit Report Renderer v9.1-infographic
 * Clean corporate design: light grey bg, green strengths, red vulns, blue accents.
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
// GAUGE SVG (Speedometer — Nomatic style)
// ============================================================

function renderGaugeSVG(score) {
  const s = Math.max(0, Math.min(100, score));

  const label = s < 45 ? 'NEEDS WORK' : s < 60 ? 'FAIR' : s < 75 ? 'GOOD' : s < 88 ? 'STRONG' : 'EXCELLENT';

  // Half-circle arc gauge — large, centered
  const cx = 180, cy = 175, r = 150;

  function arcPath(startDeg, endDeg, radius) {
    const s1 = (startDeg * Math.PI) / 180;
    const e1 = (endDeg * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(s1);
    const y1 = cy + radius * Math.sin(s1);
    const x2 = cx + radius * Math.cos(e1);
    const y2 = cy + radius * Math.sin(e1);
    const large = (endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  }

  const segments = [
    { start: 180, end: 216, color: '#c62828' },
    { start: 216, end: 252, color: '#e65100' },
    { start: 252, end: 288, color: '#f57f17' },
    { start: 288, end: 324, color: '#f9a825' },
    { start: 324, end: 360, color: '#2e7d32' },
  ];

  let arcs = segments.map(seg =>
    `<path d="${arcPath(seg.start, seg.end, r)}" fill="none" stroke="${seg.color}" stroke-width="20" stroke-linecap="butt"/>`
  ).join('\n');

  const needleAngle = 180 + (s / 100) * 180;
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleLen = r - 25;
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy + needleLen * Math.sin(needleRad);

  return `<svg width="360" height="230" viewBox="0 0 360 230" xmlns="http://www.w3.org/2000/svg">
    <path d="${arcPath(180, 360, r)}" fill="none" stroke="#e0e0e0" stroke-width="24" stroke-linecap="butt"/>
    ${arcs}
    <circle cx="${cx}" cy="${cy}" r="8" fill="#1a2744"/>
    <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#1a2744" stroke-width="4" stroke-linecap="round"/>
    <text x="${cx}" y="${cy - 40}" text-anchor="middle" font-family="Inter, sans-serif" font-size="60" font-weight="900" fill="#1a1a1a">${s}<tspan font-size="26" fill="#999">/100</tspan></text>
    <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-family="Inter, sans-serif" font-size="20" font-weight="800" fill="#666" letter-spacing="3">${label}</text>
    <text x="${cx - r - 6}" y="${cy + 22}" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" fill="#999">0</text>
    <text x="${cx + r + 6}" y="${cy + 22}" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" fill="#999">100</text>
  </svg>`;
}

// ============================================================
// STRENGTH CARDS (Page 1 — Left column)
// ============================================================

function renderStrengthItems(data) {
  const items = [];
  const bp = parseInt(data.brandProductCount || 0);
  const tr = parseInt(data.totalResults || 1);
  const pct = Math.round((bp / tr) * 100);
  const fba = parseInt(data.fbaPercent || 0);
  const rating = parseFloat(data.avgRating || 0);

  // Item 1: Search dominance or product count
  if (pct >= 30) {
    items.push({ num: pct + '%', title: 'Brand Search Dominance', desc: `${bp} of ${tr} results are ${escapeHtml(data.brandName)} products` });
  } else {
    items.push({ num: bp.toString(), title: 'Products on Amazon', desc: 'Active listings in the brand catalog' });
  }

  // Item 2: Rating
  if (rating > 0) {
    items.push({ num: rating.toFixed(1) + '★', title: 'Average Customer Rating', desc: 'Across all brand products' });
  }

  // Item 3: Prime or Price
  if (fba >= 50) {
    items.push({ num: fba + '%', title: 'Prime FBA Coverage', desc: 'Products fulfilled by Amazon' });
  } else if (data.priceRange && data.priceRange !== 'N/A') {
    items.push({ num: escapeHtml(data.priceRange), title: data.priceStability === 'Stable' ? 'Stable Price Range' : 'Price Range', desc: 'Across the product catalog' });
  } else {
    items.push({ num: String(data.catalogSize || bp), title: 'SKU Catalog Size', desc: 'Total product variants' });
  }

  return items.map(i =>
    `<div class="sv-item"><div class="sv-num g">${i.num}</div><div class="sv-info"><div class="t">${i.title}</div><div class="d">${i.desc}</div></div></div>`
  ).join('\n');
}

// ============================================================
// VULNERABILITY CARDS (Page 1 — Right column)
// ============================================================

function renderVulnItems(data) {
  const items = [];
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);
  const bp = parseInt(data.brandProductCount || 0);

  // Vuln 1: Prime coverage
  if (fba < 50) {
    const fbaOf = bp > 0 ? Math.round(bp * fba / 100) : 0;
    items.push({ num: fba + '%', title: 'Prime Coverage Gap', desc: fbaOf > 0 ? `Only ${fbaOf} of ${bp} SKUs have FBA` : 'No FBA products detected' });
  }

  // Vuln 2: Competitor ads
  if (onPage >= 2) {
    items.push({ num: onPage.toString(), title: 'Competitor Ads on Brand Pages', desc: 'Active rival placements siphoning traffic' });
  } else if (sc > 3) {
    items.push({ num: sc.toString(), title: 'Unauthorized Sellers', desc: 'Price erosion and Buy Box competition' });
  }

  // Vuln 3: Listing quality / PPC / Storefront
  if (data.listingQuality === 'Weak/No A+' || data.listingQuality === 'Adequate') {
    items.push({ num: '!', title: 'Mixed Listing Maturity', desc: 'Suppressing algorithm visibility' });
  } else if (data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') {
    items.push({ num: '0', title: 'No Defensive Advertising', desc: 'Competitors bidding on your brand keywords' });
  } else if (data.storefront === 'Missing' || data.storefront === 'Exists - needs work') {
    items.push({ num: '!', title: 'Missing Brand Storefront', desc: 'Reducing conversion potential' });
  }

  if (items.length === 0) {
    items.push({ num: '—', title: 'Optimization Opportunities', desc: 'Room for operational improvement' });
  }

  return items.slice(0, 3).map(i =>
    `<div class="sv-item"><div class="sv-num r">${i.num}</div><div class="sv-info"><div class="t">${i.title}</div><div class="d">${i.desc}</div></div></div>`
  ).join('\n');
}

// ============================================================
// CALLOUT BOXES (Page 2 — Asset X-Ray)
// ============================================================

function getCallouts(data) {
  const imgs = parseInt(data.listingImageCount || 0);
  const hasVideo = data.listingHasVideo;
  const rating = parseFloat(data.avgRating || 0);
  const best = data.topProducts && data.topProducts[0];
  const reviews = best ? (best.reviews_count || 0) : 0;
  const fba = parseInt(data.fbaPercent || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);

  // Green callout 1: Content quality
  let c1Title, c1Desc;
  if (imgs >= 7 && hasVideo) {
    c1Title = `${imgs} High-Quality Images & Video`;
    c1Desc = 'Present';
  } else if (imgs >= 5) {
    c1Title = `${imgs} Product Images`;
    c1Desc = hasVideo ? 'Video present' : 'Missing product video';
  } else {
    c1Title = `${imgs} Images Listed`;
    c1Desc = 'Below optimal (7+ recommended)';
  }

  // Green callout 2: Rating
  let c2Title, c2Desc;
  if (rating >= 4.0) {
    c2Title = `Excellent ${rating.toFixed(1)} Rating`;
    c2Desc = `(${fmt(reviews)} Reviews)`;
  } else if (rating >= 3.5) {
    c2Title = `${rating.toFixed(1)} Star Rating`;
    c2Desc = `(${fmt(reviews)} Reviews)`;
  } else {
    c2Title = `${rating.toFixed(1)} Rating`;
    c2Desc = `Below 4.0 purchase threshold`;
  }

  // Red callout 3: Prime/fulfillment
  let c3Title, c3Desc;
  if (fba === 0) {
    c3Title = 'Missing Prime Badge:';
    c3Desc = 'Fulfilled by Merchant (FBM) status artificially lowering conversion.';
  } else if (fba < 50) {
    c3Title = 'Low Prime Coverage:';
    c3Desc = `Only ${fba}% of products FBA. Missing Prime on most listings reduces visibility.`;
  } else {
    c3Title = 'Partial Prime Coverage:';
    c3Desc = `${fba}% FBA — remaining products missing Prime filter eligibility.`;
  }

  // Red callout 4: Competition
  let c4Title, c4Desc;
  if (onPage >= 2) {
    c4Title = 'Competitor Intercept:';
    c4Desc = `${onPage} active rival ad placements blocking the Add to Cart path.`;
  } else if (data.ppcStatus === 'None') {
    c4Title = 'No Brand Defense:';
    c4Desc = 'Competitors can freely bid on your brand keywords with no counter-ads.';
  } else {
    c4Title = 'Market Exposure:';
    c4Desc = 'Competitor presence detected on brand search results.';
  }

  return { c1Title, c1Desc, c2Title, c2Desc, c3Title, c3Desc, c4Title, c4Desc };
}

// ============================================================
// CONNECTOR LINES SVG (Page 2)
// ============================================================

function renderConnectorLines() {
  // Simple blue lines from callout edges to screenshot center area
  return `
    <line x1="244" y1="100" x2="280" y2="180" stroke="#1a2744" stroke-width="2" opacity="0.4"/>
    <circle cx="244" cy="100" r="5" fill="#1a2744" stroke="#fff" stroke-width="2"/>
    <line x1="244" y1="440" x2="280" y2="380" stroke="#1a2744" stroke-width="2" opacity="0.4"/>
    <circle cx="244" cy="440" r="5" fill="#1a2744" stroke="#fff" stroke-width="2"/>
    <line x1="660" y1="100" x2="624" y2="180" stroke="#1a2744" stroke-width="2" opacity="0.4"/>
    <circle cx="660" cy="100" r="5" fill="#1a2744" stroke="#fff" stroke-width="2"/>
    <line x1="660" y1="440" x2="624" y2="380" stroke="#1a2744" stroke-width="2" opacity="0.4"/>
    <circle cx="660" cy="440" r="5" fill="#1a2744" stroke="#fff" stroke-width="2"/>
  `;
}

// ============================================================
// PRODUCT IMAGE (Page 2)
// ============================================================

function renderProductImage(data) {
  if (data.productImageUrl) {
    return `<img src="${escapeHtml(data.productImageUrl)}" alt="${escapeHtml(data.brandName)} product" style="max-width:100%;max-height:100%;object-fit:contain">`;
  }
  return `<div style="text-align:center;padding:40px;color:#999">
    <div style="font-size:60px;margin-bottom:16px">📦</div>
    <div style="font-size:18px;font-weight:700;color:#666;margin-bottom:6px">${escapeHtml(data.brandName || 'Product')}</div>
    ${data.bestAsin ? `<div style="font-size:12px;font-family:'IBM Plex Mono',monospace;color:#1a2744;margin-top:8px">${escapeHtml(data.bestAsin)}</div>` : ''}
  </div>`;
}

// ============================================================
// REVENUE LEAK CARDS (Page 3 — Left)
// ============================================================

function renderLeakCards(data) {
  const leaks = [];
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);
  const bp = parseInt(data.brandProductCount || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);

  if (fba < 50) {
    const missingCount = bp > 0 ? bp - Math.round(bp * fba / 100) : bp;
    const lowEst = fmt(Math.round(missingCount * 500));
    const highEst = fmt(Math.round(missingCount * 1200));
    leaks.push({
      title: 'Leak 1: The Prime Penalty',
      text: `${missingCount} of ${bp} catalog items missing FBA Prime badge, resulting in a 30-50% conversion drop.`,
      amount: `$${lowEst} - $${highEst} / month lost`
    });
  }

  if (onPage >= 2 || data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') {
    const adLoss = fmt(Math.round(onPage * 320));
    leaks.push({
      title: 'Leak 2: Search Siphoning',
      text: `${onPage} competitor placements on your brand page, diverting 10% of traffic to rivals.`,
      amount: `~$${adLoss} / month lost`
    });
  }

  if (sc > 3 && data.buyBoxIsTheBrand === false) {
    leaks.push({
      title: 'Leak 3: Buy Box Leakage',
      text: `${sc} sellers competing on your listings. Unauthorized resellers controlling Buy Box and capturing your revenue.`,
      amount: 'Revenue redirected to 3P sellers'
    });
  }

  if (leaks.length === 0) {
    leaks.push({
      title: 'Leak 1: Growth Ceiling',
      text: 'Current Amazon setup is leaving revenue on the table through sub-optimal operational execution.',
      amount: 'Significant upside available'
    });
  }

  return leaks.slice(0, 2).map((l, i) =>
    `<div class="lk">
      <div class="lk-icon">0${i + 1}</div>
      <div>
        <h4>${escapeHtml(l.title)}</h4>
        <p>${escapeHtml(l.text)}</p>
        <div class="lk-amt">${escapeHtml(l.amount)}</div>
      </div>
    </div>`
  ).join('\n');
}

// ============================================================
// GROWTH PLAN CARDS (Page 3 — Right)
// ============================================================

function renderActionCards(data) {
  const actions = [];
  const fba = parseInt(data.fbaPercent || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);
  const sc = parseInt(data.sellerCount || 0);

  if (fba < 50) {
    actions.push({
      title: 'Action 1: Prime Standardization',
      text: 'Inject all remaining SKUs through our Las Vegas FBA hub. Unlock access to 200M+ Prime filter users.',
      impact: '+30-50% Immediate Sales Lift'
    });
  }

  if (onPage >= 2 || data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') {
    actions.push({
      title: 'Action 2: Brand Defense Protocol',
      text: `Launch targeted search ads on your own branded keywords to systematically evict the ${onPage} competitors.`,
      impact: 'Reclaim Hijacked Traffic & Revenue'
    });
  }

  if (sc > 3) {
    actions.push({
      title: 'Action 3: Seller Map Cleanup',
      text: 'Enforce brand authorization and MAP pricing. Remove unauthorized resellers from your listings.',
      impact: 'Stabilize Pricing & Margins'
    });
  }

  if (data.listingQuality === 'Weak/No A+' || data.listingQuality === 'Adequate') {
    actions.push({
      title: 'Action: A+ Content & Storefront',
      text: 'Build premium A+ content, video, and brand storefront — all funded and executed by Profitzon.',
      impact: '+15-25% Conversion Lift'
    });
  }

  if (actions.length === 0) {
    actions.push({
      title: 'Action 1: Scale Revenue',
      text: 'Funded wholesale orders, new product launches, and advanced advertising — our capital, your brand.',
      impact: 'Accelerated Growth'
    });
  }

  return actions.slice(0, 2).map((a, i) =>
    `<div class="ak">
      <div class="ak-icon">0${i + 1}</div>
      <div>
        <h4>${escapeHtml(a.title)}</h4>
        <p>${escapeHtml(a.text)}</p>
        <div class="ak-imp">${escapeHtml(a.impact)}</div>
      </div>
    </div>`
  ).join('\n');
}

// ============================================================
// ARROWS SVG (Page 3 — between columns)
// ============================================================

function renderArrowsSVG(leakCount) {
  const n = Math.min(leakCount, 2);
  const arrows = [];
  for (let i = 0; i < n; i++) {
    arrows.push(`<svg width="36" height="36" viewBox="0 0 36 36" style="margin:8px 0">
      <polygon points="4,10 22,10 22,4 34,18 22,32 22,26 4,26" fill="#1a2744"/>
    </svg>`);
  }
  return arrows.join('\n');
}

// ============================================================
// EXECUTIVE SUMMARY BOX (Page 1)
// ============================================================

function renderExecutiveSummaryBox(data) {
  if (!data.opportunitySummary) return '';
  return `<div class="exec-bar">
    <div class="el">Key Insight</div>
    <div class="et">${escapeHtml(data.opportunitySummary)}</div>
  </div>`;
}

// ============================================================
// FINDINGS STRIP (Page 2 — between image and table)
// ============================================================

function renderFindingsStrip(data) {
  const findings = data.findings || [];
  if (!findings.length) {
    // Generate default findings from data
    const fba = parseInt(data.fbaPercent || 0);
    const onPage = parseInt(data.onPageCompetitorCount || 0);
    const defaults = [];
    if (fba < 50) defaults.push({ type: 'issue', text: `Only ${fba}% of products have FBA Prime badge — invisible to Prime-filter shoppers.` });
    if (onPage >= 2) defaults.push({ type: 'competitor', text: `${onPage} competitor ads detected on brand product pages, intercepting traffic.` });
    if (data.listingQuality === 'Weak/No A+' || data.listingQuality === 'Adequate') defaults.push({ type: 'warning', text: 'Listings lack A+ Enhanced Brand Content — suppressing conversion rates.' });
    if (data.ppcStatus === 'None') defaults.push({ type: 'opportunity', text: 'No defensive advertising detected — opportunity to reclaim branded search traffic.' });
    if (defaults.length === 0) defaults.push({ type: 'opportunity', text: 'Operational improvements available across fulfillment, advertising, and content.' });
    return renderFindingsStripHTML(defaults.slice(0, 3));
  }
  return renderFindingsStripHTML(findings.slice(0, 3));
}

function renderFindingsStripHTML(findings) {
  const typeLabels = { issue: 'Issue', opportunity: 'Opportunity', warning: 'Warning', competitor: 'Competitor' };
  const cards = findings.map(f => {
    const type = f.type || 'warning';
    return `<div class="p2-find ${type}"><div class="ft">${typeLabels[type] || 'Finding'}</div><div class="fd">${escapeHtml(f.text)}</div></div>`;
  });
  return `<div class="p2-findings">${cards.join('\n')}</div>`;
}

// ============================================================
// PRODUCT TABLE ROWS (Page 2)
// ============================================================

function renderBadges(product) {
  const badges = [];
  if (product.is_prime) badges.push('<span class="badge-sm badge-prime">PRIME</span>');
  if (product.is_amazons_choice) badges.push('<span class="badge-sm badge-choice">CHOICE</span>');
  if (product.is_sponsored) badges.push('<span class="badge-sm badge-sponsored">AD</span>');
  if (product.notBrand) badges.push('<span class="badge-sm badge-notbrand">OTHER</span>');
  return badges.join(' ') || '<span style="color:#ccc;font-size:9px">—</span>';
}

function renderProductRows(products) {
  if (!products || !products.length) {
    return '<tr><td colspan="7" style="text-align:center;color:#999;padding:14px">No product data available</td></tr>';
  }
  const valid = products.filter(p => p.price && p.price > 0);
  if (!valid.length) {
    return '<tr><td colspan="7" style="text-align:center;color:#999;padding:14px">No product data available</td></tr>';
  }
  return valid.slice(0, 5).map(p => {
    const pos = p.pos ? `<strong style="color:#1a2744">#${p.pos}</strong>` : '—';
    const asin = p.asin ? `<span style="font-size:10px;color:#1a2744;font-family:'IBM Plex Mono',monospace">${p.asin}</span>` : '—';
    return `<tr${p.notBrand ? ' style="opacity:0.5"' : ''}>
      <td>${pos}</td>
      <td style="font-weight:600">${escapeHtml(truncate(p.title, 35))}</td>
      <td>${asin}</td>
      <td>$${(p.price || 0).toFixed(2)}</td>
      <td>${(p.rating || 0).toFixed(1)} ★</td>
      <td>${fmt(p.reviews_count || 0)}</td>
      <td>${renderBadges(p)}</td>
    </tr>`;
  }).join('');
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
  const healthScore = Math.max(50, Math.min(88, Math.round(100 - priority * 0.55)));
  const reportId = `PZ-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  // Callouts for page 2
  const callouts = getCallouts(data);

  // Best product data for page 2
  const best = data.topProducts && data.topProducts[0];
  const bestPrice = best ? (best.price || 0).toFixed(2) : '0.00';
  const bestVolume = best ? (best.sales_volume || '~N/A') : '~N/A';
  const grossRunRate = best && best.price && best.monthly_sales
    ? '~$' + fmt(Math.round(best.price * parseInt(String(best.monthly_sales).replace(/[^0-9]/g, '') || 0)))
    : '~N/A';

  // Count leaks for arrow positioning
  const fba = parseInt(data.fbaPercent || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);
  let leakCount = 0;
  if (fba < 50) leakCount++;
  if (onPage >= 2 || data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') leakCount++;
  if (leakCount === 0) leakCount = 1;

  // Ownership percentage
  const bp = parseInt(data.brandProductCount || 0);
  const tr = parseInt(data.totalResults || 1);

  const replacements = {
    '{{brandName}}': escapeHtml(data.brandName || 'Unknown Brand'),
    '{{reportId}}': reportId,

    // Page 1
    '{{healthScore}}': String(healthScore),
    '{{gaugeSVG}}': renderGaugeSVG(healthScore),
    '{{strengthItems}}': renderStrengthItems(data),
    '{{vulnItems}}': renderVulnItems(data),
    '{{brandProductCount}}': String(bp || '?'),
    '{{fbaPercent}}': String(data.fbaPercent || 0),
    '{{avgRating}}': String(data.avgRating || '0.0'),
    '{{sellerCount}}': String(data.sellerCount || '0'),
    '{{competitorCount}}': String(data.competitorCount || 0),
    '{{ppcCount}}': String(data.ppcCount || 0),
    '{{executiveSummaryBox}}': renderExecutiveSummaryBox(data),

    // Page 2
    '{{bestAsinTitleShort}}': escapeHtml(truncate(data.bestAsinTitle || data.brandName + ' - Top Product', 40)),
    '{{bestAsin}}': escapeHtml(data.bestAsin || 'N/A'),
    '{{bestAsinPrice}}': bestPrice,
    '{{bestAsinSalesVolume}}': escapeHtml(bestVolume),
    '{{grossRunRate}}': escapeHtml(grossRunRate),
    '{{productImageHtml}}': renderProductImage(data),
    '{{callout1Title}}': escapeHtml(callouts.c1Title),
    '{{callout1Desc}}': escapeHtml(callouts.c1Desc),
    '{{callout2Title}}': escapeHtml(callouts.c2Title),
    '{{callout2Desc}}': escapeHtml(callouts.c2Desc),
    '{{callout3Title}}': escapeHtml(callouts.c3Title),
    '{{callout3Desc}}': escapeHtml(callouts.c3Desc),
    '{{callout4Title}}': escapeHtml(callouts.c4Title),
    '{{callout4Desc}}': escapeHtml(callouts.c4Desc),
    '{{findingsStrip}}': renderFindingsStrip(data),
    '{{productRows}}': renderProductRows(data.topProducts),

    // Page 3
    '{{leakCards}}': renderLeakCards(data),
    '{{actionCards}}': renderActionCards(data),
    '{{arrowsSVG}}': renderArrowsSVG(leakCount),
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

  await page.setContent(coverHtml, { waitUntil: 'domcontentloaded' });
  const coverPdfBytes = await page.pdf({
    width: '1000px', height: '1414px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await page.setContent(auditHtml, { waitUntil: 'load', timeout: 15000 });
  const auditPdfBytes = await page.pdf({
    width: '1000px', height: '1414px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await browser.close();

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
    console.log(`Profitzon Audit Renderer v9.1-infographic running on port ${port}`);
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
    brandName: "Nomatic",
    reportDate: "2026-03-24",
    priorityScore: "65",
    brandMaturity: "Strong",
    outreachApproach: "Operational",
    issueSeverity: "Medium Impact",
    storefront: "Exists - optimized",
    fbaStatus: "Partial FBA",
    listingQuality: "Adequate",
    ppcStatus: "None",
    priceStability: "Stable",
    sellerCount: 4,
    catalogSize: 16,
    brandProductCount: 16,
    totalResults: 16,
    competitorCount: 8,
    fbaPercent: 6,
    avgRating: "4.4",
    ppcCount: 0,
    priceRange: "$79 - $849",
    bestAsin: "B07782GG5T",
    bestAsinTitle: "Nomatic 20L Travel Pack",
    buyBoxSellerName: "Nomatic",
    buyBoxIsTheBrand: true,
    buyBoxIsFba: false,
    buyBoxPrice: 349.99,
    priceStrikethroughValue: 0,
    discountPercentage: 0,
    activeCoupon: "",
    pricingOfferCount: 2,
    bsrSubcategory: "#234 in Travel Backpacks",
    ratingDistribution: [
      { stars: 5, percentage: 62 },
      { stars: 4, percentage: 20 },
      { stars: 3, percentage: 8 },
      { stars: 2, percentage: 4 },
      { stars: 1, percentage: 6 }
    ],
    listingHasVideo: true,
    listingImageCount: 12,
    listingBulletCount: 5,
    answeredQuestionsCount: 45,
    dateFirstAvailable: "March 2018",
    onPageCompetitorCount: 11,
    reviewHighlights: "Customers love the organization and build quality. Some mention the bag runs small for the 20L claim.",
    productImageUrl: "",
    opportunitySummary: "Nomatic has strong brand equity and 100% search dominance, but only 6% Prime coverage (1 of 16 SKUs FBA) and 11 competitor ads on product pages. Moving to full FBA and launching brand defense ads could recover $13,500+/month in leaked revenue.",
    findings: [
      { type: "issue", text: "Only 1 of 16 SKUs has FBA Prime badge. 94% of the catalog is invisible to Prime-filter shoppers." },
      { type: "competitor", text: "11 competitor ads appear on Nomatic product pages, intercepting purchase-ready traffic." },
      { type: "warning", text: "Listings have adequate content but lack A+ Enhanced Brand Content on several products." }
    ],
    topProducts: [
      { title: "Nomatic 20L Travel Pack", price: 349.99, rating: 4.5, reviews_count: 964, is_prime: false, is_amazons_choice: false, best_seller: false, is_sponsored: false, asin: "B07782GG5T", pos: 1, sales_volume: "~100 units/mo", image_url: "" },
      { title: "Nomatic 40L Travel Bag", price: 359.99, rating: 4.3, reviews_count: 512, is_prime: false, is_amazons_choice: false, best_seller: false, is_sponsored: false, asin: "B077834ABC", pos: 2, sales_volume: "~60 units/mo" },
      { title: "Nomatic Navigator Backpack 15L", price: 199.99, rating: 4.6, reviews_count: 234, is_prime: true, is_amazons_choice: true, best_seller: false, is_sponsored: false, asin: "B09XYZ1234", pos: 3, sales_volume: "~80 units/mo" }
    ]
  };

  const html = renderHTML(sampleData);
  fs.writeFileSync(path.join(__dirname, 'demo-report.html'), html);
  console.log('Demo report v9.1-infographic saved to demo-report.html');

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
