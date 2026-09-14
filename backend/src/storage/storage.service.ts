import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.getOrThrow<string>('DO_SPACES_REGION');
    const endpoint = this.configService.getOrThrow<string>('DO_SPACES_ENDPOINT');
    this.bucket = this.configService.getOrThrow<string>('DO_SPACES_BUCKET');
    this.publicBaseUrl = `https://${this.bucket}.${region}.digitaloceanspaces.com`;

    this.client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('DO_SPACES_KEY'),
        secretAccessKey: this.configService.getOrThrow<string>('DO_SPACES_SECRET'),
      },
      forcePathStyle: false,
    });
  }

  async enviarCriativo(
    clienteId: string,
    arquivo: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    const extensao = arquivo.originalname.split('.').pop() ?? 'bin';
    const chave = `criativos/${clienteId}/${randomUUID()}.${extensao}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: chave,
        Body: arquivo.buffer,
        ContentType: arquivo.mimetype,
        ACL: 'public-read',
      }),
    );

    return {
      url: `${this.publicBaseUrl}/${chave}`,
      chave,
    };
  }
}
