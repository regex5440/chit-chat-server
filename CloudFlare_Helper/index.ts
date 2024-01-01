import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "dotenv";
config();

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.AWS_Endpoint,
  credentials: {
    accessKeyId: process.env.AWS_Access_KeyID || "",
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
/**
 *
 * @param key Name of the file to store on bucket, may include path
 * @param mediaType Type of the file this file is going to be used @default attachment
 * @param expiry Minutes to expire the link @default 5 mins
 * @returns
 */
const getPostSignedURL = async (key: string, mediaType: "attachment" | "profileImage" = "attachment", expiry: number = 5) => {
  if (!process.env.S3_Assets_Bucket) {
    throw new Error("S3_ProfileData_Bucket is not defined");
  }
  if (!process.env.S3_ProfileData_Bucket) {
    throw new Error("S3_ProfileData_Bucket is not defined");
  }
  //TODO: replace signedURL for post requests
  const expiration = new Date();
  expiration.setMinutes(expiration.getMinutes() + 10); //10 minutes
  return getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: mediaType === "attachment" ? process.env.S3_Assets_Bucket : process.env.S3_ProfileData_Bucket,
      Key: key,
    }),
    {
      expiresIn: 600,
    },
  );
};

const removeDirectory = async (dir: string) => {
  const Bucket = process.env.S3_Assets_Bucket;
  if (!Bucket) return;
  const listedObjects = await s3Client.send(new ListObjectsV2Command({ Bucket }));

  if (!listedObjects.Contents || listedObjects.Contents.length === 0) return;
  const x = await Promise.all(
    listedObjects.Contents.map((object) =>
      s3Client.send(
        new DeleteObjectCommand({
          Bucket,
          Key: `${dir}/${object.Key}`,
        }),
      ),
    ),
  );
  if (listedObjects.IsTruncated) {
    await removeDirectory(dir);
  }
  return x;
};

const removeAsset = async (keys: string[]) => {
  const Bucket = process.env.S3_Assets_Bucket;
  if (!Bucket) return;
  return Promise.all(keys.map((k) => s3Client.send(new DeleteObjectCommand({ Bucket, Key: k }))));
};

export { uploadProfileImage, getPostSignedURL, removeDirectory, removeAsset };
