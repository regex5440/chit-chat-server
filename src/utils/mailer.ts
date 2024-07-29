/**
 *
 * @param param.to Email address of recipient
 * @param param.subject Subject line of the Email
 * @param param.html HTML body of the email
 * @returns
 */
const sendEmail = ({ to, subject, html }: { to: string; subject: string; sender?: string; html: string }) => {
  return fetch(process.env.EMAIL_SERVICE_URL as string, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.EMAIL_SERVICE_TOKEN}`,
    },
    body: JSON.stringify({
      fromService: "Chit-Chat",
      toEmail: to,
      subject,
      html,
    }),
  });
};

export default sendEmail;
