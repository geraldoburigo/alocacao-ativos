export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });

  const syms = symbols.split(',').map(s => decodeURIComponent(s.trim())).filter(Boolean);
  const results = {};

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://finance.yahoo.com',
    'Referer': 'https://finance.yahoo.com/',
  };

  await Promise.all(syms.map(async sym => {
    // Tenta as duas versões da API do Yahoo
    for (const base of ['query1', 'query2']) {
      try {
        const url = `https://${base}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
        const r = await fetch(url, { headers });
        if (!r.ok) continue;
        const d = await r.json();
        const meta = d?.chart?.result?.[0]?.meta;
        if (!meta) continue;
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
          return; // achou, para
        }
      } catch (e) {}
    }

    // Tenta v7 como fallback
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
      const r = await fetch(url, { headers });
      if (r.ok) {
        const d = await r.json();
        const q = d?.quoteResponse?.result?.[0];
        if (q?.regularMarketPrice > 0) {
          results[sym] = {
            price: q.regularMarketPrice,
            var_pct: q.regularMarketChangePercent || 0,
            currency: q.currency || 'USD'
          };
          return;
        }
      }
    } catch(e) {}

    results[sym] = null;
  }));

  return res.status(200).json(results);
}
