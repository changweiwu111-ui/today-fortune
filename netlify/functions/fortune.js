// 「為你而解」AI 代理 — Gemini 免費額度
// 安全：API 金鑰只存在 Netlify 環境變數 GEMINI_API_KEY，前端永遠看不到。
// 省錢：未設金鑰或額度用盡 → 回非 200，前端自動退回內建文案，純免費額度、不會產生費用。
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return resp(405, { error: 'method' });

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return resp(503, { error: 'no-key' }); // 還沒設金鑰：前端用內建文案

  let data;
  try { data = JSON.parse(event.body || '{}'); } catch { return resp(400, { error: 'json' }); }

  const name  = String(data.name  || '朋友').slice(0, 20);
  const thing = String(data.thing || '').slice(0, 60);
  const scene = String(data.scene || '綜合').slice(0, 10);
  const lv    = String(data.lv    || '').slice(0, 6);
  const mood  = String(data.mood  || '').slice(0, 10);

  const topic = thing
    ? `今天他要做的事是：「${thing}」`
    : `今天他主要關注的面向是：「${scene}」`;

  const prompt =
`你是一位溫暖、有靈性又務實的占卜師，正在替一位叫「${name}」的人解今天的運勢。
${topic}
他今天抽到的籤是「${lv}」，整體心情是「${mood}」。

請用繁體中文，寫一段「為你而解」——直接針對他今天要做的那件事，給溫暖、具體、能讓他感同身受、真的派得上用場的話。
要求：
- 2 到 3 句，約 80 到 130 字。
- 像在跟他本人說話（用「你」），語氣溫暖真誠，不要書面語、不要條列、不要 emoji。
- 要具體呼應他那件事，給一個今天就能用上的小提醒或鼓勵。
- 不要算命嚇人、不要說壞話，只給正向但不浮誇的引導。
- 只輸出那段話本身，不要加標題、引號或任何解釋。`;

  // 用 gemini-2.5-flash（此專案免費額度可用；2.0-flash 免費額度為 0）；新格式金鑰用標頭驗證
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // thinkingBudget:0 關閉思考，避免 token 全花在思考上吐空字
        generationConfig: { temperature: 0.9, maxOutputTokens: 400, topP: 0.95, thinkingConfig: { thinkingBudget: 0 } }
      }),
      signal: ctrl.signal
    });
    clearTimeout(timer);

    if (!r.ok) return resp(r.status, { error: 'gemini-' + r.status }); // 含 429 額度用盡
    const j = await r.json();
    const text = (j?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    if (!text) return resp(502, { error: 'empty' });
    return resp(200, { text });
  } catch (e) {
    return resp(500, { error: 'fetch-failed' });
  }
};

function resp(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
