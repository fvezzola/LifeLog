// Anthropic API calls — entry classification + taxonomy rebuild.

import { state, savePersist, CAT_COLORS } from './state.js';
import { toast, renderTaxonomyPills, renderLog, renderBrowseChips } from './ui.js';
import { pushTaxonomy } from './sync.js';

const MODEL = 'claude-sonnet-4-20250514';

export async function classify(text) {
  const recentContext = state.entries.slice(0, 5)
    .map(e => `[${e.category}] ${e.text.slice(0, 80)}`)
    .join('\n');

  const taxSummary = Object.entries(state.taxonomy)
    .map(([k, v]) => `"${k}": ${v.description} (${v.count} entries)`)
    .join('\n');

  const isEarlyStage = state.entries.length < 8;

  const prompt = `You are the intelligence layer for a private personal life-log. You maintain an EVOLVING category taxonomy — it grows and reshapes itself as you learn more about this person's life.

${taxSummary
  ? `CURRENT TAXONOMY (${Object.keys(state.taxonomy).length} categories):\n${taxSummary}`
  : 'TAXONOMY: Empty — this is the first entry. Create an appropriate category.'}

RECENT ENTRIES FOR CONTEXT:
${recentContext || 'None yet.'}

NEW ENTRY TO PROCESS:
"${text}"

RULES:
- Assign to the best existing category IF it's a clear fit.
- Create a new category only if no existing one fits well.
- Categories should be meaningful personal life domains, not one-off tags.
- ${isEarlyStage ? 'Early stage: lean toward creating new specific categories to build a rich taxonomy.' : 'Mature stage: prefer existing categories unless truly new domain appears.'}
- Be non-judgmental. All categories are valid personal data.
- Suggest a taxonomy optimization ONLY when you see a clear pattern (merge similar, rename vague, split overloaded category with 10+ entries).

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "category_key": "snake_case_key",
  "is_new": false,
  "new_category": null,
  "summary": "one sentence: what this entry is about",
  "tags": ["tag1", "tag2", "tag3"],
  "taxonomy_suggestion": null
}

If is_new is true, set new_category:
{ "name": "Display Name", "description": "what life domain this captures", "icon": "one emoji" }

If suggesting taxonomy optimization:
"taxonomy_suggestion": { "type": "merge|rename|split", "description": "plain english explanation", "from": "cat_key", "to": "new_name_or_target_key" }`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': state.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error?.message || `API ${resp.status}`);
  }

  const data = await resp.json();
  const raw  = data.content.map(c => c.text || '').join('').trim().replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

export async function reanalyzeTaxonomy() {
  if (!state.apiKey)        { toast('Set your API key first'); return; }
  if (!state.entries.length) { toast('No entries yet'); return; }

  toast('Re-analyzing taxonomy...');

  const sample = state.entries.slice(0, 60).map(e => e.text.slice(0, 150)).join('\n---\n');

  const prompt = `You are re-building the category taxonomy for a personal life-log. Below are the person's actual journal entries. Analyze them holistically and create the optimal category set.

ENTRIES:
${sample}

Create a taxonomy that:
- Reflects the actual themes in this person's life
- Has between 4 and 12 categories
- Uses specific, personal domain names (not generic like "miscellaneous")
- Groups naturally related concepts together

Respond ONLY with valid JSON array of category objects, no markdown:
[
  { "key": "snake_case", "name": "Display Name", "description": "what life domain this captures", "icon": "one emoji" }
]`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': state.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 800, messages: [{ role: 'user', content: prompt }] })
    });

    const data  = await resp.json();
    const raw   = data.content.map(c => c.text || '').join('').trim().replace(/```json|```/g, '').trim();
    const cats  = JSON.parse(raw);

    const newTax = {};
    const colorPool = [...CAT_COLORS];
    cats.forEach((c, i) => {
      newTax[c.key] = {
        name: c.name, description: c.description,
        icon: c.icon, color: colorPool[i % colorPool.length], count: 0
      };
    });

    state.taxonomy = newTax;
    state.entries.forEach(e => {
      if (state.taxonomy[e.category]) state.taxonomy[e.category].count++;
    });

    savePersist();
    pushTaxonomy();
    renderTaxonomyPills();
    renderLog();
    renderBrowseChips();
    toast('Taxonomy rebuilt ✓');

  } catch (e) {
    toast('Re-analyze failed: ' + e.message);
    console.error(e);
  }
}
