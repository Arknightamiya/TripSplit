import nodemailer from "nodemailer";

const sentVerificationCodes = new Map();

export async function sendRegistrationVerificationEmail({ email, code, expiresInMinutes = 5 }) {
  sentVerificationCodes.set(normalizeEmail(email), code);

  if (!shouldSendSmtpEmail()) {
    if (process.env.NODE_ENV !== "test") {
      console.log(`[TripSplit] Verification code for ${email}: ${code}`);
    }
    return { delivered: false, mode: "console" };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: "Your TripSplit verification code",
    text: [
      `Your TripSplit verification code is ${code}.`,
      `This code expires in ${expiresInMinutes} minutes.`,
      "If you did not request this, you can ignore this email."
    ].join("\n"),
    html: `
      <p>Your TripSplit verification code is:</p>
      <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${code}</p>
      <p>This code expires in ${expiresInMinutes} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `
  });

  return { delivered: true, mode: "gmail" };
}

export function getLastRegistrationVerificationCode(email) {
  return sentVerificationCodes.get(normalizeEmail(email)) || null;
}

function shouldSendSmtpEmail() {
  return (
    process.env.NODE_ENV !== "test" &&
    process.env.EMAIL_PROVIDER === "gmail" &&
    Boolean(process.env.EMAIL_USER) &&
    Boolean(process.env.EMAIL_APP_PASSWORD)
  );
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
