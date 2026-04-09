export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });

  const syms = symbols.split(',').map(s => s.trim()).filter(Boolean);
  const results = {};

  await Promise.all(syms.map(async sym => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });
      if (!r.ok) { results[sym] = null; return; }
      const d = await r.json();
      const meta = d?.chart?.result?.[0]?.meta;
      if (!meta) { results[sym] = null; return; }
      const price = meta.regularMarketPrice > 0
        ? meta.regularMarketPrice
        : (meta.chartPreviousClose || 0);
      if (price > 0) {
        const prev = meta.chartPreviousClose || price;
        results[sym] = {
          price,
          var_pct: ((price - prev) / (prev || 1)) * 100,
          currency: meta.currency || 'USD'
        };
      } else {
        results[sym] = null;
      }
    } catch (e) {
      results[sym] = null;
    }
  }));

  return res.status(200).json(results);
}
