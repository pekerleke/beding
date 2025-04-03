/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/restrict-template-expressions */

import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ConversationHistory {
    [conversationId: string]: Message[];
}

@Injectable()
export class ChatService {
    private conversationHistories: ConversationHistory = {};

    constructor(private configService: ConfigService) { }

    private async embed(text: string) {
        const res = await axios.post(
            'https://api.openai.com/v1/embeddings',
            { input: text, model: 'text-embedding-ada-002' },
            { headers: { Authorization: `Bearer ${this.configService.get('OPENAI_API_KEY')}` } },
        );
        const response = res.data as { data: Array<{ embedding: number[] }> };
        return response.data[0].embedding;
    }

    private async getContext(query: string) {
        const vector = await this.embed(query);
        const res = await axios.post(`${this.configService.get('WEAVIATE_HOST')}/v1/graphql`, {
            query: `{
                Get {
                    ${this.configService.get('CLASS_NAME')}(
                        nearVector: {vector: [${vector}], certainty: 0.7},
                        limit: 4
                    ) {
                        text
                        source
                        _additional {
                            certainty
                        }
                    }
                }
            }`,
        });

        const data = res.data?.data?.Get?.[this.configService.get('CLASS_NAME')] || [];
        console.info('--------- Embeddings ---------');
        console.info(JSON.stringify(data, null, 2));

        return data;
    }

    private async condenseQuestion(conversationHistory: Message[], newQuestion: string) {
        const messages = [
            {
                role: 'system',
                content: `
                    You are a helpful assistant that rewrites the user's last question into a fully self-contained question. 
                    Use the conversation so far. The final question must stand alone. 
                `,
            },
            ...conversationHistory.map((item) => ({
                role: item.role,
                content: item.content,
            })),
            {
                role: 'user',
                content: newQuestion,
            },
        ];

        const response = await axios.post<any>(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                temperature: 0.0,
                messages,
            },
            { headers: { Authorization: `Bearer ${this.configService.get('OPENAI_API_KEY')}` } },
        );

        const condensed = response.data.choices[0].message.content.trim();
        console.info('--------- Condensed question ---------');
        console.info(condensed);

        return condensed;
    }

    async chat(question: string, conversationId: string) {
        if (!question || !conversationId) {
            throw new Error('Missing question or conversationId');
        }

        if (!this.conversationHistories[conversationId]) {
            this.conversationHistories[conversationId] = [];
        }

        let conversationHistory = this.conversationHistories[conversationId];
        conversationHistory.push({ role: 'user', content: question });

        const historyLimit = 6;
        if (conversationHistory.length > historyLimit) {
            conversationHistory = conversationHistory.slice(-historyLimit);
        }

        this.conversationHistories[conversationId] = conversationHistory;

        let context;
        if (this.conversationHistories[conversationId].length === 1) {
            context = await this.getContext(question);
        } else {
            const condensedQuestion = await this.condenseQuestion(conversationHistory, question);
            context = await this.getContext(condensedQuestion);
        }

        const messages = [
            {
                role: 'system',
                content: `
                    You are a helpful assistant working for Sarasa Inc. 
                    Use the conversation history and the provided context to give the most accurate answer you can. 
                    Do not fabricate information. If the question is ambiguous, ask for clarification. 
                    Your final answer should be in Spanish.
                `,
            },
            ...(conversationHistory.length > 1
                ? conversationHistory.map((item) => ({
                    role: item.role,
                    content: item.content,
                }))
                : []),
            {
                role: 'system',
                content: `Additional context from the knowledge base:\n${context.map((r) => r.text).join('\n')}`,
            },
            {
                role: 'user',
                content: question,
            },
        ];

        const body = {
            model: 'gpt-4',
            max_tokens: 600,
            temperature: 0.3,
            seed: 70,
            messages,
        };

        console.info('--------- Request body (final) ---------');
        console.info(JSON.stringify(body, null, 2));

        const completion = await axios.post('https://api.openai.com/v1/chat/completions', body, {
            headers: { Authorization: `Bearer ${this.configService.get('OPENAI_API_KEY')}` },
        });

        const answer = completion.data.choices[0].message.content;

        conversationHistory.push({ role: 'assistant', content: answer });
        if (conversationHistory.length > historyLimit) {
            conversationHistory = conversationHistory.slice(-historyLimit);
        }

        this.conversationHistories[conversationId] = conversationHistory;

        return { answer, sources: context };
    }
}
