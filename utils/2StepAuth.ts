import { config } from "dotenv";
import sendEmail from "./mailer";
config();
const OTPAuth: {
  [ip_address: string]: {
    code_list: Set<number>;
    forEmail: string;
    lastRequest: Date;
  };
} = {};
//TODO: Use redis to perform OTP Authentication rather than global variable

const sendOTPMail = async (email: string, otp: number) => {
  return sendEmail({
    to: email,
    subject: "One-Time Password for Email Verification",

    html: `
    <div style="font-family: Arial, sans-serif;background-color: #f5f5f5;margin: 0;padding: 0;display: flex;justify-content: center;align-items: center;height: 600px;margin: auto;">

    <div style="padding: 20px 20px 40px 20px;border-radius: 8px;box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);max-width: 400px;width: 100%;background: linear-gradient(-45deg, #00bdff6f, #00288119 51px, #00bdff6f); box-sizing: border-box; margin: auto;" id="container-body-chit-chat-verification">
<style>
@import url("https://fonts.googleapis.com/css2?family=Moirai+One&display=swap");
    #container-body-chit-chat-verification > *:not(h1,code){
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
</style>
        <img alt="Chit Chat" style="display: block;margin: 0 auto;text-align: center;mix-blend-mode:color-burn; max-width: 100%;" src=${process.env.App_Logo}/>
        <h2 style="color: #00287f;margin-bottom: 20px;text-decoration: underline;text-underline-position: under;">Email Authentication</h2>
        <p style="color: #555; line-height: 1.6;">Hi there!</p>
        <p style="color: #555; line-height: 1.6;">Your One-Time Password (OTP) for email verification is: <code style="color: #00287f;text-align: center;display: block;font-size: 32px;margin-top: 10px;letter-spacing: 25px;">${otp}</code></p>
        <p style="color: #555; line-height: 1.6;">Please use this OTP to complete your email verification process.</p>
        <p style="color: #5f5f5f;line-height: 1.6;font-size: 14px;font-style: italic;">If you didn't request this verification, you can ignore this email.</p>
        
        
    </div>

</div>
    `,
  });
};
const provideOTPAuth = async (emailAddress: string, resend: boolean | null, ip_address: string) => {
  OTPAuthCleaner();
  if (OTPAuth[ip_address]?.code_list.size >= 5) {
    return {
      created: false,
      message: "Tried too many times! Please try later",
    };
  } else if (resend || OTPAuth[ip_address] === undefined) {
    const newOTP = Math.trunc(Math.random() * 1000000);
    const info = await sendOTPMail(emailAddress, newOTP).then((res) => res.json());
    if (info?.message === "Queued") {
      if (!OTPAuth[ip_address]) {
        OTPAuth[ip_address] = {
          code_list: new Set([newOTP]),
          forEmail: emailAddress,
          lastRequest: new Date(),
        };
      } else {
        OTPAuth[ip_address].code_list.add(newOTP);
        OTPAuth[ip_address].lastRequest = new Date();
      }
      return { created: true };
    }
  } else if (OTPAuth[ip_address]) {
    return { exists: true };
  }
  return { created: false, message: "Something is wrong on our side!" };
};
const verifyOTPAuth = (emailAddress: string, otp: number, ip_address: string) => {
  if (OTPAuth[ip_address]?.forEmail === emailAddress && OTPAuth[ip_address]?.code_list.has(otp)) {
    delete OTPAuth[ip_address];
    return { valid: true };
  }
  return { valid: false };
};

function OTPAuthCleaner() {
  for (const key in OTPAuth) {
    if (OTPAuth[key].lastRequest.getTime() <= new Date().getTime() - 86400000) {
      delete OTPAuth[key];
    }
  }
}

export { provideOTPAuth, verifyOTPAuth };
