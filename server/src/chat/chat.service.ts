/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { AssistantsService } from '../assistants/assistants.service';

export interface ChatQuestion {
    question: string;
    assistantId?: string;
    conversationId?: string;
}

export interface ChatAnswer {
    answer: string;
    sources?: string[];
}

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
    private readonly historyLimit = 6;

    constructor(
        private configService: ConfigService,
        private readonly assistantsService: AssistantsService
    ) { }

    private async createEmbedding(text: string): Promise<number[]> {
        try {
            const response = await axios.post(
                'https://api.openai.com/v1/embeddings',
                {
                    input: text,
                    model: 'text-embedding-3-small'
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.configService.get('OPENAI_API_KEY')}`
                    }
                }
            );

            return response.data.data[0].embedding;
        } catch (error) {
            console.error('Error creating embedding:', error);
            throw error;
        }
    }

    private async searchContext(vector: number[], className: string): Promise<any[]> {
        try {
            console.info('Searching context in ', className);

            // properties to get
            const properties = 'fileName fileId content'

            const response = await axios.post(
                `${this.configService.get('WEAVIATE_HOST')}/v1/graphql`,
                {
                    query: `
                    {
                        Get {
                            ${className} (
                                nearVector: {
                                    vector: ${JSON.stringify(vector)},
                                    certainty: 0.7
                                }
                                limit: 5
                            ) {
                                ${properties}
                                _additional {
                                    certainty
                                }
                            }
                        }
                    }
                    `
                }
            );

            console.info('DB response:', JSON.stringify(response.data, null, 2));
            console.info('----------------------------------------------------------');

            const responseData = response.data as { data?: { Get?: Record<string, any[]> } } | undefined;
            const results = responseData?.data?.Get?.[className] || [];

            // TODO: change response mapping
            if (results.length > 0) {
                return results.map(item => ({
                    text: item.content || '',
                    source: item.fileName || '',
                    _additional: item._additional
                }));
            } else {
                console.info('No results found in assistant files');
            }

            return results;
        } catch (error) {
            console.error('Error searching in Weaviate:', error);
            console.error('Error details:', error.response?.data || error.message);
            return [];
        }
    }

    private async condenseQuestion(conversationHistory: Message[], newQuestion: string): Promise<string> {
        try {
            const messages = [
                {
                    role: 'system',
                    content: `
                        You are a helpful assistant that rewrites the user's last question into a fully self-contained question. 
                        Use the conversation so far. The final question must stand alone.
                    `
                },
                ...conversationHistory.map(item => ({
                    role: item.role,
                    content: item.content
                })),
                {
                    role: 'user',
                    content: newQuestion
                }
            ];

            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4o-mini',
                    temperature: 0.0,
                    messages,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.configService.get('OPENAI_API_KEY')}`
                    }
                }
            );

            const condensedQuestion = response.data.choices[0].message.content.trim();
            console.info('User current question:', newQuestion);
            console.info('User condensed question:', condensedQuestion);
            console.info('----------------------------------------------------------');

            return condensedQuestion;
        } catch (error) {
            console.error('Error condensing question:', error);
            return newQuestion;
        }
    }

    async getAnswer(question: ChatQuestion): Promise<ChatAnswer> {
        try {
            const assistantId = question.assistantId;
            const userQuestion = question.question || "";
            const conversationId = question.conversationId || 'default';

            console.info('================= new question ===========================');
            console.info('question', question);
            console.info('assistantId', assistantId);
            console.info('conversationId', conversationId);
            console.info('----------------------------------------------------------');

            // initialize conversation history if not exists
            if (!this.conversationHistories[conversationId]) {
                this.conversationHistories[conversationId] = [];
            }

            // get conversation history
            let conversationHistory = this.conversationHistories[conversationId];

            // add user question to history
            conversationHistory.push({ role: 'user', content: userQuestion });

            // limit history if necessary
            if (conversationHistory.length > this.historyLimit) {
                conversationHistory = conversationHistory.slice(-this.historyLimit);
            }

            // update conversation history
            this.conversationHistories[conversationId] = conversationHistory;

            let context: string[] = [];
            let sources: string[] = [];
            let assistantPrompt = '';

            // get assistant prompt
            let assistant: any = null;
            if (assistantId) {
                try {
                    assistant = await this.assistantsService.findOne(assistantId);
                    if (assistant && assistant.prompt) {
                        assistantPrompt = assistant.prompt;
                    }
                } catch (assistantError) {
                    console.error('Error getting assistant:', assistantError);
                }
            }

            try {
                const searchQuery = (conversationHistory.length > 1)
                    ? await this.condenseQuestion(conversationHistory.slice(0, -1), userQuestion)
                    : userQuestion;

                const embedding = await this.createEmbedding(searchQuery);

                if (assistantId) {
                    // TODO: change to use the assistant id
                    const className = `AssistantFile_${assistantId.replaceAll('-', '_')}`;

                    const searchResults = await this.searchContext(embedding, className);

                    if (searchResults?.length > 0) {
                        context = searchResults.map(result => result.text);
                        sources = searchResults.map(result => result.source);
                    }
                }
            } catch (searchError) {
                console.error('Error searching in DB:', searchError);
            }

            // build messages
            const messages: Message[] = [
                {
                    role: 'system',
                    content: assistantPrompt || 'You are an AI assistant that answers questions in a helpful and concise manner.'
                }
            ];
        
            // add context
            if (context.length > 0) {
                messages.push({
                    role: 'system',
                    content: `Additional context from the knowledge base:\n${context.join('\n')}`,
                });
            }

            // add conversation history
            if (conversationHistory.length > 1) {
                const historicalMessages = conversationHistory.slice(0, -1); // exclude current question
                console.info('historicalMessages', historicalMessages);
                console.info('----------------------------------------------------------');
                messages.push(...historicalMessages);
            }

            // add user current question
            messages.push({ role: 'user', content: userQuestion });

            
            const body = {
                model: 'gpt-4o-mini',
                max_tokens: 600,
                temperature: 0.3,
                seed: 70,
                messages,
            }
            
            console.info(JSON.stringify(body, null, 2));
            console.info('--------- Final request ---------');

            const completion = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                body,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.configService.get('OPENAI_API_KEY')}`
                    },
                }
            );

            const answer = completion.data.choices[0].message.content;

            // add answer to history
            conversationHistory.push({ role: 'assistant', content: answer });

            // limit history if necessary
            if (conversationHistory.length > this.historyLimit) {
                conversationHistory = conversationHistory.slice(-this.historyLimit);
            }

            // update conversation history
            this.conversationHistories[conversationId] = conversationHistory;

            return {
                answer: answer,
                sources: sources.length > 0 ? [...new Set(sources)] : undefined
            };

        } catch (error) {
            console.error('Error in ChatService:', error);
            return {
                answer: 'Lo siento, ha ocurrido un error al procesar tu pregunta. Por favor, intenta de nuevo.'
            };
        }
    }
}
