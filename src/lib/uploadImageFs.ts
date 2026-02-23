// src/lib/uploadImage.ts
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "horses");

/**
 * Upload image to local filesystem
 * ✅ Replace this function body with AWS S3 logic later
 *    — same signature, same return (URL string)
 */
export async function uploadImageFs(
  file: Express.Multer.File,
): Promise<string> {
  // Ensure upload directory exists
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  // Generate unique filename
  const ext = file.mimetype.split("/")[1];
  const filename = `${crypto.randomUUID()}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  // Write file to disk
  await fs.writeFile(filepath, file.buffer);

  console.log("📁 [uploadImage] Saved to:", filepath);
  console.log("📁 [uploadImage] Size:", file.size, "bytes");

  // Return URL that can be accessed via Express static
  const url = `/uploads/horses/${filename}`;

  console.log("📁 [uploadImage] URL:", url);

  return url;

  // ──────────────────────────────────────────────────────
  // 🚀 AWS REPLACEMENT — swap the body above with this:
  // ──────────────────────────────────────────────────────
  //
  // import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
  //
  // const s3 = new S3Client({
  //   region: process.env.AWS_REGION!,
  //   credentials: {
  //     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  //     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  //   },
  // });
  //
  // const key = `horses/${crypto.randomUUID()}.${ext}`;
  //
  // await s3.send(new PutObjectCommand({
  //   Bucket: process.env.AWS_S3_BUCKET!,
  //   Key: key,
  //   Body: file.buffer,
  //   ContentType: file.mimetype,
  //   ACL: "public-read",
  // }));
  //
  // return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}
