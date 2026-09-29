/**
 * Google Apps Script (GAS) API Client with Automatic Fallback
 * Works both with Express proxy (/api/gas/proxy) and direct client-to-GAS on static deployments (Vercel, GitHub Pages, etc.)
 */

export interface GasProxyPayload {
  action: 'getIdeasAndAnalysis' | 'saveIdea' | 'updateIdea' | 'deleteIdea' | 'incrementViewCount' | 'batchSyncIdeas';
  gasUrl: string;
  [key: string]: any;
}

export async function requestGasApi(payload: GasProxyPayload): Promise<any> {
  const { gasUrl, action, ...rest } = payload;
  const targetUrl = gasUrl || 'https://script.google.com/macros/s/AKfycbyTP0hfXvAKpmC1USIytbGBO3Mrs1KK_36aeIaDi6Mo5R_nwGmo4Ln_XknsyEWjJxQz/exec';

  // 1. Try local proxy (/api/gas/proxy) first
  try {
    const proxyRes = await fetch('/api/gas/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (proxyRes.ok) {
      const contentType = proxyRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await proxyRes.json();
        return data;
      }
    }
  } catch (proxyError) {
    console.info('Proxy not available, falling back to direct GAS communication:', proxyError);
  }

  // 2. Direct Fallback to Google Apps Script Web App
  if (action === 'getIdeasAndAnalysis') {
    // Simple GET without custom headers so browser follows redirect without CORS preflight
    const directUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getIdeasAndAnalysis&t=${Date.now()}`;
    const directRes = await fetch(directUrl);

    if (!directRes.ok) {
      throw new Error(`Direct GAS request failed with status: ${directRes.status}`);
    }

    const data = await directRes.json();
    return { status: 'SUCCESS', ...data };
  } else {
    // Direct POST for data mutations (saveIdea, updateIdea, deleteIdea, incrementViewCount)
    // Using text/plain avoids CORS preflight (OPTIONS) which Google Apps Script does not support
    try {
      const directPostRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action, ...rest }),
      });

      if (directPostRes.ok) {
        const text = await directPostRes.text();
        try {
          return JSON.parse(text);
        } catch {
          return { status: 'SUCCESS', raw: text };
        }
      }
    } catch (directPostError) {
      // If CORS blocks reading the response in browser, attempt fire-and-forget with no-cors
      console.warn('Direct POST failed with cors, attempting no-cors fallback:', directPostError);
      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action, ...rest }),
      });
      return { status: 'SUCCESS', fallback: 'no-cors' };
    }
  }
}
