
import { GoogleGenAI, Type } from "@google/genai";

export const config = {
    runtime: 'edge',
};

// 重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 初始等待2秒

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 判断是否为可重试的错误
const isRetryableError = (error: any): boolean => {
    const message = error?.message?.toLowerCase() || '';
    const status = error?.status || error?.code;

    // 429 限流错误、503 服务不可用、500 内部错误都可以重试
    if (status === 429 || status === 503 || status === 500) return true;
    if (message.includes('rate limit') || message.includes('quota')) return true;
    if (message.includes('overloaded') || message.includes('temporarily')) return true;
    if (message.includes('resource exhausted')) return true;

    return false;
};

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { prompt, images, task } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });

        // Prepare image parts
        const parts = [
            ...(images || []).map((img: any) => ({
                inlineData: {
                    data: img.data.includes(',') ? img.data.split(',')[1] : img.data,
                    mimeType: img.mimeType
                }
            })),
            { text: prompt }
        ];

        let result;
        let lastError: any = null;

        // 带重试的API调用
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`[Gemini API] Attempt ${attempt}/${MAX_RETRIES} for task: ${task}`);

                if (task === 'image') {
                    // Generate Image
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-image',
                        contents: { parts },
                        config: {
                            responseModalities: ["IMAGE"],
                        }
                    });

                    const part = response.candidates?.[0]?.content?.parts?.[0];
                    if (part && part.inlineData) {
                        result = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    } else {
                        throw new Error("No image generated");
                    }

                } else if (task === 'validate') {
                    // 验证图片内容（简单快速的检测）
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.0-flash',
                        contents: { parts },
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: Type.OBJECT,
                                properties: {
                                    hasFace: { type: Type.BOOLEAN },
                                    hasTongue: { type: Type.BOOLEAN }
                                }
                            }
                        }
                    });

                    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
                    result = JSON.parse(text || "{}");

                } else {
                    // Analyze Text/JSON
                    const response = await ai.models.generateContent({
                        model: 'gemini-3-flash-preview',
                        contents: { parts },
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    score: { type: Type.NUMBER },
                                    content: { type: Type.STRING },
                                    advice: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING }
                                    }
                                },
                                required: ["title", "content"]
                            }
                        }
                    });

                    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
                    result = JSON.parse(text || "{}");
                }

                // 成功，跳出重试循环
                console.log(`[Gemini API] Success on attempt ${attempt}`);
                break;

            } catch (error: any) {
                lastError = error;
                console.error(`[Gemini API] Attempt ${attempt} failed:`, error.message);

                // 如果是最后一次尝试或不可重试的错误，直接抛出
                if (attempt === MAX_RETRIES || !isRetryableError(error)) {
                    throw error;
                }

                // 指数退避等待
                const waitTime = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                console.log(`[Gemini API] Waiting ${waitTime}ms before retry...`);
                await delay(waitTime);
            }
        }

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });

    } catch (error: any) {
        console.error('API Error:', error);

        // 返回更友好的错误信息
        let errorMessage = 'AI Service Error';
        if (error.message?.includes('rate limit') || error.message?.includes('quota') || error.message?.includes('resource exhausted')) {
            errorMessage = 'AI服务繁忙，请稍后再试';
        } else if (error.message?.includes('timeout')) {
            errorMessage = 'AI服务响应超时，请重试';
        }

        return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
    }
}
