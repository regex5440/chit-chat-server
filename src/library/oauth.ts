import { config } from "dotenv";
import { OAuth2Client } from "google-auth-library";
config();

const client = new OAuth2Client();

export default function verifyGoogleToken(credential: string) {
  return client.verifyIdToken({
    idToken: credential,
    audience: process.env.OAuth_ID,
  });
}
