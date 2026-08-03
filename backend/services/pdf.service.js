const puppeteer = require('puppeteer');
const { buildDemandeHtml } = require('../templates/demande.pdf.template');

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserPromise;
}

async function generateDemandePdf(demande) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(buildDemandeHtml(demande), { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
  }
}

module.exports = { generateDemandePdf, closeBrowser };
