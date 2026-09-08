import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:4200',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta propiedades no declaradas en los DTO
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Documentacion interactiva de la API en http://localhost:3000/api/docs
  const config = new DocumentBuilder()
    .setTitle('Dashboard de Seguimiento Academico y Alertas Tempranas')
    .setDescription(
      'API del sistema de monitoreo academico y deteccion temprana de riesgo de desercion.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const puerto = process.env.PORT ?? 3000;
  await app.listen(puerto);
  console.log(`API disponible en http://localhost:${puerto}/api`);
  console.log(`Documentacion en  http://localhost:${puerto}/api/docs`);
}

await bootstrap();
