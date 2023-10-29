import { S3 } from "aws-sdk";
import { config } from "dotenv";
config();

const s3 = new S3({
  endpoint: process.env.AWS_Endpoint,
  accessKeyId: process.env.AWS_Access_Key_ID,
  secretAccessKey: process.env.AWS_SecretAccess_Key,
  signatureVersion: "v4",
});

const uploadProfileImage = async (user_Id: string, blob: Blob) => {
  if (!process.env.S3_ProfileData_Bucket) {
    throw new Error("S3_ProfileData_Bucket is not defined");
  }
  return s3
    .upload({
      Bucket: process.env.S3_ProfileData_Bucket,
      Key: `${user_Id}.png`,
      Body: blob,
      ContentType: "image/png",
      ACL: "public-read",
    })
    .promise();
};

export { uploadProfileImage };
