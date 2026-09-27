import 'dotenv/config';
import puppeteer from 'puppeteer-core';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'node:assert/strict';
import apiRoutes from '../server/routes/api.js';
import { initDb, closeDb } from '../server/db/mongo.js';

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

const PORT = 5110;
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const VIEWPORTS = [
  { name: 'Samsung Galaxy S20 (360x800)', width: 360, height: 800 },
  { name: 'iPhone 13/14 Pro (390x844)', width: 390, height: 844 },
  { name: 'Google Pixel 7 (412x915)', width: 412, height: 915 }
];

const server = app.listen(PORT, async () => {
  let browser;
  try {
    await initDb();
    browser = await puppeteer.launch({
      executablePath: edgePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    console.log('\n📱 Testing Butter UX & Mobile Responsiveness across viewports:\n');

    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });
      await page.goto(`http://localhost:${PORT}/r/royal-cafe`, { waitUntil: 'networkidle0' });

      // Check initial horizontal scroll
      const initialScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const initialClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const initialHasHScroll = initialScrollWidth > initialClientWidth;
      assert.equal(initialHasHScroll, false, `Initial horizontal scroll detected on ${vp.name}`);

      // Tap 5 stars
      const starBtn = await page.$('.star-button:nth-child(5)');
      if (starBtn) {
        await starBtn.click();
      }

      // Check during streaming animation
      await new Promise(r => setTimeout(r, 250));
      const animatingScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const animatingClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const animatingHasHScroll = animatingScrollWidth > animatingClientWidth;
      assert.equal(animatingHasHScroll, false, `Horizontal scroll during animation on ${vp.name}`);

      // Wait for ready textarea and allow entrance animation to settle
      await page.waitForSelector('.draft-textarea', { timeout: 8000 });
      await new Promise(r => setTimeout(r, 400));
      const readyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const readyClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const readyHasHScroll = readyScrollWidth > readyClientWidth;
      assert.equal(readyHasHScroll, false, `Horizontal scroll in ready state on ${vp.name}`);

      // Measure layout metrics before click
      const metricsBefore = await page.evaluate(() => {
        const btn = document.querySelector('.btn-primary-review');
        const slot = document.querySelector('.action-feedback-slot');
        const btnRect = btn.getBoundingClientRect();
        return {
          btnOffsetTop: btn.offsetTop,
          btnRectTop: btnRect.top,
          slotHeight: slot ? slot.offsetHeight : 0,
          scrollY: window.scrollY
        };
      });

      // Perform copy action via DOM click
      await page.evaluate(() => {
        document.querySelector('.btn-primary-review').click();
      });
      await new Promise(r => setTimeout(r, 400)); // wait for button-pop animation to complete

      // Measure layout metrics after click
      const metricsAfter = await page.evaluate(() => {
        const btn = document.querySelector('.btn-primary-review');
        const slot = document.querySelector('.action-feedback-slot');
        const btnRect = btn.getBoundingClientRect();
        return {
          btnOffsetTop: btn.offsetTop,
          btnRectTop: btnRect.top,
          slotHeight: slot ? slot.offsetHeight : 0,
          scrollY: window.scrollY
        };
      });

      const offsetTopDelta = Math.abs(metricsAfter.btnOffsetTop - metricsBefore.btnOffsetTop);
      const rectTopDelta = Math.abs(metricsAfter.btnRectTop - metricsBefore.btnRectTop);

      assert.equal(offsetTopDelta, 0, `Button offsetTop shifted by ${offsetTopDelta}px on ${vp.name}`);
      assert.equal(rectTopDelta, 0, `Button rectTop shifted by ${rectTopDelta}px on ${vp.name}`);
      assert.equal(metricsBefore.slotHeight, 24, `Slot height before should be 24px`);
      assert.equal(metricsAfter.slotHeight, 24, `Slot height after should be 24px`);

      console.log(`[Viewport: ${vp.name}]`);
      console.log(`  Initial scrollWidth (${initialScrollWidth}px) vs clientWidth (${initialClientWidth}px): ✓ Zero horizontal overflow`);
      console.log(`  During animation scrollWidth (${animatingScrollWidth}px) vs clientWidth (${animatingClientWidth}px): ✓ Zero horizontal overflow`);
      console.log(`  Ready state scrollWidth (${readyScrollWidth}px) vs clientWidth (${readyClientWidth}px): ✓ Zero horizontal overflow`);
      console.log(`  Feedback slot height: ${metricsBefore.slotHeight}px (before) == ${metricsAfter.slotHeight}px (after)`);
      console.log(`  Button offsetTop shift: ${offsetTopDelta.toFixed(1)}px (✓ ZERO DISPLACEMENT)`);
      console.log(`  Button rectTop shift: ${rectTopDelta.toFixed(1)}px (✓ ZERO DISPLACEMENT)`);
      console.log('--------------------------------------------------');

      await page.close();
    }

    console.log('\n🎉 ALL MOBILE VIEWPORT AUDIT CHECKS PASSED!\n');
  } catch (err) {
    console.error('Audit failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await closeDb();
    server.close();
  }
});
