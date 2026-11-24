/**
 * GEMINI AI SERVICE
 * Optional generative answers for circular / banking queries that the
 * rule-based engine does not recognise.
 *
 * Enabled only when GEMINI_API_KEY is set. Model can be changed with
 * GEMINI_MODEL (default: gemini-2.5-flash). Any failure returns null so the
 * caller falls back to the existing rule-based answer.
 */

const DEFAULT_MODEL = 'gemini-2.5-flash';
const TIMEOUT_MS = 25000;

let client = null;

function isGeminiEnabled() {
    return !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
}

function getModelName() {
    return (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
}

function getClient() {
    if (client) return client;
    const { GoogleGenAI } = require('@google/genai');
    client = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY.trim(),
        httpOptions: { timeout: TIMEOUT_MS }
    });
    return client;
}

const SYSTEM_INSTRUCTION = `You are the credit appraisal assistant of a Punjab National Bank loan appraisal portal.
Rules:
1. Answer ONLY what the user asked. No generic overviews.
2. Ground every answer in the circular context supplied. Never invent circular numbers, paragraphs, rates or limits.
3. Start the answer with a citation line exactly in this form:
   > 📜 **Official Circular Authority & Quoted Para:** <Circular Number, Section/Para, quoted text>
   If the supplied context does not contain the governing clause, say so in that line and advise the officer to verify against the original circular.
4. Reply in the same language/script the user used (Hindi, Hinglish or English). Use Markdown.
5. Return exactly 3 short follow-up questions the officer could tap next.`;

const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        response: { type: 'string', description: 'Markdown answer including the citation line' },
        suggestions: {
            type: 'array',
            items: { type: 'string' },
            minItems: 3,
            maxItems: 3
        }
    },
    required: ['response', 'suggestions']
};

function buildContext(userQuery, circulars = [], knowledgeBase = null) {
    const lines = [];
    if (circulars.length) {
        lines.push('Relevant circulars from the bank library (metadata only):');
        circulars.slice(0, 10).forEach((c, i) => {
            lines.push(`${i + 1}. ${c.division} Circular ${c.num}/${c.year} dated ${c.date} - ${c.subject} [${c.status}]`);
        });
    } else {
        lines.push('No matching circulars were found in the bank library for this query.');
    }
    if (knowledgeBase) {
        lines.push('', 'Bank knowledge base (JSON):', JSON.stringify(knowledgeBase).slice(0, 12000));
    }
    lines.push('', `Officer's question: ${userQuery}`);
    return lines.join('\n');
}

/**
 * Ask Gemini. Returns { response, suggestions, model } or null.
 */
async function askGemini(userQuery, { circulars = [], knowledgeBase = null } = {}) {
    if (!isGeminiEnabled() || !userQuery || !userQuery.trim()) return null;
    try {
        const model = getModelName();
        const result = await getClient().models.generateContent({
            model,
            contents: buildContext(userQuery, circulars, knowledgeBase),
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.2,
                responseMimeType: 'application/json',
                responseJsonSchema: RESPONSE_SCHEMA
            }
        });
        const parsed = JSON.parse(result.text || '{}');
        if (!parsed.response || typeof parsed.response !== 'string') return null;
        const suggestions = Array.isArray(parsed.suggestions)
            ? parsed.suggestions.filter(s => typeof s === 'string' && s.trim()).slice(0, 3)
            : [];
        return { response: parsed.response, suggestions, model };
    } catch (err) {
        console.error('Gemini query failed, using rule-based fallback:', err.message);
        return null;
    }
}

module.exports = { askGemini, isGeminiEnabled, getModelName };
