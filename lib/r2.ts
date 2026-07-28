import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export interface R2Client {
  publicUrl: string;
  uploadFile(key: string, buffer: Buffer, contentType: string): Promise<string>;
  deleteFile(key: string): Promise<void>;
}

/** Builds an R2-backed client from any set of credentials — the operator's own (below) or a BYOC user's (see lib/byoc.ts). */
export function createR2Client(config: R2Config): R2Client {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    publicUrl: config.publicUrl,

    async uploadFile(key, buffer, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      // Use the public development URL (or custom domain if configured)
      const publicBase = config.publicUrl.replace(/\/$/, "");
      return `${publicBase}/${key}`;
    },

    async deleteFile(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }));
    },
  };
}

export const operatorR2Client = createR2Client({
  accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID!,
  accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
  publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL!,
});

export const uploadFile = operatorR2Client.uploadFile;
export const deleteFile = operatorR2Client.deleteFile;
