/** Centralised, validated access to environment variables (server only). */
export const env = {
  get appUrl() { return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""); },
  get mongoUri() { return process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/figma2code"; },
  get secret() {
    const s = process.env.APP_SECRET;
    if (!s || s.length < 16) {
      if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET must be set (16+ chars) in production");
      return "dev-only-insecure-secret-change-me";
    }
    return s;
  },
  get isProd() { return process.env.NODE_ENV === "production"; },
  get emailFrom() { return process.env.EMAIL_FROM || "Figma2Code <no-reply@localhost>"; },
  get maxFigMb() { return Number(process.env.MAX_FIG_UPLOAD_MB || 100); },
  get maxImageMb() { return Number(process.env.MAX_IMAGE_UPLOAD_MB || 15); },
  get previewOrigin() { return process.env.PREVIEW_ORIGIN || ""; },
};
