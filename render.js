/**
 * Profitzon Brand Audit Report Renderer v8
 * Retro pixel + warm grey + gold + alarm mode. No blank space.
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
  const cx = 160, cy = 140;
  const radius = 110;
  const startAngle = 135;
  const totalSweep = 270;
  const scoreAngle = startAngle + (s / 100) * totalSweep;

  const toRad = (deg) => (deg * Math.PI) / 180;

  const arcPath = (sDeg, eDeg, r) => {
    const x1 = cx + r * Math.cos(toRad(sDeg));
    const y1 = cy + r * Math.sin(toRad(sDeg));
    const x2 = cx + r * Math.cos(toRad(eDeg));
    const y2 = cy + r * Math.sin(toRad(eDeg));
    const sweep = eDeg - sDeg;
    const largeArc = sweep > 180 ? 1 : 0;
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };

  let color = '#e05252';
  if (s >= 70) color = '#4ade80';
  else if (s >= 50) color = '#f5a623';
  else if (s >= 30) color = '#f97316';

  // Gradient ID unique per render
  const gradId = `gauge-grad-${s}`;

  const label = s < 45 ? 'Needs Work' : s < 60 ? 'Fair' : s < 75 ? 'Good' : s < 88 ? 'Strong' : 'Excellent';

  // Needle tip position
  const needleAngle = startAngle + (s / 100) * totalSweep;
  const needleLen = radius - 30;
  const nx = cx + needleLen * Math.cos(toRad(needleAngle));
  const ny = cy + needleLen * Math.sin(toRad(needleAngle));

  return `<svg width="320" height="200" viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#e05252"/>
        <stop offset="35%" stop-color="#f97316"/>
        <stop offset="55%" stop-color="#f5a623"/>
        <stop offset="75%" stop-color="#a3e635"/>
        <stop offset="100%" stop-color="#4ade80"/>
      </linearGradient>
    </defs>
    <!-- Background track -->
    <path d="${arcPath(startAngle, startAngle + totalSweep, radius)}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="22" stroke-linecap="butt"/>
    <!-- Colored fill with gradient -->
    ${s > 0 ? `<path d="${arcPath(startAngle, scoreAngle, radius)}" fill="none" stroke="url(#${gradId})" stroke-width="22" stroke-linecap="butt"/>` : ''}
    <!-- Needle -->
    <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="#fff"/>
    <circle cx="${cx}" cy="${cy}" r="3" fill="#f5a623"/>
    <!-- Score text -->
    <text x="${cx}" y="${cy + 36}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="56" font-weight="900" fill="#fff">${s}</text>
    <text x="${cx + 28}" y="${cy + 24}" text-anchor="start" font-family="Inter, -apple-system, sans-serif" font-size="18" fill="#737373" font-weight="600">/100</text>
    <text x="${cx}" y="${cy + 56}" text-anchor="middle" font-family="'Press Start 2P', monospace" font-size="10" fill="${color}" font-weight="800" letter-spacing="2">${label.toUpperCase()}</text>
  </svg>`;
}

// ============================================================
// STRENGTHS & VULNERABILITIES (Page 1)
// ============================================================

function renderStrengths(data) {
  const items = [];
  const bp = parseInt(data.brandProductCount || 0);
  const tr = parseInt(data.totalResults || 1);
  const pct = Math.round((bp / tr) * 100);
  const fba = parseInt(data.fbaPercent || 0);
  const rating = parseFloat(data.avgRating || 0);
  const sc = parseInt(data.sellerCount || 0);

  if (data.storefront === 'Exists') {
    items.push('Active Amazon storefront with <strong>' + bp + ' branded products</strong> listed.');
  }
  if (pct >= 50) {
    items.push('<strong>' + pct + '% search dominance</strong> when customers search your brand name.');
  }
  if (fba >= 70) {
    items.push('<strong>' + fba + '% Prime coverage</strong> across your catalog.');
  }
  if (rating >= 4.0) {
    items.push('Strong <strong>' + rating.toFixed(1) + '-star average rating</strong> across products.');
  }
  if (data.buyBoxIsTheBrand !== false) {
    items.push('You <strong>control the Buy Box</strong> on your top product.');
  }
  if (sc <= 2 && sc >= 1) {
    items.push('Clean seller map with only <strong>' + sc + ' seller(s)</strong>.');
  }
  if (data.listingQuality === 'Strong' || data.listingQuality === 'Active') {
    items.push('Product pages have <strong>quality content</strong> (images, video, bullets).');
  }
  if (data.priceStability === 'Stable') {
    items.push('<strong>Stable pricing</strong> with no MAP violations detected.');
  }

  if (items.length === 0) {
    items.push('Your brand is present on Amazon with products listed.');
  }

  return items.slice(0, 4).map(text =>
    `<div class="si g"><div class="si-ic">&#10003;</div><div class="si-tx">${text}</div></div>`
  ).join('\n');
}

function renderVulnerabilities(data) {
  const items = [];
  const bp = parseInt(data.brandProductCount || 0);
  const tr = parseInt(data.totalResults || 1);
  const pct = Math.round((bp / tr) * 100);
  const fba = parseInt(data.fbaPercent || 0);
  const sc = parseInt(data.sellerCount || 0);
  const rating = parseFloat(data.avgRating || 0);

  // Only flag Buy Box if many unauthorized sellers suggest it's not an authorized reseller
  if (data.buyBoxIsTheBrand === false && sc > 5) {
    items.push('<strong>Multiple unauthorized sellers</strong> detected — Buy Box may be held by a non-authorized reseller.');
  }
  if (fba < 30) {
    items.push('Only <strong>' + fba + '% Prime coverage</strong> - products without Prime sell 30-50% less.');
  } else if (fba < 70 && fba >= 30) {
    items.push('<strong>Partial Prime coverage</strong> at ' + fba + '% - missing sales on non-Prime products.');
  }
  if (sc > 3) {
    items.push('<strong>' + sc + ' unauthorized sellers</strong> competing on your products, undercutting your price.');
  }
  if (pct < 30) {
    items.push('Only <strong>' + pct + '% search ownership</strong> - competitors dominate your brand search results.');
  }
  if (data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') {
    items.push('<strong>No defensive advertising</strong> - competitors bid on your brand name and steal traffic.');
  }
  if (data.listingQuality === 'Weak/No A+' || data.listingQuality === 'Adequate') {
    items.push('<strong>Weak product pages</strong> - missing A+ content, video, or optimized images.');
  }
  if (data.storefront === 'Missing') {
    items.push('<strong>No Amazon storefront</strong> detected for your brand.');
  }
  if (data.priceStability === 'MAP Violated' || data.priceStability === 'Minor Fluctuation') {
    items.push('<strong>Price instability</strong> detected across your products (range: ' + escapeHtml(data.priceRange || 'N/A') + ').');
  }
  if (rating > 0 && rating < 3.5) {
    items.push('Average rating is <strong>' + rating.toFixed(1) + ' stars</strong> - below the 4.0 threshold that drives purchases.');
  }

  if (items.length === 0) {
    items.push('Minor optimization opportunities exist in your Amazon presence.');
  }

  return items.slice(0, 4).map(text =>
    `<div class="si r"><div class="si-ic">&#10007;</div><div class="si-tx">${text}</div></div>`
  ).join('\n');
}

// ============================================================
// EXECUTIVE SUMMARY BOX (Page 1)
// ============================================================

function renderExecutiveSummaryBox(data) {
  if (!data.opportunitySummary) return '';
  return `<div class="exec">
    <div class="exec-lbl">Key Insight</div>
    <div class="exec-tx">${escapeHtml(data.opportunitySummary)}</div>
  </div>`;
}

// ============================================================
// SEARCH OWNERSHIP BAR (Page 1)
// ============================================================

function renderOwnershipBar(data) {
  const bp = parseInt(data.brandProductCount || 0);
  const tr = parseInt(data.totalResults || 1);
  const pct = Math.round((bp / tr) * 100);
  const level = pct >= 60 ? 'Strong' : pct >= 30 ? 'Moderate' : 'Low';
  const desc = pct >= 60 ? 'Your brand dominates its own search results'
    : pct >= 30 ? 'Competitors take up most of your brand search results'
    : 'Most customers searching your name see competitor products first';
  return `<div class="own">
    <div class="own-pct">${pct}%</div>
    <div class="own-info"><div class="own-title">Brand Search Dominance: ${level}</div><div class="own-desc">${desc}</div></div>
    <div class="own-track"><div class="own-fill" style="width:${Math.max(pct, 3)}%"></div></div>
  </div>`;
}

// ============================================================
// EXTRA DETAIL (Page 2 - fills space when few products)
// ============================================================

function renderExtraDetail(data) {
  const products = data.topProducts || [];
  const validCount = products.filter(p => p.price && p.price > 0).length;

  // Always show extra detail to fill space
  const best = products[0] || {};
  const rows = [];

  if (data.bsrSubcategory) rows.push({ label: 'Category Ranking', value: data.bsrSubcategory });
  if (data.answeredQuestionsCount > 0) rows.push({ label: 'Questions Answered', value: String(data.answeredQuestionsCount) });
  if (data.listingImageCount > 0) rows.push({ label: 'Listing Images', value: String(data.listingImageCount) });
  if (data.listingBulletCount > 0) rows.push({ label: 'Bullet Points', value: String(data.listingBulletCount) });
  if (data.listingHasVideo) rows.push({ label: 'Video', value: 'Yes' });
  else rows.push({ label: 'Video', value: 'Missing' });
  if (data.discountPercentage > 0) rows.push({ label: 'Active Discount', value: data.discountPercentage + '% off' });
  if (data.activeCoupon) rows.push({ label: 'Active Coupon', value: escapeHtml(data.activeCoupon) });
  if (data.priceStrikethroughValue > 0) rows.push({ label: 'List Price', value: '$' + data.priceStrikethroughValue.toFixed(2) });
  if (best.monthly_sales) rows.push({ label: 'Est. Monthly Sales', value: escapeHtml(String(best.monthly_sales)) });
  if (best.bsr) rows.push({ label: 'Best Sellers Rank', value: '#' + fmt(best.bsr) });

  // If still not enough rows, add benchmark context
  if (rows.length < 4) {
    rows.push({ label: 'Prime Conversion Boost', value: '+30-50% vs FBM' });
    rows.push({ label: 'A+ Content Lift', value: '+5-15% conversion' });
    rows.push({ label: 'Video Impact', value: '+9.7% conversion avg' });
  }

  // Build two cards side by side
  const mid = Math.ceil(rows.length / 2);
  const left = rows.slice(0, mid);
  const right = rows.slice(mid);

  const buildCard = (title, items) => `<div class="ed-card">
    <div class="ed-title">${title}</div>
    ${items.map(r => `<div class="ed-row"><div class="ed-label">${r.label}</div><div class="ed-value">${r.value}</div></div>`).join('')}
  </div>`;

  return buildCard('Listing Intelligence', left) + buildCard('Performance Benchmarks', right);
}

// ============================================================
// BUY BOX + RATING + REVIEW CARDS (Page 2)
// ============================================================

function renderBuyBoxCard(data) {
  const seller = escapeHtml(data.buyBoxSellerName || 'Unknown');
  const owned = data.buyBoxIsTheBrand !== false;
  const badgeClass = owned ? 'brand' : 'third';
  const badgeText = owned ? 'Brand Owner' : 'Third Party';
  const fbaClass = data.buyBoxIsFba ? 'fba' : 'fbm';
  const fbaText = data.buyBoxIsFba ? 'FBA' : 'FBM';
  const price = parseFloat(data.buyBoxPrice || 0);
  const offers = parseInt(data.pricingOfferCount || 0);
  return `<div class="dc">
    <div class="dc-lbl">Buy Box Holder</div>
    <div class="dc-big">${price > 0 ? '$' + price.toFixed(2) : 'N/A'}</div>
    <div class="dc-sub">${seller}</div>
    <div class="dc-badges">
      <span class="dc-badge ${badgeClass}">${badgeText}</span>
      <span class="dc-badge ${fbaClass}">${fbaText}</span>
      ${offers > 1 ? `<span style="font-size:9px;color:#64748b">${offers} sellers competing</span>` : ''}
    </div>
  </div>`;
}

function renderRatingCard(data) {
  const dist = data.ratingDistribution;
  let barsHtml = '';
  if (dist && dist.length) {
    barsHtml = `<div class="rb">${dist.map(d => {
      const w = Math.max(d.percentage || 0, 1);
      const stars = d.stars || d.rating || 0;
      return `<div class="rb-row"><div class="rb-lbl">${stars}&#9733;</div><div class="rb-track"><div class="rb-fill r${stars}" style="width:${w}%"></div></div><div class="rb-pct">${d.percentage}%</div></div>`;
    }).join('')}</div>`;
  }
  return `<div class="dc">
    <div class="dc-lbl">Rating Distribution</div>
    <div class="dc-big">${data.avgRating || '0.0'} &#9733;</div>
    ${barsHtml}
  </div>`;
}

function renderReviewCard(data) {
  const text = data.reviewHighlights || 'No review data available.';
  return `<div class="dc dc-review">
    <div class="dc-lbl">What Customers Say</div>
    <div class="dc-review-text">"${escapeHtml(text)}"</div>
  </div>`;
}

// ============================================================
// PRODUCT IMAGE (Page 2)
// ============================================================

function renderProductImage(data) {
  if (data.productImageUrl) {
    return `<img src="${escapeHtml(data.productImageUrl)}" alt="${escapeHtml(data.brandName)} product">`;
  }
  return `<div class="product-image-placeholder">
    <div style="font-size:40px;margin-bottom:12px;color:#d4a54a;">&#128722;</div>
    <div>${escapeHtml(data.brandName || 'Product')}</div>
    ${data.bestAsin ? `<div class="asin-code">${escapeHtml(data.bestAsin)}</div>` : ''}
  </div>`;
}

// ============================================================
// CALLOUT BOXES (Page 2)
// ============================================================

function getCalloutContent(data) {
  const imgs = parseInt(data.listingImageCount || 0);
  const hasVideo = data.listingHasVideo;
  const bullets = parseInt(data.listingBulletCount || 0);

  let contentClass = 'good';
  let contentValue = 'Strong';
  let contentDetail = `${imgs} images, ${bullets} bullet points`;
  if (hasVideo) contentDetail += ', video';
  if (!hasVideo && imgs < 5) { contentClass = 'bad'; contentValue = 'Weak'; }
  else if (!hasVideo || imgs < 6) { contentClass = 'warn'; contentValue = 'Adequate'; }

  return { contentClass, contentValue, contentDetail };
}

function getCalloutRating(data) {
  const rating = parseFloat(data.avgRating || 0);
  const best = data.topProducts && data.topProducts[0];
  const reviews = best ? (best.reviews_count || 0) : 0;

  let ratingClass = 'good';
  let ratingDetail = fmt(reviews) + ' reviews on top product';
  if (rating < 3.5) { ratingClass = 'bad'; ratingDetail += ' - below purchase threshold'; }
  else if (rating < 4.0) { ratingClass = 'warn'; }

  return { ratingClass, ratingDetail };
}

function getCalloutFulfill(data) {
  const fba = parseInt(data.fbaPercent || 0);
  let fulfillClass = 'good';
  let fulfillValue = fba + '% Prime';
  let fulfillDetail = 'Strong fulfillment coverage';
  if (fba === 0) { fulfillClass = 'bad'; fulfillValue = 'FBM Only'; fulfillDetail = 'No Prime badge = 30-50% fewer sales'; }
  else if (fba < 70) { fulfillClass = 'warn'; fulfillValue = fba + '% Prime'; fulfillDetail = 'Partial coverage, missing sales on non-Prime'; }

  return { fulfillClass, fulfillValue, fulfillDetail };
}

function getCalloutComp(data) {
  const onPage = parseInt(data.onPageCompetitorCount || 0);
  const ppc = data.ppcStatus;
  let compClass = 'good';
  let compValue = onPage + ' ads';
  let compDetail = 'Competitor ads on your product page';
  if (onPage >= 5 || ppc === 'Competitor Dominated') { compClass = 'bad'; compDetail = 'Competitors heavily targeting your listings'; }
  else if (onPage >= 2 || ppc === 'None') { compClass = 'warn'; compDetail = 'Moderate competitor activity on your pages'; }
  else { compDetail = 'Low competitor presence on your pages'; }

  return { compClass, compValue, compDetail };
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
    leaks.push({ title: 'Weak Content', severity: 'Medium', text: 'Product pages lack A+ content, video, or optimized images. Visitors arrive but do not convert.' });
  }

  if (leaks.length === 0) {
    leaks.push({ title: 'Minor Friction', severity: 'Low', text: 'No critical leaks detected, but optimization opportunities exist to grow revenue further.' });
  }

  return leaks.slice(0, 3).map(l =>
    `<div class="lc">
      <div class="lc-hd">
        <div class="lc-ic">!</div>
        <div class="lc-title">${escapeHtml(l.title)}</div>
        <div class="lc-sev">${escapeHtml(l.severity)}</div>
      </div>
      <div class="lc-tx">${escapeHtml(l.text)}</div>
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
    plans.push({ title: 'Content Overhaul', impact: '+15-25% Conversion', text: 'Premium images, video, A+ content, and optimized bullets that turn browsers into buyers.' });
  }
  if (plans.length === 0) {
    plans.push({ title: 'Scale Revenue', impact: 'Growth', text: 'Your Amazon operation is strong. We focus on volume growth, new launches, and advanced advertising - all funded by us.' });
  }

  return plans.slice(0, 3).map((p, i) =>
    `<div class="pc">
      <div class="pc-hd">
        <div class="pc-ic">${i + 1}</div>
        <div class="pc-title">${escapeHtml(p.title)}</div>
        <div class="pc-imp">${escapeHtml(p.impact)}</div>
      </div>
      <div class="pc-tx">${escapeHtml(p.text)}</div>
    </div>`
  ).join('\n');
}

// ============================================================
// FINDINGS (Page 3)
// ============================================================

function renderFindings(findings) {
  if (!findings || !findings.length) {
    return `<div class="fr warning">
      <div class="fr-ic warning">i</div>
      <div><div class="fr-lbl warning">Info</div><div class="fr-tx">No significant findings. Manual review recommended.</div></div>
    </div>`;
  }
  const labels = { issue: 'Revenue at Risk', opportunity: 'Growth Opportunity', warning: 'Attention Needed', competitor: 'Competitive Pressure' };
  const icons = { issue: '!', opportunity: '+', warning: '!', competitor: 'C' };

  return findings.slice(0, 4).map(f => {
    const type = f.type || 'warning';
    return `<div class="fr ${type}">
      <div class="fr-ic ${type}">${icons[type] || 'i'}</div>
      <div><div class="fr-lbl ${type}">${labels[type] || 'Info'}</div><div class="fr-tx">${escapeHtml(f.text)}</div></div>
    </div>`;
  }).join('\n');
}

// ============================================================
// PRODUCT TABLE (Page 2)
// ============================================================

function renderBadges(product) {
  const badges = [];
  if (product.is_prime) badges.push('<span class="badge-sm badge-prime">PRIME</span>');
  if (product.is_amazons_choice) badges.push('<span class="badge-sm badge-choice">CHOICE</span>');
  if (product.best_seller) badges.push('<span class="badge-sm badge-bestseller">#1</span>');
  if (product.is_sponsored) badges.push('<span class="badge-sm badge-sponsored">AD</span>');
  if (product.notBrand) badges.push('<span class="badge-sm badge-notbrand">OTHER</span>');
  return badges.join(' ') || '<span style="color:#94a3b8;font-size:9px">-</span>';
}

function renderProductRows(products) {
  if (!products || !products.length) {
    return '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:14px">No product data available</td></tr>';
  }
  // Filter out ASINs with no price data - $0 or null means no useful data
  const valid = products.filter(p => p.price && p.price > 0);
  if (!valid.length) {
    return '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:14px">No product data available</td></tr>';
  }
  return valid.slice(0, 6).map(p => {
    const pos = p.pos ? `<span class="pos-badge">#${p.pos}</span>` : '<span style="color:#94a3b8">-</span>';
    const asin = p.asin ? `<span style="font-size:9px;color:#d4a54a;font-family:monospace">${p.asin}</span>` : '-';
    return `<tr${p.notBrand ? ' style="opacity:0.55"' : ''}>
      <td>${pos}</td>
      <td style="font-weight:500">${escapeHtml(truncate(p.title, 38))}</td>
      <td>${asin}</td>
      <td>$${(p.price || 0).toFixed(2)}</td>
      <td>${(p.rating || 0).toFixed(1)} &#9733;</td>
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

  // Callout data
  const content = getCalloutContent(data);
  const rating = getCalloutRating(data);
  const fulfill = getCalloutFulfill(data);
  const comp = getCalloutComp(data);

  // Ownership percentage for KPI strip
  const bp = parseInt(data.brandProductCount || 0);
  const tr = parseInt(data.totalResults || 1);
  const ownershipPct = Math.round((bp / tr) * 100);

  // Map callout status to bento block color class
  const bgMap = { good: 'b-green', warn: 'b-gold', bad: 'b-red' };

  const replacements = {
    '{{logoBase64}}': logoBase64,
    '{{brandName}}': escapeHtml(data.brandName || 'Unknown Brand'),
    '{{reportDate}}': data.reportDate || new Date().toISOString().split('T')[0],
    '{{reportId}}': reportId,

    // Page 1: The Paradox
    '{{gaugeSVG}}': renderGaugeSVG(healthScore),
    '{{brandMaturity}}': data.brandMaturity || 'N/A',
    '{{brandProductCount}}': String(data.brandProductCount || data.catalogSize || '?'),
    '{{totalResults}}': String(data.totalResults || '?'),
    '{{sellerCount}}': String(data.sellerCount || '0'),
    '{{fbaPercent}}': String(data.fbaPercent || 0),
    '{{avgRating}}': String(data.avgRating || '0.0'),
    '{{ownershipPct}}': String(ownershipPct),
    '{{strengthsList}}': renderStrengths(data),
    '{{vulnerabilitiesList}}': renderVulnerabilities(data),
    '{{executiveSummaryBox}}': renderExecutiveSummaryBox(data),

    // Page 2: Asset X-Ray
    '{{bestAsin}}': data.bestAsin || 'N/A',
    '{{bestAsinTitleTruncated}}': escapeHtml(truncate(data.bestAsinTitle || data.brandName + ' - Top Product', 90)),
    '{{bestAsinSalesVolume}}': data.topProducts && data.topProducts[0] ? (data.topProducts[0].sales_volume || '') : '',
    '{{dateFirstAvailable}}': data.dateFirstAvailable ? 'Listed ' + data.dateFirstAvailable : '',
    '{{productImageHtml}}': renderProductImage(data),

    // Callout boxes - bento color blocks
    '{{calloutContentBg}}': bgMap[content.contentClass] || 'b-navy',
    '{{calloutContentValue}}': content.contentValue,
    '{{calloutContentDetail}}': content.contentDetail,
    '{{calloutRatingBg}}': bgMap[rating.ratingClass] || 'b-navy',
    '{{calloutRatingDetail}}': rating.ratingDetail,
    '{{calloutFulfillBg}}': bgMap[fulfill.fulfillClass] || 'b-navy',
    '{{calloutFulfillValue}}': fulfill.fulfillValue,
    '{{calloutFulfillDetail}}': fulfill.fulfillDetail,
    '{{calloutCompBg}}': bgMap[comp.compClass] || 'b-navy',
    '{{calloutCompValue}}': comp.compValue,
    '{{calloutCompDetail}}': comp.compDetail,

    // Buy Box / Rating / Review cards
    '{{buyBoxCard}}': renderBuyBoxCard(data),
    '{{ratingCard}}': renderRatingCard(data),
    '{{reviewCard}}': renderReviewCard(data),

    // Market snapshot strip
    '{{priceRange}}': escapeHtml(data.priceRange || 'N/A'),
    '{{ppcCount}}': String(data.ppcCount || 0),
    '{{competitorCount}}': String(data.competitorCount || 0),
    '{{catalogSize}}': String(data.catalogSize || 0),

    // Product table + extra detail
    '{{productRows}}': renderProductRows(data.topProducts),
    '{{extraDetail}}': renderExtraDetail(data),

    // Page 3: Cost of Friction
    '{{revenueLeak}}': renderRevenueLeak(data),
    '{{growthPlan}}': renderGrowthPlan(data),
    '{{findings}}': renderFindings(data.findings),
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

  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'profitzon-audit-renderer', version: 'v8.1-retro' }));

  app.listen(port, () => {
    console.log(`Profitzon Audit Renderer v8 running on port ${port}`);
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
