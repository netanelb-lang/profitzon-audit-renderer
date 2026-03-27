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

  // Half-circle arc gauge — fits landscape layout
  const cx = 220, cy = 210, r = 180;

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

  return `<svg width="440" height="400" viewBox="0 0 440 400" xmlns="http://www.w3.org/2000/svg">
    <path d="${arcPath(180, 360, r)}" fill="none" stroke="#e0e0e0" stroke-width="28" stroke-linecap="butt"/>
    ${arcs}
    <circle cx="${cx}" cy="${cy}" r="10" fill="#1a2744"/>
    <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#1a2744" stroke-width="5" stroke-linecap="round"/>
    <text x="${cx - r - 8}" y="${cy + 26}" text-anchor="middle" font-family="Inter, sans-serif" font-size="15" fill="#999">0</text>
    <text x="${cx + r + 8}" y="${cy + 26}" text-anchor="middle" font-family="Inter, sans-serif" font-size="15" fill="#999">100</text>
    <text x="${cx}" y="${cy + 100}" text-anchor="middle" font-family="Inter, sans-serif" font-size="72" font-weight="900" fill="#1a1a1a">${s}<tspan font-size="30" fill="#999">/100</tspan></text>
    <text x="${cx}" y="${cy + 132}" text-anchor="middle" font-family="Inter, sans-serif" font-size="22" font-weight="800" fill="#666" letter-spacing="4">${label}</text>
  </svg>`;
}

// ============================================================
// SVG ICONS (render in Puppeteer without emoji fonts)
// ============================================================

const SVG = {
  search: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>`,
  star: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>`,
  rocket: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
  dollar: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>`,
  box: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`,
  target: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>`,
  users: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`,
  store: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/></svg>`,
  trendUp: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M21 6h-3.17L16 4h-6v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5 9c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/><circle cx="12" cy="12" r="3.2"/></svg>`,
  noEntry: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg>`,
  hole: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  moneyOff: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12.5 6.9c1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-.53.12-1.03.3-1.48.54l1.47 1.47c.41-.17.91-.27 1.51-.27zM5.33 4.06L4.06 5.33 7.5 8.77c0 2.08 1.56 3.21 3.91 3.91l3.51 3.51c-.34.48-1.14.89-2.42.89-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c.96-.18 1.82-.55 2.45-1.12l2.22 2.22 1.27-1.27L5.33 4.06z"/></svg>`,
  trendDown: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z"/></svg>`,
  broom: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19.36 2.72l1.42 1.42-5.72 5.71c1.07 1.54 1.22 3.39.32 4.59L9.06 8.12c1.2-.9 3.05-.75 4.59.32l5.71-5.72zM5.93 17.57c-2.01-2.01-3.24-4.41-3.58-6.65l4.88-2.09 7.44 7.44-2.09 4.88c-2.24-.34-4.64-1.57-6.65-3.58z"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 3L9.66 9.66 3 12l6.66 2.34L12 21l2.34-6.66L21 12l-6.66-2.34z"/></svg>`,
};

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

  if (pct >= 30) {
    items.push({ icon: SVG.search, val: pct + '%', lbl: 'Brand Search Dominance' });
  } else {
    items.push({ icon: SVG.chart, val: bp + ' Products', lbl: 'Listed on Amazon' });
  }

  if (rating > 0) {
    items.push({ icon: SVG.star, val: rating.toFixed(1) + ' Average', lbl: 'Customer Rating' });
  }

  if (fba >= 50) {
    items.push({ icon: SVG.rocket, val: fba + '% Prime', lbl: 'FBA Coverage' });
  } else if (data.priceRange && data.priceRange !== 'N/A') {
    items.push({ icon: SVG.dollar, val: escapeHtml(data.priceRange), lbl: data.priceStability === 'Stable' ? 'Stable Pricing Mechanics' : 'Price Range' });
  } else {
    items.push({ icon: SVG.box, val: String(data.catalogSize || bp) + ' SKUs', lbl: 'Product Catalog' });
  }

  return items.map(i =>
    `<div class="sv-item"><div class="sv-icon g">${i.icon}</div><div class="sv-text"><div class="val">${i.val}</div><div class="lbl">${i.lbl}</div></div></div>`
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

  if (fba < 50) {
    const fbaOf = bp > 0 ? Math.round(bp * fba / 100) : 0;
    items.push({ icon: SVG.lock, val: `Only ${fba}% Prime Coverage`, lbl: `(${fbaOf} of ${bp} SKUs FBA)` });
  }

  if (onPage >= 2) {
    items.push({ icon: SVG.target, val: 'Competitor Ads on Top Product Pages', lbl: `(${onPage} Rivals Siphoning Traffic)` });
  } else if (sc > 3) {
    items.push({ icon: SVG.users, val: 'Unauthorized Sellers Competing', lbl: `(${sc} Sellers — Price Erosion Risk)` });
  }

  if (data.listingQuality === 'Weak/No A+' || data.listingQuality === 'Adequate') {
    items.push({ icon: SVG.edit, val: 'Mixed Listing Maturity', lbl: '(Suppressing Algorithm Visibility)' });
  } else if (data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') {
    items.push({ icon: SVG.shield, val: 'No Defensive Advertising', lbl: '(Competitors Bidding on Your Brand)' });
  } else if (data.storefront === 'Missing' || data.storefront === 'Exists - needs work') {
    items.push({ icon: SVG.store, val: 'Missing Brand Storefront', lbl: '(Reducing Conversion Potential)' });
  }

  if (items.length === 0) {
    items.push({ icon: SVG.trendUp, val: 'Optimization Opportunities', lbl: '(Room for Growth)' });
  }

  return items.slice(0, 3).map(i =>
    `<div class="sv-item"><div class="sv-icon r">${i.icon}</div><div class="sv-text"><div class="val">${i.val}</div><div class="lbl">${i.lbl}</div></div></div>`
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
    c1Title = `${imgs} Images & Video`;
    c1Desc = 'Rich media present';
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
    c2Title = `${rating.toFixed(1)} Rating`;
    c2Desc = `${fmt(reviews)} Reviews`;
  } else if (rating >= 3.5) {
    c2Title = `${rating.toFixed(1)} Star Rating`;
    c2Desc = `${fmt(reviews)} Reviews`;
  } else {
    c2Title = `${rating.toFixed(1)} Rating`;
    c2Desc = `Below 4.0 purchase threshold`;
  }

  // Red callout 3: Prime/fulfillment
  let c3Title, c3Desc;
  if (fba === 0) {
    c3Title = 'Missing Prime Badge';
    c3Desc = 'FBM status lowering conversion rate.';
  } else if (fba < 50) {
    c3Title = `Only ${fba}% Prime`;
    c3Desc = `Most listings missing Prime filter visibility.`;
  } else {
    c3Title = `${fba}% Prime Coverage`;
    c3Desc = `Remaining products missing Prime eligibility.`;
  }

  // Red callout 4: Competition
  let c4Title, c4Desc;
  if (onPage >= 2) {
    c4Title = `${onPage} Competitor Ads`;
    c4Desc = `Rival placements blocking Add to Cart path.`;
  } else if (data.ppcStatus === 'None') {
    c4Title = 'No Brand Defense';
    c4Desc = 'Competitors freely bidding on your brand keywords.';
  } else {
    c4Title = 'Market Exposure';
    c4Desc = 'Competitor presence on brand search results.';
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
    <div style="margin-bottom:16px;color:#999"><svg viewBox="0 0 24 24" width="60" height="60" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></div>
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
      icon: SVG.noEntry,
      title: 'Leak 1: The Prime Penalty',
      text: `${missingCount} of ${bp} catalog items missing FBA Prime badge, resulting in a 30-50% conversion drop.`,
      amount: `$${lowEst} - $${highEst} / month lost`
    });
  }

  if (onPage >= 2 || data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') {
    const adLoss = fmt(Math.round(onPage * 320));
    leaks.push({
      icon: SVG.hole,
      title: 'Leak 2: Search Siphoning',
      text: `${onPage} competitor placements on your brand page, diverting 10% of traffic to rivals.`,
      amount: `~$${adLoss} / month lost`
    });
  }

  if (sc > 3 && data.buyBoxIsTheBrand === false) {
    leaks.push({
      icon: SVG.moneyOff,
      title: 'Leak 3: Buy Box Leakage',
      text: `${sc} sellers competing on your listings. Unauthorized resellers controlling Buy Box and capturing your revenue.`,
      amount: 'Revenue redirected to 3P sellers'
    });
  }

  if (leaks.length === 0) {
    leaks.push({
      icon: SVG.trendDown,
      title: 'Leak 1: Growth Ceiling',
      text: 'Current Amazon setup is leaving revenue on the table through sub-optimal operational execution.',
      amount: 'Significant upside available'
    });
  }

  return leaks.slice(0, 2).map(l =>
    `<div class="p3-card">
      <h4><span style="display:inline-flex;vertical-align:middle;margin-right:8px;color:#c62828">${l.icon}</span>${escapeHtml(l.title)}</h4>
      <p>${escapeHtml(l.text)}</p>
      <div class="p3-amt red">${escapeHtml(l.amount)}</div>
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
      icon: SVG.rocket,
      title: 'Action 1: Prime Standardization',
      text: 'Inject all remaining SKUs through our Las Vegas FBA hub. Unlock access to 200M+ Prime filter users.',
      impact: '+30-50% Immediate Sales Lift'
    });
  }

  if (onPage >= 2 || data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') {
    actions.push({
      icon: SVG.shield,
      title: 'Action 2: Brand Defense Protocol',
      text: `Launch targeted search ads on your own branded keywords to systematically evict the ${onPage} competitors.`,
      impact: 'Reclaim Hijacked Traffic & Revenue'
    });
  }

  if (sc > 3) {
    actions.push({
      icon: SVG.broom,
      title: 'Action 3: Seller Map Cleanup',
      text: 'Enforce brand authorization and MAP pricing. Remove unauthorized resellers from your listings.',
      impact: 'Stabilize Pricing & Margins'
    });
  }

  if (data.listingQuality === 'Weak/No A+' || data.listingQuality === 'Adequate') {
    actions.push({
      icon: SVG.sparkle,
      title: 'Action: A+ Content & Storefront',
      text: 'Build premium A+ content, video, and brand storefront — all funded and executed by Profitzon.',
      impact: '+15-25% Conversion Lift'
    });
  }

  if (actions.length === 0) {
    actions.push({
      icon: SVG.trendUp,
      title: 'Action 1: Scale Revenue',
      text: 'Funded wholesale orders, new product launches, and advanced advertising — our capital, your brand.',
      impact: 'Accelerated Growth'
    });
  }

  return actions.slice(0, 2).map(a =>
    `<div class="p3-card">
      <h4><span style="display:inline-flex;vertical-align:middle;margin-right:8px;color:#1a2744">${a.icon}</span>${escapeHtml(a.title)}</h4>
      <p>${escapeHtml(a.text)}</p>
      <div class="p3-amt green">${escapeHtml(a.impact)}</div>
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
    arrows.push(`<svg class="p3-arrow" viewBox="0 0 60 36">
      <polygon points="4,12 36,12 36,4 56,18 36,32 36,24 4,24" fill="#1a2744"/>
    </svg>`);
  }
  return arrows.join('\n');
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

  const replacements = {
    '{{brandName}}': escapeHtml(data.brandName || 'Unknown Brand'),
    '{{reportId}}': reportId,

    // Page 1
    '{{gaugeSVG}}': renderGaugeSVG(healthScore),
    '{{strengthItems}}': renderStrengthItems(data),
    '{{vulnItems}}': renderVulnItems(data),

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

  await page.setViewport({ width: 1376, height: 768, deviceScaleFactor: 3 });

  await page.setContent(coverHtml, { waitUntil: 'domcontentloaded' });
  const coverPdfBytes = await page.pdf({
    width: '1376px', height: '768px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await page.setContent(auditHtml, { waitUntil: 'load', timeout: 15000 });
  const auditPdfBytes = await page.pdf({
    width: '1376px', height: '768px',
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
// EMAIL TRACKING
// ============================================================

const MONDAY_BOARD_ID = '18401264535';
const ENGAGEMENT_COL = 'color_mm1txp55';

// 1x1 transparent GIF (43 bytes)
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'
);

// In-memory tracking per item (resets on server restart, but Monday status persists)
const openCounts = new Map();
const engagementLevel = new Map();

// Gmail/Google pre-fetches images when SENDING, causing a false "Opened" immediately.
// Fix: skip the first pixel hit (count=1) — it is always the pre-fetch.
// Real opens start from count=2. Multi-Open from count=4.
const PREFETCH_SKIP = 1;

// Calendar booking link (hardcoded — never changes)
const CALENDAR_URL = 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1XYd9SQ01a6L8gMxiPEkexk0ULhc2Q7tQ77rfMVNWo9BAyASi9_rB9odbMmssMhDYVBwtW1hyn';

// Engagement priority: higher number = stronger signal, never downgrade
const ENGAGEMENT_PRIORITY = {
  'Sent': 1,
  'Opened': 2,
  'Multi-Open': 3,
  'Clicked': 4
};

function shouldUpdate(itemId, newStatus) {
  const currentLevel = engagementLevel.get(itemId) || 0;
  const newLevel = ENGAGEMENT_PRIORITY[newStatus] || 0;
  if (newLevel > currentLevel) {
    engagementLevel.set(itemId, newLevel);
    return true;
  }
  return false;
}

async function updateMonday(itemId, columnId, value) {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) { console.error('MONDAY_API_TOKEN not set'); return; }

  const mutation = `mutation { change_simple_column_value(board_id: ${MONDAY_BOARD_ID}, item_id: ${itemId}, column_id: "${columnId}", value: "${value}") { id } }`;

  try {
    const resp = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ query: mutation })
    });
    const result = await resp.json();
    if (result.errors) console.error('Monday API error:', result.errors);
    else console.log(`Tracking: item ${itemId} → ${value}`);
  } catch (e) {
    console.error('Monday API call failed:', e.message);
  }
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

  // ── Open tracking pixel ──
  app.get('/t/o/:itemId', (req, res) => {
    const itemId = req.params.itemId;
    if (!/^\d+$/.test(itemId)) return res.status(400).send('Invalid ID');

    // Always return pixel immediately
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Expires', '0');
    res.end(TRACKING_PIXEL);

    // Count this hit
    const count = (openCounts.get(itemId) || 0) + 1;
    openCounts.set(itemId, count);

    // Skip first hit — Gmail pre-fetches the image when sending
    if (count <= PREFETCH_SKIP) {
      console.log(`Tracking: item ${itemId} → pixel hit #${count} ignored (Gmail pre-fetch)`);
      return;
    }

    // Real opens: hit 2-3 = Opened, hit 4+ = Multi-Open
    const status = count >= 4 ? 'Multi-Open' : 'Opened';
    if (shouldUpdate(itemId, status)) {
      updateMonday(itemId, ENGAGEMENT_COL, status);
    }
  });

  // ── Click tracking: calendar link ──
  app.get('/t/c/:itemId/calendar', (req, res) => {
    const itemId = req.params.itemId;
    if (!/^\d+$/.test(itemId)) return res.status(400).send('Invalid ID');

    // Redirect to Google Calendar immediately
    res.redirect(302, CALENDAR_URL);

    // Update Monday in background
    if (shouldUpdate(itemId, 'Clicked')) {
      updateMonday(itemId, ENGAGEMENT_COL, 'Clicked');
    }
  });

  // ── Dashboard ──
  app.get('/dashboard', (req, res) => {
    const dashPath = path.join(__dirname, 'dashboard.html');
    if (!fs.existsSync(dashPath)) return res.status(404).send('Dashboard not found');
    res.setHeader('Content-Type', 'text/html');
    res.send(fs.readFileSync(dashPath, 'utf8'));
  });

  // ── Dashboard API: Pipeline data ──
  const MONDAY_TOKEN = () => process.env.MONDAY_API_TOKEN;
  const BOARD_ID = MONDAY_BOARD_ID;

  const GROUP_MAP = {
    'group_mm0vgchm': { key: 'new', label: 'New Brands', color: '#64748b' },
    'group_mm0yhp0c': { key: 'draft_review', label: 'Draft Review', color: '#f59e0b' },
    'group_mm0v7hem': { key: 'email_sent', label: 'Email Sent', color: '#3b82f6' },
    'group_mm0vyrrj': { key: 'follow_up', label: 'Follow-Up Active', color: '#8b5cf6' },
    'group_mm0vn0h5': { key: 'replied', label: 'Replied', color: '#22c55e' },
    'group_mm0v19hg': { key: 'meeting_booked', label: 'Meeting Booked', color: '#10b981' },
    'group_mm0v58xm': { key: 'cold', label: 'Cold', color: '#6b7280' }
  };

  async function queryMonday(query, variables) {
    const token = MONDAY_TOKEN();
    if (!token) throw new Error('MONDAY_API_TOKEN not set');
    const resp = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ query, variables })
    });
    const result = await resp.json();
    if (result.errors) throw new Error(JSON.stringify(result.errors));
    return result.data;
  }

  app.get('/api/pipeline', async (req, res) => {
    try {
      const query = `query {
        boards(ids: [${BOARD_ID}]) {
          groups { id title }
          items_page(limit: 500) {
            items {
              id name group { id }
              column_values(ids: ["text_mm0vpf6a","email_mm0vbdtm","numeric_mm0yv8q6","color_mm0vfp1h","color_mm1txp55","color_mm0v7z99","date_mm116z9v","text_mm1b85yc","long_text_mm0xpw78","long_text_mm0vjajn"]) {
                id text value
              }
            }
          }
        }
      }`;
      const data = await queryMonday(query);
      const board = data.boards[0];
      const stages = {};

      // Initialize all stages
      for (const [gid, info] of Object.entries(GROUP_MAP)) {
        stages[info.key] = { label: info.label, color: info.color, count: 0, items: [] };
      }

      // Status-based stage overrides (items in "New" group may have sub-statuses)
      const STATUS_OVERRIDE = {
        'Researching': 'researching',
        'Draft Ready': 'draft_review',
        'Approved': 'approved'
      };

      // Add stages not directly mapped to groups
      if (!stages['researching']) stages['researching'] = { label: 'Researching', color: '#6366f1', count: 0, items: [] };
      if (!stages['approved']) stages['approved'] = { label: 'Approved', color: '#14b8a6', count: 0, items: [] };

      for (const item of board.items_page.items) {
        const groupInfo = GROUP_MAP[item.group.id];
        if (!groupInfo) continue;
        const cv = {};
        for (const c of item.column_values) { cv[c.id] = c.text || ''; }

        // Determine effective stage: check Pipeline Status override first
        const pipelineStatus = cv['color_mm0vfp1h'] || '';
        const stageKey = STATUS_OVERRIDE[pipelineStatus] || groupInfo.key;

        // Make sure the stage exists
        if (!stages[stageKey]) stages[stageKey] = { label: stageKey, color: '#64748b', count: 0, items: [] };

        stages[stageKey].items.push({
          id: item.id,
          name: item.name,
          contactName: cv['text_mm0vpf6a'] || '',
          contactEmail: cv['email_mm0vbdtm'] || '',
          priorityScore: parseInt(cv['numeric_mm0yv8q6']) || 0,
          pipelineStatus: cv['color_mm0vfp1h'] || '',
          engagement: cv['color_mm1txp55'] || '',
          maturity: cv['color_mm0v7z99'] || '',
          lastActivity: cv['date_mm116z9v'] || '',
          emailSubject: cv['text_mm1b85yc'] || '',
          emailBody: cv['long_text_mm0xpw78'] || '',
          opportunitySummary: cv['long_text_mm0vjajn'] || ''
        });
        stages[stageKey].count++;
      }

      res.json({ stages });
    } catch (err) {
      console.error('Pipeline API error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/stats', async (req, res) => {
    try {
      const query = `query {
        boards(ids: [${BOARD_ID}]) {
          items_page(limit: 500) {
            items {
              id group { id }
              column_values(ids: ["color_mm1txp55","numeric_mm0yv8q6"]) { id text }
            }
          }
        }
      }`;
      const data = await queryMonday(query);
      const items = data.boards[0].items_page.items;

      let total = items.length;
      let sentCount = 0, openCount = 0, replyCount = 0, meetingCount = 0, coldCount = 0;
      let prioritySum = 0, priorityCount = 0;

      for (const item of items) {
        const gid = item.group.id;
        const cv = {};
        for (const c of item.column_values) cv[c.id] = c.text || '';

        const engagement = cv['color_mm1txp55'] || '';
        const priority = parseInt(cv['numeric_mm0yv8q6']) || 0;
        if (priority > 0) { prioritySum += priority; priorityCount++; }

        if (['group_mm0v7hem','group_mm0vyrrj'].includes(gid)) sentCount++;
        if (engagement.includes('Open') || engagement.includes('Click')) openCount++;
        if (gid === 'group_mm0vn0h5') replyCount++;
        if (gid === 'group_mm0v19hg') meetingCount++;
        if (gid === 'group_mm0v58xm') coldCount++;
      }

      const emailedTotal = sentCount + replyCount + meetingCount + coldCount;

      res.json({
        totalBrands: total,
        openRate: emailedTotal > 0 ? Math.round((openCount / emailedTotal) * 100) : 0,
        replyRate: emailedTotal > 0 ? Math.round((replyCount / emailedTotal) * 100) : 0,
        meetingsBooked: meetingCount,
        sentTotal: emailedTotal,
        coldCount,
        avgPriorityScore: priorityCount > 0 ? Math.round(prioritySum / priorityCount) : 0
      });
    } catch (err) {
      console.error('Stats API error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/activity', async (req, res) => {
    try {
      const query = `query {
        boards(ids: [${BOARD_ID}]) {
          activity_logs(limit: 30) {
            created_at data event entity
          }
        }
      }`;
      const data = await queryMonday(query);
      const logs = data.boards[0].activity_logs || [];
      const activities = logs.map(log => {
        let parsed = {};
        try { parsed = JSON.parse(log.data); } catch(e) {}
        return {
          timestamp: log.created_at,
          event: log.event,
          entity: log.entity,
          brandName: parsed.pulse_name || parsed.item_name || '',
          columnTitle: parsed.column_title || '',
          oldValue: parsed.previous_value?.label?.text || parsed.previous_value || '',
          newValue: parsed.value?.label?.text || parsed.value || '',
          details: parsed
        };
      }).filter(a => a.brandName);

      res.json({ activities });
    } catch (err) {
      console.error('Activity API error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  const STAGE_TO_GROUP = {};
  for (const [gid, info] of Object.entries(GROUP_MAP)) { STAGE_TO_GROUP[info.key] = gid; }

  app.post('/api/action', async (req, res) => {
    try {
      const { itemId, action, groupId, targetStage } = req.body;
      if (!itemId) return res.status(400).json({ error: 'Missing itemId' });

      if (action === 'move') {
        const gid = groupId || STAGE_TO_GROUP[targetStage];
        if (!gid) return res.status(400).json({ error: 'Missing groupId or targetStage' });
        await queryMonday(`mutation { move_item_to_group(item_id: ${itemId}, group_id: "${gid}") { id } }`);
        return res.json({ success: true, message: `Moved item ${itemId} to ${gid}` });
      }

      if (action === 'approve') {
        await queryMonday(`mutation { change_simple_column_value(board_id: ${BOARD_ID}, item_id: ${itemId}, column_id: "color_mm0y3cmq", value: "Approved") { id } }`);
        return res.json({ success: true, message: `Item ${itemId} approved` });
      }

      if (action === 'cold') {
        await queryMonday(`mutation { move_item_to_group(item_id: ${itemId}, group_id: "group_mm0v58xm") { id } }`);
        await queryMonday(`mutation { change_simple_column_value(board_id: ${BOARD_ID}, item_id: ${itemId}, column_id: "color_mm0vfp1h", value: "Cold") { id } }`);
        return res.json({ success: true, message: `Item ${itemId} marked cold` });
      }

      res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err) {
      console.error('Action API error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, () => {
    console.log(`Profitzon Audit Renderer v9.1-infographic running on port ${port}`);
    console.log(`POST /render — send JSON data, get PDF`);
    console.log(`GET  /t/o/:id — open tracking pixel (skips 1st hit = Gmail pre-fetch)`);
    console.log(`GET  /t/c/:id/calendar — calendar click → Clicked`);
    console.log(`GET  /dashboard — outreach command center`);
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
