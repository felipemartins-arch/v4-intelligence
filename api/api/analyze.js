module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY nao configurada.' });

  const { url, spiced, competitors } = req.body || {};
  if (!url || !spiced) return res.status(400).json({ error: 'Campos obrigatorios: url e spiced.' });

  const systemPrompt = 'Voce e um analista senior de inteligencia de mercado da V4 Company, especializado no mercado brasileiro de marketing digital e performance.\n\nSua tarefa e analisar um prospect com base no diagnostico SPICED fornecido e na URL do site, e retornar um relatorio completo de inteligencia de mercado.\n\nDiretrizes:\n- Use conhecimento profundo sobre o mercado brasileiro: benchmarks de CPL, CPA, CPC por segmento, TAM/SAM/SOM por vertical no Brasil\n- Considere o ecossistema de marketing digital brasileiro (Meta Ads, Google Ads, TikTok, etc.)\n- Seja especifico e acionavel - evite generalidades\n- Todos os valores monetarios em BRL (R$)\n- Baseie estimativas em dados reais de mercado brasileiro de 2024-2025\n\nRETORNE APENAS um JSON valido, sem nenhum texto antes ou depois, sem markdown.\n\nO JSON deve ter exatamente as chaves: company, segment, exec (tam, digital_maturity, media_status, competitors_count, score, main_opportunity, main_risk, v4_angle), tam (tam_val, tam_desc, sam_val, sam_desc, som_val, som_desc, growth, growth_driver, methodology), competitors (array com name, url, presence, positioning, tone, channels, ads_active, traffic_est, strengths, weaknesses), solutions (insight, direct, indirect - cada item com name/desc/limit), jtbd (main_job, functional, emotional, social), differentials (vs_market, real, potential, v4_opportunity), icp (company_size, segment, revenue, geography, trigger, persona_name, persona_role, persona_age, persona_pains, persona_goals, persona_channels, committee com role/type/concern), four_ps (product, price, place, promotion), puv (statement, tagline, rationale), media (status, meta_active, meta_spend_est, meta_analysis, google_active, google_keywords, google_analysis, competitors_media, benchmark_cpl, benchmark_cpa, recommendation, action_plan), creatives (quality_level, visual_analysis, copy_analysis, social_freq, social_engagement, bio_analysis, gaps, recommendations), cro (site_structure, ux_analysis, copy_clarity, cta_analysis, journey_gaps, priority_fixes), copy_narrative (current_tone, ideal_tone, main_gap, gaps com dimension/current/ideal/severity).';

  const userMessage = 'Analise o seguinte prospect e gere o relatorio completo:\n\nURL: ' + url + '\n\nConcorrentes: ' + (competitors || 'Nao informado') + '\n\nSPICED:\n' + spiced + '\n\nGere o JSON completo com todas as secoes preenchidas de forma detalhada para este prospect no mercado brasileiro.';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'Erro na API Anthropic: ' + response.status + ' - ' + errText });
    }

    const anthropicData = await response.json();
    const rawContent = anthropicData && anthropicData.content && anthropicData.content[0] ? anthropicData.content[0].text : '';

    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'A IA nao retornou JSON valido.', raw: rawContent.substring(0, 500) });

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      const cleaned = jsonMatch[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      try { parsed = JSON.parse(cleaned); }
      catch (e2) { return res.status(500).json({ error: 'Falha ao parsear JSON.', raw: rawContent.substring(0, 500) }); }
    }

    return res.status(200).json({ success: true, data: parsed });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
};
