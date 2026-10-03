const axios = require('axios');

const DEFAULT_OPENAI_RESPONSES_MODEL = 'gpt-6-luna';
const RESPONSES_URL = 'https://api.openai.com/v1/responses';

class AIServiceError extends Error {
    constructor(message, code, status = 502) {
        super(message);
        this.name = 'AIServiceError';
        this.code = code;
        this.status = status;
    }
}

function resolveOpenAIModel() {
    return process.env.OPENAI_RESPONSES_MODEL?.trim() || DEFAULT_OPENAI_RESPONSES_MODEL;
}

function isOpenAIConfigured() {
    const key = process.env.OPENAI_API_KEY?.trim();
    return Boolean(key && !/^your[-_]/i.test(key));
}

function extractOutputText(response) {
    if (response?.status !== 'completed') {
        throw new AIServiceError('AI 응답이 완료되지 않았습니다. 다시 시도해주세요.', 'INCOMPLETE_RESPONSE');
    }

    // Reasoning and tool items can precede assistant messages in Responses output.
    const content = (Array.isArray(response.output) ? response.output : [])
        .filter(item => item.type === 'message' && item.role === 'assistant')
        .flatMap(item => Array.isArray(item.content) ? item.content : []);
    if (content.some(part => part.type === 'refusal')) {
        throw new AIServiceError('AI가 요청에 대한 답변을 제공하지 못했습니다.', 'RESPONSE_REFUSED');
    }
    const text = content
        .filter(part => part.type === 'output_text' && typeof part.text === 'string')
        .map(part => part.text)
        .join('')
        .trim();
    if (!text) {
        throw new AIServiceError('AI 응답에 내용이 없습니다. 다시 시도해주세요.', 'EMPTY_RESPONSE');
    }
    return text;
}

async function generateText(prompt, { signal, timeout = 60000, maxOutputTokens = 16384, json = false, schema, schemaName = 'result', instructions, model: modelOverride, includeUsage = false } = {}) {
    if (!isOpenAIConfigured()) {
        throw new AIServiceError('AI 서비스가 설정되지 않았습니다.', 'AI_NOT_CONFIGURED', 503);
    }
    if (typeof prompt !== 'string' || !prompt.trim()) {
        throw new AIServiceError('유효한 프롬프트가 필요합니다.', 'INVALID_PROMPT', 400);
    }

    const model = modelOverride || resolveOpenAIModel();
    try {
        const { data } = await axios.post(RESPONSES_URL, {
            model,
            input: prompt,
            ...(instructions ? { instructions } : {}),
            reasoning: { effort: 'none' },
            store: false,
            max_output_tokens: maxOutputTokens,
            ...(schema ? { text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } } }
                : json ? { text: { format: { type: 'json_object' } } } : {}),
        }, {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
                'Content-Type': 'application/json',
            },
            signal,
            timeout,
        });
        return { text: extractOutputText(data), model: data.model || model,
            ...(includeUsage ? { usage: data.usage || null } : {}) };
    } catch (error) {
        if (error instanceof AIServiceError) throw error;
        if (signal?.aborted || ['ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED'].includes(error.code)) {
            throw new AIServiceError('AI 요청 시간이 초과되었거나 취소되었습니다.', 'AI_TIMEOUT', 504);
        }
        if (error.response?.status === 429) {
            throw new AIServiceError('AI 요청이 많습니다. 잠시 후 다시 시도해주세요.', 'AI_RATE_LIMITED', 429);
        }
        // Never forward provider payloads, request headers, or prompts to clients/logs.
        throw new AIServiceError('AI 서비스 호출에 실패했습니다. 잠시 후 다시 시도해주세요.', 'AI_UNAVAILABLE');
    }
}

module.exports = { generateText, resolveOpenAIModel, isOpenAIConfigured, AIServiceError };
