import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ChatService, ChatQuestion, ChatAnswer } from './chat.service';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @Post()
    async getAnswer(@Body() question: ChatQuestion): Promise<ChatAnswer> {
        // Validar que la pregunta no sea vacía
        if (!question.question || question.question.trim() === '') {
            throw new BadRequestException('La pregunta no puede estar vacía');
        }
        
        return this.chatService.getAnswer(question);
    }
}
