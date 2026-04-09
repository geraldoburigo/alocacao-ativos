export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });

  const syms = symbols.split(',').map(s => s.trim()).filter(Boolean);
  const results = {};

  await Promise.all(syms.map(async sym => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d&_=${Date.now()}`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
        }
      });

      if (!r.ok) {
        const r2 = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });
        if (!r2.ok) { results[sym] = null; return; }
        const d2 = await r2.json();
        const meta2 = d2?.chart?.result?.[0]?.meta;
        if (!meta2) { results[sym] = null; return; }
        const p2 = meta2.regularMarketPrice > 0 ? meta2.regularMarketPrice : (meta2.chartPreviousClose || 0);
        results[sym] = p2 > 0 ? { price: p2, var_pct: ((p2-(meta2.chartPreviousClose||p2))/(meta2.chartPreviousClose||p2))*100 } : null;
        return;
      }

      const d = await r.json();
      const meta = d?.chart?.result?.[0]?.meta;
      if (!meta) { results[sym] = null; return; }

      const price = meta.regularMarketPrice > 0 ? meta.regularMarketPrice : (meta.chartPreviousClose || 0);
      if (price > 0) {
        const prev = meta.chartPreviousClose || price;
        results[sym] = { price, var_pct: ((price-prev)/(prev||1))*100, currency: meta.currency||'USD' };
      } else {
        results[sym] = null;
      }
    } catch (e) {
      results[sym] = null;
    }
  }));

  return res.status(200).json(results);
}
