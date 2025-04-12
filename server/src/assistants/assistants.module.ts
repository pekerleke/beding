import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssistantsController } from './assistants.controller';
import { AssistantsService } from './assistants.service';

@Module({
  imports: [ConfigModule],
  controllers: [AssistantsController],
  providers: [AssistantsService],
  exports: [AssistantsService],
})
export class AssistantsModule {} 