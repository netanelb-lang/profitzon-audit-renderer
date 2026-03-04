/**
 * Profitzon Brand Audit Report Renderer v2
 *
 * Usage:
 *   As Express API:  node render.js --serve --port 3100
 *   As CLI:          node render.js --data '{"brandName":"Nano Clear",...}' --output report.pdf
 *
 * API endpoint:
 *   POST /render  — body: JSON audit data → returns PDF binary
 *   POST /render?format=html — returns rendered HTML instead
 */

const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const LOGO_PATH = path.join(__dirname, 'profitzon-logo.png');

// Pre-load logo as base64 data URI
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
  const gray = ['None', 'N/A'];

  if (green.includes(status)) return 's-green';
  if (yellow.includes(status)) return 's-yellow';
  if (red.includes(status)) return 's-red';
  if (gray.includes(status)) return 's-gray';
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
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// SECTION RENDERERS
// ============================================================

function renderAlertBar(data) {
  const healthScore = parseInt(data.healthScore || '50');
  if (healthScore >= 70) return ''; // no alert for healthy brands

  const issues = [];
  if (data.fbaStatus === 'FBM Only') issues.push('no FBA coverage');
  if (data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated') issues.push('no active advertising');
  if (parseInt(data.sellerCount || 0) > 5) issues.push(`${data.sellerCount} unauthorized sellers`);
  if (data.priceStability === 'MAP Violated') issues.push('MAP violations detected');
  if (data.listingQuality === 'Weak/No A+') issues.push('poor listing quality');

  const issueText = issues.length > 0
    ? `We found <span>${issues.length} critical issues</span> affecting your Amazon revenue: ${issues.join(', ')}.`
    : `Your Amazon presence has <span>significant room for improvement</span>.`;

  return `<div class="alert-bar">
    <div class="alert-icon">&#9888;</div>
    <div class="alert-text">${issueText}</div>
  </div>`;
}

function renderFindings(findings) {
  if (!findings || !findings.length) {
    return `<div class="finding-row warning">
      <div class="finding-icon">&#128269;</div>
      <div class="finding-content">
        <div class="finding-label">Info</div>
        <div class="finding-text">No significant findings. Manual review recommended.</div>
      </div>
    </div>`;
  }

  const icons = { issue: '&#10060;', opportunity: '&#9989;', warning: '&#9888;', competitor: '&#128101;' };

  return findings.map(f => {
    const type = f.type || 'warning';
    return `<div class="finding-row ${type}">
      <div class="finding-icon">${icons[type] || '&#128269;'}</div>
      <div class="finding-content">
        <div class="finding-label">${type === 'issue' ? 'Critical Issue' : type === 'opportunity' ? 'Opportunity' : type === 'competitor' ? 'Competitor Threat' : 'Warning'}</div>
        <div class="finding-text">${f.text}</div>
      </div>
    </div>`;
  }).join('\n      ');
}

function renderBadges(product) {
  const badges = [];
  if (product.is_prime) badges.push('<span class="badge-sm badge-prime">PRIME</span>');
  if (product.is_amazons_choice) badges.push('<span class="badge-sm badge-choice">CHOICE</span>');
  if (product.best_seller) badges.push('<span class="badge-sm badge-bestseller">#1</span>');
  if (product.is_sponsored) badges.push('<span class="badge-sm badge-sponsored">AD</span>');
  if (product.notBrand) badges.push('<span class="badge-sm badge-notbrand">OTHER</span>');
  return badges.join(' ') || '<span style="color:#94a3b8;font-size:10px">&#8212;</span>';
}

function renderProductRows(products) {
  if (!products || !products.length) {
    return `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px">No product data available</td></tr>`;
  }
  return products.slice(0, 6).map(p => `
        <tr${p.notBrand ? ' style="opacity:0.6"' : ''}>
          <td style="font-weight:500">${escapeHtml(truncate(p.title, 45))}</td>
          <td>$${(p.price || 0).toFixed(2)}</td>
          <td>${(p.rating || 0).toFixed(1)} &#9733;</td>
          <td>${(p.reviews_count || 0).toLocaleString()}</td>
          <td style="font-size:10px;color:#64748b">${p.sales_volume || '&#8212;'}</td>
          <td>${renderBadges(p)}</td>
        </tr>`).join('');
}

function computeLosses(data) {
  const fbm = data.fbaStatus === 'FBM Only';
  const partialFba = data.fbaStatus === 'Partial FBA';
  const noPpc = data.ppcStatus === 'None' || data.ppcStatus === 'Competitor Dominated';
  const manySellers = parseInt(data.sellerCount || 0) > 3;
  const weakListings = data.listingQuality === 'Weak/No A+';

  // Buy Box risk
  let buyBox = 'Low';
  if (fbm && manySellers) buyBox = 'Critical';
  else if (fbm || manySellers) buyBox = 'High';
  else if (partialFba) buyBox = 'Medium';

  // Visibility gap
  let visibility = 'Low';
  if (noPpc && weakListings) visibility = 'Critical';
  else if (noPpc || weakListings) visibility = 'High';
  else visibility = 'Medium';

  // Conversion drag
  let conversion = 'Low';
  if (fbm && weakListings) conversion = 'Critical';
  else if (fbm || weakListings || manySellers) conversion = 'High';
  else if (partialFba) conversion = 'Medium';

  return { buyBox, visibility, conversion };
}

// ============================================================
// MAIN RENDER
// ============================================================

function renderHTML(data) {
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  // Calculate health score (inverted priority: 100 = perfect health)
  const priority = parseInt(data.priorityScore || '50');
  const healthScore = Math.max(0, Math.min(100, 100 - priority));
  const healthClass = healthScore < 40 ? 'critical' : healthScore < 65 ? 'warning' : 'healthy';
  const healthLabel = healthScore < 30 ? 'Critical' : healthScore < 50 ? 'Needs Attention' : healthScore < 70 ? 'Fair' : healthScore < 85 ? 'Good' : 'Excellent';

  // Losses
  const losses = computeLosses(data);

  // Seller risk label
  const sc = parseInt(data.sellerCount || 0);
  const sellerRisk = sc <= 1 ? 'Controlled' : sc <= 3 ? 'Low Risk' : sc <= 6 ? 'Moderate' : 'High Risk';

  // Report ID
  const reportId = `PZ-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const replacements = {
    '{{logoBase64}}': logoBase64,
    '{{brandName}}': escapeHtml(data.brandName || 'Unknown Brand'),
    '{{reportDate}}': data.reportDate || new Date().toISOString().split('T')[0],
    '{{reportId}}': reportId,

    // Health score
    '{{healthScore}}': String(healthScore),
    '{{healthScoreClass}}': healthClass,
    '{{healthScoreLabel}}': healthLabel,

    // Top-level statuses
    '{{brandMaturity}}': data.brandMaturity || 'N/A',
    '{{brandMaturityClass}}': statusToClass(data.brandMaturity),
    '{{issueSeverity}}': data.issueSeverity || 'N/A',
    '{{issueSeverityClass}}': statusToClass(data.issueSeverity),
    '{{brandProductCount}}': String(data.brandProductCount || data.catalogSize || '?'),
    '{{totalResults}}': String(data.totalResults || '?'),
    '{{competitorCount}}': String(data.competitorCount || '0'),
    '{{competitorClass}}': parseInt(data.competitorCount || 0) > 5 ? 's-red' : parseInt(data.competitorCount || 0) > 2 ? 's-yellow' : 's-green',

    // Metrics
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

    '{{sellerCount}}': String(data.sellerCount || 0),
    '{{sellerColor}}': sc <= 3 ? 'green' : sc <= 6 ? 'yellow' : 'red',
    '{{sellerClass}}': sc <= 3 ? 's-green' : sc <= 6 ? 's-yellow' : 's-red',
    '{{sellerRisk}}': sellerRisk,

    // Losses
    '{{lostBuyBox}}': losses.buyBox,
    '{{lostVisibility}}': losses.visibility,
    '{{lostConversion}}': losses.conversion,

    // Complex sections
    '{{alertBar}}': renderAlertBar(data),
    '{{findings}}': renderFindings(data.findings),
    '{{productRows}}': renderProductRows(data.topProducts),
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  return html;
}

// ============================================================
// PDF GENERATION (Puppeteer)
// ============================================================

async function renderPDF(data) {
  const puppeteer = require('puppeteer');
  const os = require('os');
  const html = renderHTML(data);

  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const browser = await puppeteer.launch(launchOptions);

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Write PDF to temp file to guarantee proper Buffer (Puppeteer v24 returns Uint8Array)
  const tmpPath = path.join(os.tmpdir(), `audit-${Date.now()}.pdf`);
  await page.pdf({
    path: tmpPath,
    width: '794px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await browser.close();
  return tmpPath;
}

// ============================================================
// EXPRESS SERVER MODE
// ============================================================

async function startServer(port) {
  const express = require('express');
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.post('/render', async (req, res) => {
    try {
      const data = req.body;
      if (!data || !data.brandName) {
        return res.status(400).json({ error: 'Missing brandName in request body' });
      }

      if (req.query.format === 'html') {
        const html = renderHTML(data);
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
      }

      const pdfPath = await renderPDF(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${data.brandName.replace(/[^a-zA-Z0-9]/g, '_')}_Amazon_Audit.pdf"`);
      const stream = fs.createReadStream(pdfPath);
      stream.pipe(res);
      stream.on('end', () => { try { fs.unlinkSync(pdfPath); } catch(e) {} });
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

  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'profitzon-audit-renderer' }));

  app.listen(port, () => {
    console.log(`Profitzon Audit Renderer v2 running on port ${port}`);
    console.log(`POST /render — send JSON data, get PDF`);
    console.log(`POST /render?format=html — get rendered HTML`);
  });
}

// ============================================================
// CLI / DEMO MODE
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
      const html = renderHTML(data);
      fs.writeFileSync(output.replace('.pdf', '.html'), html);
      console.log('HTML saved to', output.replace('.pdf', '.html'));
    } else {
      const tmpPdf = await renderPDF(data);
      fs.copyFileSync(tmpPdf, output);
      fs.unlinkSync(tmpPdf);
      console.log('PDF saved to', output);
    }
    return;
  }

  // Demo with realistic Nano Clear data (from actual Oxylabs output — brand filtered)
  const sampleData = {
    brandName: "Nano Clear",
    reportDate: "2026-03-04",
    priorityScore: "65",
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
    findings: [
      { type: "issue", text: "0% FBA coverage — all Nano Clear products ship FBM. No Prime badge means 30-50% lower Buy Box win rate and reduced visibility in search." },
      { type: "issue", text: "8 different sellers detected on your ASINs. Multiple unauthorized resellers are eroding margins and causing price instability." },
      { type: "competitor", text: "14 competitor products appear when customers search \"Nano Clear\" — other brands are capturing your brand's search traffic with no defensive PPC." },
      { type: "warning", text: "No Sponsored Products or Brand ads running. Your brand terms are unprotected — competitors can bid freely." },
      { type: "opportunity", text: "Moving top SKUs to FBA + launching Sponsored Brand campaigns could immediately lift visibility and conversion by 30-50%." }
    ],
    topProducts: [
      { title: "Nano Clear Watch Cleaner & Scratch Remover 2.1. Watch Cleaner Solution", price: 94.49, rating: 4.0, reviews_count: 86, is_prime: false, is_amazons_choice: false, best_seller: false, is_sponsored: false, sales_volume: "400+ bought" },
      { title: "Nano Clear Watch Crystal Scratch Remover Kit Complete", price: 49.99, rating: 4.2, reviews_count: 312, is_prime: false, is_amazons_choice: false, best_seller: false, is_sponsored: false, sales_volume: "200+ bought" },
      { title: "Nano Clear Jewelry Cleaning Cloth Microfiber", price: 19.99, rating: 3.8, reviews_count: 45, is_prime: false, is_amazons_choice: false, best_seller: false, is_sponsored: false, sales_volume: "" },
      { title: "Generic Screen Protector (NOT Nano Clear brand)", price: 12.99, rating: 4.5, reviews_count: 2340, is_prime: true, is_amazons_choice: true, best_seller: true, is_sponsored: false, notBrand: true, sales_volume: "5K+ bought" },
      { title: "Competitor Watch Polish Premium Kit", price: 34.99, rating: 4.6, reviews_count: 1890, is_prime: true, is_amazons_choice: false, best_seller: false, is_sponsored: true, notBrand: true, sales_volume: "1K+ bought" }
    ]
  };

  const html = renderHTML(sampleData);
  fs.writeFileSync(path.join(__dirname, 'demo-report.html'), html);
  console.log('Demo report v2 saved to demo-report.html');
  console.log('Open in browser to preview.');
}

main().catch(console.error);
