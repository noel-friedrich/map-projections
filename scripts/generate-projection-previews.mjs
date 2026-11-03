// Requires playwright-core and Chrome. Optional environment variables:
// PLAYWRIGHT_MODULE (absolute module path), CHROME_EXECUTABLE (Chrome binary).
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';
import { projectionCatalog } from '../js/projection-catalog.js';
const requested = process.argv.slice(2);
if (requested.some(id => !projectionCatalog.some(item => item.id === id))) throw new Error('Unknown projection');

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer(async (request, response) => {
    try {
        const path = resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
        if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) throw new Error('Invalid path');
        response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
        response.end(await readFile(path));
    } catch {
        response.writeHead(404).end();
    }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await chromium.launch({
        executablePath: process.env.CHROME_EXECUTABLE,
        headless: true,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/scripts/projection-previews.html`);
    await page.waitForFunction(() => typeof window.renderProjectionPreview === 'function');
    const directory = new URL('../assets/projections/', import.meta.url);
    await mkdir(directory, { recursive: true });
    for (const { id } of projectionCatalog.filter(item => !requested.length || requested.includes(item.id))) {
        const data = await page.evaluate(id => window.renderProjectionPreview(id), id);
        await writeFile(new URL(`${id}.png`, directory), Buffer.from(data.split(',')[1], 'base64'));
        console.log(`Rendered ${id}.png`);
    }
} finally {
    await browser?.close();
    server.close();
}
