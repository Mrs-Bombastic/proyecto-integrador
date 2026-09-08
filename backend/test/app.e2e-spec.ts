import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/salud responde sin autenticacion', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/salud')
      .expect(200);

    expect(respuesta.body.estado).toBe('ok');
  });

  it('GET /api/auth/perfil exige token', () => {
    return request(app.getHttpServer()).get('/api/auth/perfil').expect(401);
  });
});
