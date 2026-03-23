/**
 * Profitzon Brand Audit Report Renderer v13.0-gemini
 * 4-page consulting aesthetic: Cover + Dashboard + Asset X-Ray + Revenue Leak/Growth Plan
 * Green (#228B22) for strengths, Red (#C41E3A) for vulnerabilities.
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
// PAGE 1: DASHBOARD - STRENGTH CARDS (green)
// ============================================================

function renderStrengthCards(data) {
  const cards = [];
  const bp = parseInt(data.brandProductCount || 0);
  const tr = parseInt(data.totalResults || 1);
  const pct = bp > 0 ? Math.round((bp / tr) * 100) : 0;
  const fba = parseInt(data.fbaPercent || 0);
  const rating = parseFloat(data.avgRating || 0);
  const best = data.topProducts && data.topProducts[0];
  const reviews = best ? (best.reviews_count || 0) : 0;

  // Card 1: Search Dominance or Rating
  if (pct >= 20) {
    cards.push({
      label: 'Search Dominance',
      val: pct + '%',
      sub: `${bp} of ${tr} results belong to ${escapeHtml(data.brandName)} — strong organic visibility`,
      metrics: [
        { val: String(bp), label: 'Brand SKUs' },
        { val: String(tr), label: 'Total Results' },
        { val: pct + '%', label: 'Share' }
      ]
    });
  }

  if (rating > 0) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.3;
    let starHtml = '';
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) starHtml += '<svg class="star" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" fill="#228B22"/></svg>';
      else if (i === fullStars && halfStar) starHtml += '<svg class="star" viewBox="0 0 24 24"><defs><linearGradient id="h"><stop offset="50%" stop-color="#228B22"/><stop offset="50%" stop-color="#d4d4d4"/></linearGradient></defs><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" fill="url(#h)"/></svg>';
      else starHtml += '<svg class="star" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" fill="#d4d4d4"/></svg>';
    }
    cards.push({
      label: 'Customer Rating',
      val: rating.toFixed(1),
      sub: `${fmt(reviews)} reviews — ${rating >= 4.0 ? 'above purchase decision threshold' : 'room to improve social proof'}`,
      extra: `<div class="stars">${starHtml}</div>`
    });
  }

  // Card 3: Price or FBA
  if (data.priceRange && data.priceRange !== 'N/A') {
    cards.push({
      label: 'Price Range',
      val: escapeHtml(data.priceRange),
      sub: fba >= 70 ? `${fba}% Prime coverage — strong fulfillment footprint` : 'Stable pricing mechanics across catalog'
    });
  } else if (fba >= 50) {
    cards.push({
      label: 'Prime Coverage',
      val: fba + '%',
      sub: 'Strong fulfillment presence driving conversions'
    });
  }

  if (cards.length === 0) {
    cards.push({ label: 'Brand Presence', val: 'Active', sub: 'Listed and discoverable on Amazon marketplace' });
  }

  return cards.slice(0, 3).map(c => {
    let metricsHtml = '';
    if (c.metrics) {
      metricsHtml = `<div class="mini-metrics">${c.metrics.map(m => `<div class="mini-m"><div class="mini-m-val">${m.val}</div><div class="mini-m-label">${m.label}</div></div>`).join('')}</div>`;
    }
    return `<div class="dash-card green-card">
      <div class="dash-card-label">${c.label}</div>
      <div class="dash-card-val green-text">${c.val}</div>
      ${c.extra || ''}
      <div class="dash-card-sub">${c.sub}</div>
      ${metricsHtml}
    </div>`;
  }).join('\n');
}

// ============================================================
// PAGE 1: DASHBOARD - VULNERABILITY CARDS (red)
// ============================================================

function renderVulnCards(data) {
  const cards = [];
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);

  if (fba < 50) {
    cards.push({
      label: 'Prime Coverage',
      val: fba + '%',
      sub: `Products without Prime are invisible to 200M+ Prime shoppers. ${fba === 0 ? 'Zero FBA coverage detected.' : 'Majority of catalog missing Prime badge.'}`
    });
  }

  if (onPage >= 2) {
    cards.push({
      label: 'Competitor Ads on Page',
      val: String(onPage),
      sub: 'Rival brands bidding on your product pages — every click is revenue walking away'
    });
  }

  if (sc > 3) {
    cards.push({
      label: 'Unauthorized Sellers',
      val: String(sc),
      sub: 'Multiple sellers competing on your ASINs, undercutting prices and destroying margins'
    });
  }

  if (data.listingQuality === 'Weak/No A+' || data.listingQuality === 'Adequate') {
    cards.push({
      label: 'Listing Maturity',
      val: data.listingQuality === 'Weak/No A+' ? 'Weak' : 'Mixed',
      icon: '&#9888;',
      sub: 'Missing A+ content, optimized images, or video — suppressing conversion rate and algorithm visibility'
    });
  }

  if (data.buyBoxIsTheBrand === false) {
    cards.push({
      label: 'Buy Box Control',
      val: 'Lost',
      icon: '&#9888;',
      sub: `${escapeHtml(data.buyBoxSellerName || 'Third party')} controls the primary purchase button on your top listing`
    });
  }

  if (cards.length === 0) {
    cards.push({ label: 'Minor Gaps', val: 'Low', sub: 'No critical vulnerabilities — room for strategic optimization' });
  }

  return cards.slice(0, 3).map(c =>
    `<div class="dash-card red-card">
      ${c.icon ? `<div class="dash-card-icon">${c.icon}</div>` : ''}
      <div class="dash-card-label">${c.label}</div>
      <div class="dash-card-val red-text">${c.val}</div>
      <div class="dash-card-sub">${c.sub}</div>
    </div>`
  ).join('\n');
}

// ============================================================
// PAGE 1: HEALTH GAUGE BAR
// ============================================================

function renderGaugeBar(score) {
  const s = Math.max(0, Math.min(100, score));
  const label = s < 40 ? 'NEEDS WORK' : s < 55 ? 'FAIR' : s < 70 ? 'GOOD' : s < 85 ? 'STRONG' : 'EXCELLENT';
  const color = s < 40 ? '#C41E3A' : s < 55 ? '#f5a623' : s < 70 ? '#f5a623' : '#228B22';
  return `<div class="gauge-top">
    <div class="gauge-title">Amazon Health Score</div>
    <div><span class="gauge-score">${s}</span><span class="gauge-label" style="color:${color}">${label}</span></div>
  </div>
  <div class="gauge-bar"><div class="gauge-fill" style="width:${s}%;background:${color}"></div></div>
  <div class="gauge-legend"><span>0 — Critical</span><span>50 — Fair</span><span>100 — Excellent</span></div>`;
}

// ============================================================
// PAGE 2: LEFT CALLOUTS (green = strengths)
// ============================================================

function renderLeftCallouts(data) {
  const callouts = [];
  const imgs = parseInt(data.listingImageCount || 0);
  const hasVideo = data.listingHasVideo;
  const rating = parseFloat(data.avgRating || 0);
  const reviews = data.topProducts && data.topProducts[0] ? (data.topProducts[0].reviews_count || 0) : 0;

  if (imgs >= 5 || hasVideo) {
    callouts.push({
      icon: '&#10003;',
      title: `${imgs} ${hasVideo ? 'Images + Video' : 'High-Quality Images'}`,
      desc: hasVideo ? 'Rich listing content with video present' : 'Strong visual content on primary listing'
    });
  }

  if (rating >= 3.5) {
    callouts.push({
      icon: '&#9733;',
      title: `${rating.toFixed(1)} Rating (${fmt(reviews)} Reviews)`,
      desc: rating >= 4.0 ? 'Above purchase decision threshold' : 'Solid social proof with room to grow'
    });
  }

  if (data.buyBoxIsTheBrand !== false) {
    callouts.push({
      icon: '&#10003;',
      title: 'Buy Box Controlled',
      desc: 'Brand holds the primary purchase button'
    });
  }

  if (callouts.length === 0) {
    callouts.push({ icon: '&#10003;', title: 'Brand Listed', desc: 'Product is live and discoverable' });
  }

  return callouts.slice(0, 2).map(c =>
    `<div class="callout green-c">
      <div class="callout-connector"></div>
      <div class="callout-icon">${c.icon}</div>
      <div class="callout-title green-text">${c.title}</div>
      <div class="callout-desc">${c.desc}</div>
    </div>`
  ).join('\n');
}

// ============================================================
// PAGE 2: RIGHT CALLOUTS (red = vulnerabilities)
// ============================================================

function renderRightCallouts(data) {
  const callouts = [];
  const fba = parseInt(data.fbaPercent || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);
  const sc = parseInt(data.sellerCount || 0);

  if (fba < 50) {
    callouts.push({
      icon: '&#9888;',
      title: fba === 0 ? 'Missing Prime Badge' : `Only ${fba}% Prime`,
      desc: 'FBM status — invisible to 200M+ Prime shoppers'
    });
  }

  if (onPage >= 2) {
    callouts.push({
      icon: '&#9763;',
      title: `${onPage} Competitor Ads`,
      desc: 'Rivals intercepting traffic on your product page'
    });
  }

  if (data.buyBoxIsTheBrand === false) {
    callouts.push({
      icon: '&#9888;',
      title: 'Buy Box Lost',
      desc: `${escapeHtml(data.buyBoxSellerName || 'Third party')} controls the sale`
    });
  }

  if (sc > 3) {
    callouts.push({
      icon: '&#9888;',
      title: `${sc} Unauthorized Sellers`,
      desc: 'Price competition eroding margins'
    });
  }

  if (callouts.length === 0) {
    callouts.push({ icon: '&#8226;', title: 'Minor Gaps', desc: 'No critical issues on this listing' });
  }

  return callouts.slice(0, 2).map(c =>
    `<div class="callout red-c">
      <div class="callout-connector"></div>
      <div class="callout-icon">${c.icon}</div>
      <div class="callout-title red-text">${c.title}</div>
      <div class="callout-desc">${c.desc}</div>
    </div>`
  ).join('\n');
}

// ============================================================
// PAGE 2: ASSESSMENT CARDS (compact grid)
// ============================================================

function renderAssessmentCards(data) {
  const cards = [];
  const imgs = parseInt(data.listingImageCount || 0);
  const hasVideo = data.listingHasVideo;
  const rating = parseFloat(data.avgRating || 0);
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);

  const contentScore = (hasVideo && imgs >= 7) ? 90 : (imgs >= 5) ? 60 : 30;
  cards.push({ cat: 'Content', val: `${imgs} Images${hasVideo ? ' + Video' : ''}`, badge: contentScore >= 80 ? 'strong' : contentScore >= 50 ? 'ok' : 'needs', label: contentScore >= 80 ? 'Strong' : contentScore >= 50 ? 'OK' : 'Weak', pct: contentScore });

  const ratingScore = rating >= 4.0 ? 85 : rating >= 3.5 ? 60 : 30;
  cards.push({ cat: 'Rating', val: `${rating.toFixed(1)} ★`, badge: ratingScore >= 80 ? 'strong' : ratingScore >= 50 ? 'ok' : 'needs', label: ratingScore >= 80 ? 'Strong' : ratingScore >= 50 ? 'OK' : 'Low', pct: ratingScore });

  const bbOwned = data.buyBoxIsTheBrand !== false;
  cards.push({ cat: 'Buy Box', val: bbOwned ? 'Brand' : 'Lost', badge: bbOwned ? 'strong' : 'needs', label: bbOwned ? 'Owned' : 'Lost', pct: bbOwned ? 90 : 15 });

  const fbaScore = fba >= 90 ? 95 : fba >= 70 ? 75 : fba >= 40 ? 50 : 20;
  cards.push({ cat: 'FBA', val: fba + '% Prime', badge: fbaScore >= 80 ? 'strong' : fbaScore >= 50 ? 'ok' : 'needs', label: fbaScore >= 80 ? 'Strong' : fbaScore >= 50 ? 'Partial' : 'Weak', pct: fbaScore });

  const compScore = onPage === 0 ? 90 : onPage <= 2 ? 65 : 25;
  cards.push({ cat: 'Ad Defense', val: onPage > 0 ? `${onPage} Rival Ads` : 'Clean', badge: compScore >= 80 ? 'strong' : compScore >= 50 ? 'ok' : 'needs', label: compScore >= 80 ? 'Clean' : compScore >= 50 ? 'Moderate' : 'At Risk', pct: compScore });

  const sellerScore = sc <= 1 ? 95 : sc <= 3 ? 70 : sc <= 6 ? 40 : 15;
  cards.push({ cat: 'Sellers', val: `${sc} Active`, badge: sellerScore >= 70 ? 'strong' : sellerScore >= 40 ? 'ok' : 'needs', label: sellerScore >= 70 ? 'Clean' : sellerScore >= 40 ? 'Crowded' : 'Chaotic', pct: sellerScore });

  return cards.map(c => {
    const barColor = c.badge === 'strong' ? 'green' : c.badge === 'needs' ? 'red' : 'gold';
    return `<div class="xa">
      <div class="xa-top"><div class="xa-cat">${c.cat}</div><div class="xa-badge ${c.badge}">${c.label}</div></div>
      <div class="xa-val">${c.val}</div>
      <div class="xa-bar"><div class="xa-fill ${barColor}" style="width:${c.pct}%"></div></div>
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
// PAGE 3: LEAK CARDS (quantified losses)
// ============================================================

function renderLeakCards(data) {
  const leaks = [];
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);
  const best = data.topProducts && data.topProducts[0];
  const bestPrice = best ? parseFloat(best.price || 0) : 0;
  const monthlySales = best ? parseInt(best.monthly_sales || best.sales_volume || 0) : 0;

  // Calculate estimated losses
  if (fba < 50) {
    const monthlyRev = monthlySales > 0 && bestPrice > 0 ? monthlySales * bestPrice : 0;
    const lostLow = monthlyRev > 0 ? Math.round(monthlyRev * 0.3) : 10000;
    const lostHigh = monthlyRev > 0 ? Math.round(monthlyRev * 0.5) : 17000;
    leaks.push({
      num: 'Leak 1',
      title: 'The Prime Penalty',
      amount: `$${fmt(lostLow)}–$${fmt(lostHigh)}/mo`,
      desc: `Only ${fba}% Prime coverage. Products without the Prime badge see 30-50% lower conversion rates. ${fba === 0 ? 'Your entire catalog is invisible to Prime-first shoppers.' : 'Most of your catalog is missing the Prime badge.'}`
    });
  }

  if (onPage >= 2) {
    const adLoss = monthlySales > 0 && bestPrice > 0 ? Math.round(monthlySales * bestPrice * 0.1 * (onPage / 5)) : 3500;
    leaks.push({
      num: 'Leak 2',
      title: 'Search Siphoning',
      amount: `~$${fmt(adLoss)}/mo`,
      desc: `${onPage} competitor ads on your product pages. Every click on a rival ad is revenue walking away. No brand defense campaigns running.`
    });
  }

  if (sc > 3) {
    leaks.push({
      num: leaks.length === 0 ? 'Leak 1' : `Leak ${leaks.length + 1}`,
      title: 'Seller Chaos',
      amount: `${sc} Sellers`,
      desc: `${sc} unauthorized sellers competing on your ASINs, triggering a price race to the bottom. Margin erosion and brand inconsistency.`
    });
  }

  if (data.buyBoxIsTheBrand === false && !leaks.find(l => l.title.includes('Prime'))) {
    leaks.push({
      num: leaks.length === 0 ? 'Leak 1' : `Leak ${leaks.length + 1}`,
      title: 'Buy Box Revenue Drain',
      amount: 'Lost',
      desc: `${escapeHtml(data.buyBoxSellerName || 'A third-party seller')} controls the Buy Box on your top product. They capture revenue from your brand equity.`
    });
  }

  if (leaks.length === 0) {
    leaks.push({
      num: 'Leak 1',
      title: 'Scale Bottleneck',
      amount: 'Moderate',
      desc: 'No critical leaks detected, but growth is capped without funded advertising, expanded catalog, and optimized content.'
    });
  }

  return leaks.slice(0, 3).map(l =>
    `<div class="leak-card">
      <div class="leak-card-num">${l.num}</div>
      <div class="leak-card-title">${escapeHtml(l.title)}</div>
      <div class="leak-card-amount">${l.amount}</div>
      <div class="leak-card-desc">${escapeHtml(l.desc)}</div>
    </div>`
  ).join('\n');
}

// ============================================================
// PAGE 3: PLAN CARDS (growth actions)
// ============================================================

function renderPlanCards(data) {
  const plans = [];
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);
  const onPage = parseInt(data.onPageCompetitorCount || 0);

  if (fba < 70) {
    plans.push({
      num: 'Action 1',
      title: 'Prime Standardization',
      impact: '+30–50% Sales Lift',
      desc: `Ship ${fba === 0 ? 'entire catalog' : 'remaining SKUs'} through our Las Vegas FBA hub. Prime badge = higher Buy Box win rate, faster delivery, and 200M+ Prime shoppers unlocked.`
    });
  }

  if (onPage >= 2 || data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') {
    plans.push({
      num: plans.length === 0 ? 'Action 1' : `Action ${plans.length + 1}`,
      title: 'Brand Defense Protocol',
      impact: 'Traffic Protection',
      desc: 'Launch Sponsored Brand + Display campaigns targeting your own product pages. Block competitor intercepts and recapture lost traffic.'
    });
  }

  if (sc > 3) {
    plans.push({
      num: plans.length === 0 ? 'Action 1' : `Action ${plans.length + 1}`,
      title: 'Seller Map Cleanup',
      impact: 'Margin Recovery',
      desc: `Remove ${sc - 1} unauthorized sellers. Enforce MAP pricing and brand authorization. Restore pricing power and margin integrity.`
    });
  }

  if (data.listingQuality === 'Weak/No A+' || data.listingQuality === 'Adequate') {
    plans.push({
      num: plans.length === 0 ? 'Action 1' : `Action ${plans.length + 1}`,
      title: 'A+ Content & Storefront Build',
      impact: '+15–25% Conversion',
      desc: 'Full A+ Enhanced Brand Content, premium images, video, and custom storefront — all funded by Profitzon.'
    });
  }

  if (plans.length === 0) {
    plans.push({
      num: 'Action 1',
      title: 'Funded Scale Program',
      impact: 'Revenue Growth',
      desc: 'Volume growth through funded wholesale purchasing, catalog expansion, and advanced advertising — zero investment from you.'
    });
  }

  return plans.slice(0, 3).map(p =>
    `<div class="plan-card">
      <div class="plan-card-num">${p.num}</div>
      <div class="plan-card-title">${escapeHtml(p.title)}</div>
      <div class="plan-card-impact">${escapeHtml(p.impact)}</div>
      <div class="plan-card-desc">${escapeHtml(p.desc)}</div>
    </div>`
  ).join('\n');
}

// ============================================================
// PAGE 3: EXPECTED RESULTS
// ============================================================

function renderExpectedResults(data) {
  const lift = (data.expectedLift || {});
  const results = [
    { val: lift.buy_box || '≥90%', label: 'Buy Box Win' },
    { val: lift.cvr_lift || '+10-30%', label: 'Conv. Lift' },
    { val: lift.revenue_growth || '15-40%', label: 'Revenue Growth' },
    { val: lift.map_compliance || '≥95%', label: 'MAP Compliance' },
  ];
  return results.map(r =>
    `<div class="outcome"><div class="outcome-val">${escapeHtml(r.val)}</div><div class="outcome-label">${r.label}</div></div>`
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
  const healthScore = Math.max(50, Math.min(88, Math.round(100 - priority * 0.55)));
  const reportId = `PZ-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const best = data.topProducts && data.topProducts[0];
  const bestPrice = best ? parseFloat(best.price || 0) : 0;
  const bestTitle = data.bestAsinTitle || (best && best.title) || data.brandName + ' - Top Product';
  const salesVol = best ? (best.sales_volume || best.monthly_sales || '') : '';
  const monthlySales = best ? parseInt(best.monthly_sales || best.sales_volume || 0) : 0;
  const grossRunRate = monthlySales > 0 && bestPrice > 0
    ? '$' + fmt(Math.round(bestPrice * monthlySales * 12)) + '/yr'
    : 'N/A';

  const replacements = {
    '{{brandName}}': escapeHtml(data.brandName || 'Unknown Brand'),
    '{{reportDate}}': data.reportDate || new Date().toISOString().split('T')[0],
    '{{reportId}}': reportId,

    // Page 1: Dashboard
    '{{strengthCards}}': renderStrengthCards(data),
    '{{vulnCards}}': renderVulnCards(data),
    '{{gaugeBar}}': renderGaugeBar(healthScore),
    '{{opportunitySummary}}': escapeHtml(data.opportunitySummary || 'This brand has significant untapped potential on Amazon. Strategic intervention in fulfillment, content, and advertising can unlock substantial revenue growth.'),

    // Page 2: Asset X-Ray
    '{{bestAsinTitleShort}}': escapeHtml(truncate(bestTitle, 50)),
    '{{bestAsin}}': data.bestAsin || 'N/A',
    '{{bestAsinSalesVolume}}': String(salesVol || 'N/A'),
    '{{bestAsinPrice}}': bestPrice > 0 ? bestPrice.toFixed(2) : 'N/A',
    '{{grossRunRate}}': grossRunRate,
    '{{productImageHtml}}': renderProductImage(data),
    '{{leftCallouts}}': renderLeftCallouts(data),
    '{{rightCallouts}}': renderRightCallouts(data),
    '{{assessmentCards}}': renderAssessmentCards(data),
    '{{priceRange}}': escapeHtml(data.priceRange || 'N/A'),
    '{{sellerCount}}': String(data.sellerCount || '0'),
    '{{competitorCount}}': String(data.competitorCount || 0),
    '{{catalogSize}}': String(data.catalogSize || 0),

    // Page 3: Revenue Leak & Growth Plan
    '{{leakCards}}': renderLeakCards(data),
    '{{planCards}}': renderPlanCards(data),
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

  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'profitzon-audit-renderer', version: 'v13.0-gemini' }));

  app.listen(port, () => {
    console.log(`Profitzon Audit Renderer v13.0-gemini running on port ${port}`);
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
    reportDate: "2026-03-23",
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
    reviewHighlights: "Customers praise the effectiveness on minor scratches and ease of use.",
    productImageUrl: "",
    opportunitySummary: "Nano Clear has 6 products on Amazon but zero Prime coverage, 8 unauthorized sellers, and a third-party controls the Buy Box on the top product. Moving to FBA, cleaning up sellers, and launching brand defense ads could recover 30-50% in lost revenue.",
    findings: [],
    topProducts: [
      { title: "Nano Clear Watch Crystal Scratch Remover Kit Complete", price: 49.99, rating: 4.2, reviews_count: 312, is_prime: false, monthly_sales: 200, asin: "B0DQSK8Y52", pos: 3, sales_volume: "200+ bought" },
      { title: "Nano Clear Watch Cleaner & Scratch Remover 2.1", price: 94.49, rating: 4.0, reviews_count: 86, is_prime: false, asin: "B0ABC12345", pos: 5, sales_volume: "100+ bought" }
    ]
  };

  const html = renderHTML(sampleData);
  fs.writeFileSync(path.join(__dirname, 'demo-report.html'), html);
  console.log('Demo report v13 saved to demo-report.html');

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
