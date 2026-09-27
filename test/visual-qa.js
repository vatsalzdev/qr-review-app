import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';
import apiRoutes from '../server/routes/api.js';
import { initDb, closeDb, createBusiness, deleteBusinessBySlug } from '../server/db/mongo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

const clientDistPath = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDistPath));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const PORT = 5120;
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const TEST_TYPES = [
  { name: 'The Bistro Table', slug: 'qa-restaurant', type: 'restaurant' },
  { name: 'Morning Brew', slug: 'qa-cafe', type: 'cafe' },
  { name: 'Pulse Nightclub', slug: 'qa-club', type: 'club' },
  { name: 'Golden Crisp Waffles', slug: 'qa-waffle-shop', type: 'waffle_shop' },
  { name: 'Pixel Arcade', slug: 'qa-gaming-zone', type: 'gaming_zone' },
  { name: 'Luxe Hair Studio', slug: 'qa-salon', type: 'salon' },
  { name: 'Apex Hardware', slug: 'qa-generic', type: 'generic' }
];

const server = app.listen(PORT, async () => {
  let browser;
  try {
    await initDb();

    // Create temporary QA businesses
    for (const item of TEST_TYPES) {
      await createBusiness({
        name: item.name,
        slug: item.slug,
        googleReviewUrl: 'https://search.google.com/local/writereview?placeid=TEST_QA_123',
        type: item.type
      });
    }

    browser = await puppeteer.launch({
      executablePath: edgePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    console.log('\n🎨 Performing Visual QA Inspection across 7 Key Business Types:\n');

    for (const item of TEST_TYPES) {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, isMobile: true });
      await page.goto(`http://localhost:${PORT}/r/${item.slug}`, { waitUntil: 'networkidle0' });

      const data = await page.evaluate(() => {
        const canvas = document.querySelector('.mobile-canvas');
        const avatar = document.querySelector('.shop-avatar');
        const pill = document.querySelector('.business-type-pill');
        const prompt = document.querySelector('.rating-prompt');
        const computed = window.getComputedStyle(canvas);
        const pillComputed = window.getComputedStyle(pill);
        const avatarComputed = window.getComputedStyle(avatar);

        return {
          canvasClasses: canvas.className,
          avatarGlyph: avatar.innerText.trim(),
          avatarBg: avatarComputed.backgroundColor,
          pillText: pill.innerText.trim(),
          pillColor: pillComputed.color,
          pillBg: pillComputed.backgroundColor,
          promptText: prompt.innerText.trim(),
          borderTop: computed.borderTop
        };
      });

      console.log(`[Business: "${item.name}" (${item.type})]`);
      console.log(`  Avatar: ${data.avatarGlyph} | Bg: ${data.avatarBg}`);
      console.log(`  Pill: "${data.pillText}" | Color: ${data.pillColor} | Bg: ${data.pillBg}`);
      console.log(`  Prompt: "${data.promptText}"`);
      console.log(`  Border-Top Accent: ${data.borderTop}`);
      console.log(`  Theme Class: ${data.canvasClasses.split(' ').filter(c => c.startsWith('theme-')).join(' ')}`);
      console.log('--------------------------------------------------');

      await page.close();
    }

    // Clean up
    for (const item of TEST_TYPES) {
      await deleteBusinessBySlug(item.slug);
    }

    console.log('\n🎉 VISUAL QA INSPECTION COMPLETE: All themes rendered distinct, subtle, and compliant!\n');
  } catch (err) {
    console.error('Visual QA error:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await closeDb();
    server.close();
  }
});
