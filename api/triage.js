export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Geen tekst' });

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
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Je bent een ADHD-coach voor een jonge Belgische solopreneur. Analyseer zijn gedachtestroom zonder oordeel.

Gedachtestroom: "${text}"

Geef ALLEEN geldig JSON terug, geen markdown, geen uitleg, geen tekst erbuiten:
{
  "tasks": [
    {
      "text": "concrete actie als werkwoord + object, max 8 woorden",
      "energy": "high|medium|low",
      "urgency": "urgent|not-urgent",
      "importance": "important|not-important",
      "duration": 30,
      "breakdown": ["concrete stap 1", "concrete stap 2", "concrete stap 3"]
    }
  ],
  "ideas": [
    {
      "text": "idee omschrijving",
      "subcategory": "dynamisch bepaald label zoals: Startup idee, Workflow optimalisatie, Tool idee, Business model, Content idee, Automatisering, Persoonlijke groei, etc.",
      "potential": "high|medium|low",
      "importance": "high|medium|low"
    }
  ],
  "worries": [{ "text": "zorg of emotie" }],
  "noise": [{ "text": "irrelevante gedachte" }]
}

Strikte regels:
- TASKS: Altijd werkwoord + object. ALLEEN concrete, uitvoerbare acties.
- TASKS: Abstracte taken (leren, onderzoeken, zoeken, uitwerken) ALTIJD opdelen via breakdown in 3-5 concrete stappen van max 15 min elk. De task zelf blijft abstract als label, de breakdown maakt het concreet.
- TASKS: urgency = urgent als het deze week of volgende week moet. importance = important als het directe impact heeft op doelen of inkomen.
- TASKS: duration in minuten: 15, 30, 45, 60, 90. Schat realistisch.
- TASKS: energy: high = diep denkwerk, schrijven, plannen, calls. low = routine, lezen, organiseren. medium = alles daartussen.
- IDEAS: Subcategory dynamisch bepalen op basis van de inhoud van het idee. Wees specifiek (niet gewoon "Idee").
- IDEAS: potential = inschatting haalbaarheid + impact combined.
- WORRIES: Worden erkend, nooit opgelost of voorzien van actie.
- NOISE: Mentale ruis, irrelevante gedachten, niet-actioneerbare observaties.
- Max 5 items per categorie voor overzicht.
- Splits gecombineerde gedachten altijd op in aparte items.`
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', data);
      return res.status(500).json({ error: 'AI fout' });
    }

    const raw = data.content
      .map(i => i.text || '')
      .join('')
      .replace(/```json|```/g, '')
      .trim();

    const parsed = JSON.parse(raw);

    const norm = (arr, defaults) => (arr || []).map(item =>
      typeof item === 'string'
        ? { text: item, ...defaults }
        : { ...defaults, ...item }
    );

    return res.status(200).json({
      tasks: norm(parsed.tasks, { energy: 'medium', urgency: 'not-urgent', importance: 'not-important', duration: 30, breakdown: [] }),
      ideas: norm(parsed.ideas, { subcategory: 'Overig', potential: 'medium', importance: 'medium' }),
      worries: norm(parsed.worries, {}),
      noise: norm(parsed.noise, {})
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Server fout', detail: error.message });
  }
}
