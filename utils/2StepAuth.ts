import nodemailer from "nodemailer";
const OTPAuth:
  | {
      [key: string]: number[];
    }
  | {} = {};

const mailTransporter = nodemailer.createTransport({
  host: "smtpout.secureserver.net",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});
const sendOTPMail = (email: string, otp: number) => {
  return mailTransporter.sendMail({
    from: "Chit-Chat <harshdagar@hdxdev.in>",
    to: email,
    subject: ("Test OTP:" + otp) as string,
    text: "Hi there",
    html: '<div style="width: 50%;aspect-ratio: 1/1,border: 1px solid blue">BIG BOX</div>',
  });
};

const provideOTPAuth = async (emailAddress: string) => {
  if (!OTPAuth[emailAddress] || OTPAuth[emailAddress].length < 5) {
    const newOTP = Math.trunc(Math.random() * 1000000);
    const info = await sendOTPMail(emailAddress, newOTP);
    console.log(info);
    if (info?.messageId) {
      if (!OTPAuth[emailAddress]) {
        OTPAuth[emailAddress] = [newOTP];
      } else {
        OTPAuth[emailAddress].push(newOTP);
      }
      return { created: true };
    }
    return { created: false, message: "Email not send!" };
  }
  return {
    created: false,
    message: "Tried too many times!",
  };
};
const verifyOTPAuth = (emailAddress: string, otp: number) => {
  if (OTPAuth[emailAddress]?.includes(otp)) {
    delete OTPAuth[emailAddress];
    return { valid: true };
  }
  return { valid: false };
};

export { provideOTPAuth, verifyOTPAuth };
