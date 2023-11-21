import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "dotenv";
config();

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.AWS_Endpoint,
  credentials: {
    accessKeyId: process.env.AWS_Access_Key_ID || "",
    secretAccessKey: process.env.AWS_SecretAccess_Key || "",
  },
});

const uploadProfileImage = async (user_Id: string, blob: Blob) => {
  if (!process.env.S3_ProfileData_Bucket) {
    throw new Error("S3_ProfileData_Bucket is not defined");
  }
  const Key = `${user_Id}.png`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_ProfileData_Bucket,
      Key,
      Body: blob,
      ContentType: "image/png",
    }),
  );
  return Key;
};

const getPostSignedURL = async (path: string, key: string, size: number) => {
  if (!process.env.S3_Assets_Bucket) {
    throw new Error("S3_ProfileData_Bucket is not defined");
  }
  //TODO: replace signedURL for post requests
  const expiration = new Date();
  expiration.setMinutes(expiration.getMinutes() + 10); //10 minutes
  return getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: process.env.S3_Assets_Bucket,
      Key: `${path}/${key}`,
    }),
    {
      expiresIn: 600,
    },
  );
};

export { uploadProfileImage, getPostSignedURL };
