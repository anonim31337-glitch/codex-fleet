// Mózg LLM — oficjalne, darmowe API Gemini (Google AI Studio).
// BYOK: klucz użytkownika (aistudio.google.com/apikey), wołane wprost z przeglądarki.
// Legalne (oficjalny darmowy tier Google), zero kosztu dla właściciela strony.

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

export async function askGemini(system, user, key, maxTokens = 4096) {
  if (!key || !key.trim()) throw new Error('Najpierw wklej klucz Gemini. Kliknij „Jak zdobyć klucz — krok po kroku" i postępuj wg instrukcji.');
  let lastErr = '';
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key.trim())}`;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.92, topP: 0.95, maxOutputTokens: maxTokens },
        }),
      });
    } catch (e) {
      throw new Error('Brak połączenia z Gemini (sieć?).');
    }
    if (res.status === 404) { lastErr = 'model ' + model + ' niedostępny'; continue; } // spróbuj kolejny model
    if (res.status === 400 || res.status === 403) {
      throw new Error('Klucz odrzucony (400/403). Sprawdź, czy klucz jest poprawny i aktywny.');
    }
    if (res.status === 429) {
      throw new Error('Limit darmowy chwilowo wyczerpany (429). Poczekaj minutę i spróbuj ponownie.');
    }
    if (!res.ok) { lastErr = 'HTTP ' + res.status; continue; }
    const j = await res.json();
    const text = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts || [])
      .map(p => p.text || '').join('').trim();
    if (text) return text;
    lastErr = 'pusta odpowiedź';
  }
  throw new Error('Nie udało się wygenerować (' + lastErr + ').');
}
