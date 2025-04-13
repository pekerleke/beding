import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.enableCors({
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type'],
    });

    const port = 9290;
    await app.listen(port);
    console.info(`🚀 Server running on http://localhost:${port}`);
    console.info(`📝 API of assistants available at http://localhost:${port}/assistants`);
}
void bootstrap();
