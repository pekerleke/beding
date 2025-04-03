import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Post()
    async chat(@Body() body: { message: string; conversationId: string }) {
        return this.chatService.chat(body.message, body.conversationId);
    }
}
