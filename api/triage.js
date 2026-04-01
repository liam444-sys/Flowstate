export default async function handler(req, res) {
  // Alleen POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, shift } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Geen tekst meegegeven' });
  }

  const shiftContext = shift === 'vroeg'
    ? 'De gebruiker heeft een vroege shift (05:00-13:00) en sport van 14:00-16:00.'
    : 'De gebruiker heeft een late shift (13:00-21:00) en sport van 08:00-10:30.';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `Je bent een ADHD-coach voor een jonge solopreneur. ${shiftContext}

Analyseer deze gedachtestroom zonder oordeel en categoriseer elk item.

Gedachtestroom: "${text}"

Geef ALLEEN geldig JSON terug, geen markdown, geen uitleg:
{
  "tasks": [{"text": "taak max 8 woorden", "energy": "high|medium|low", "breakdown": ["stap 1", "stap 2", "stap 3"]}],
  "ideas": [{"text": "idee om later te verkennen", "energy": "low"}],
  "worries": [{"text": "zorg of emotie", "energy": "medium"}],
  "noise": [{"text": "irrelevante gedachte"}]
}

Regels:
- Tasks altijd als werkwoord + object (max 8 woorden)
- Taken die meer dan 30 minuten duren krijgen een breakdown van 3-5 stappen van max 10 minuten
- Energy: high = diep denkwerk of administratie, low = routine of lezen, medium = alles daartussen
- Worries krijgen nooit een breakdown — ze worden erkend, niet opgelost
- Splits gecombineerde gedachten op in aparte items
- Maximaal 4 items per categorie voor overzicht
- Kies de meest dominante categorie per item`
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(500).json({ error: 'AI fout', detail: data });
    }

    const raw = data.content
      .map(i => i.text || '')
      .join('')
      .replace(/```json|```/g, '')
      .trim();

    const parsed = JSON.parse(raw);

    // Normaliseer: zorg dat elk item een object is met text property
    const normalize = (arr) => (arr || []).map(item =>
      typeof item === 'string'
        ? { text: item, energy: 'medium', breakdown: [] }
        : { breakdown: [], ...item }
    );

    return res.status(200).json({
      tasks: normalize(parsed.tasks),
      ideas: normalize(parsed.ideas),
      worries: normalize(parsed.worries),
      noise: normalize(parsed.noise)
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Server fout', detail: error.message });
  }
}
