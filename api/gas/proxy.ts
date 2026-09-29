export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbyTP0hfXvAKpmC1USIytbGBO3Mrs1KK_36aeIaDi6Mo5R_nwGmo4Ln_XknsyEWjJxQz/exec';

  try {
    let payload = req.method === 'GET' ? req.query : req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }
    payload = payload || {};

    const targetUrl = payload.gasUrl || DEFAULT_GAS_URL;
    const action = payload.action || (req.method === 'GET' ? 'getIdeasAndAnalysis' : '');

    if (action === 'getIdeasAndAnalysis') {
      const fetchUrl = `${targetUrl}?action=getIdeasAndAnalysis&t=${Date.now()}`;
      const response = await fetch(fetchUrl, {
        method: 'GET',
      });
      if (!response.ok) {
        throw new Error(`GAS request failed with status ${response.status}`);
      }
      const data = await response.json();
      return res.status(200).json({ status: 'SUCCESS', ...data });
    }

    const { gasUrl: _g, ...params } = payload;
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`GAS POST request failed with status ${response.status}`);
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { status: 'SUCCESS', raw: text };
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Vercel GAS Proxy Error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: error?.message || 'Failed to communicate with Google Apps Script',
    });
  }
}
