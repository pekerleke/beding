import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AssistantsModule } from '../assistants/assistants.module';

@Module({
    imports: [ConfigModule, AssistantsModule],
    controllers: [ChatController],
    providers: [ChatService],
})
export class ChatModule { }
