// utils/sendEmail.js
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
  try {
    await resend.emails.send({
        from: "Your App <onboarding@resend.dev>",
        to,
        subject,
        html,
    });
  } catch (error) {
    console.error("Email gagal dikirim:", error);
    throw new Error("Gagal kirim email");
  }
};

module.exports = sendEmail;
