import nodemailer from "nodemailer";

const mailTransporter = nodemailer.createTransport({
  host: "smtpout.secureserver.net",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 *
 * @param param.to Email address of recipient
 * @param param.subject Subject line of the Email
 * @param param.html HTML body of the email
 * @param param.sender Sender info @default sender Chit-Chat <${process.env.EMAIL_USERNAME}>
 * @returns
 */
const sendEmail = ({
  to,
  subject,
  sender = `Chit-Chat <${process.env.EMAIL_USERNAME}>`,
  html,
}: {
  to: string;
  subject: string;
  sender?: string;
  html: string;
}) => {
  return mailTransporter.sendMail({
    from: sender,
    to,
    subject,
    html,
  });
};

export default sendEmail;
