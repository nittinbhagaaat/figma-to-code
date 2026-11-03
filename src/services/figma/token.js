import User from "@/models/User";
import { encrypt, decrypt } from "@/lib/crypto";
import { badRequest } from "@/lib/errors";

/** Figma personal access tokens are stored AES-256-GCM encrypted and are never returned to the browser. */
export async function saveFigmaToken(userId, token) {
  if (!/^[A-Za-z0-9_\-]{20,200}$/.test(token)) throw badRequest("That does not look like a Figma personal access token");
  await User.updateOne({ _id: userId }, { figmaTokenEnc: encrypt(token), figmaTokenSetAt: new Date() });
}
export async function clearFigmaToken(userId) {
  await User.updateOne({ _id: userId }, { $unset: { figmaTokenEnc: 1, figmaTokenSetAt: 1 } });
}
export async function getFigmaToken(userId) {
  const u = await User.findById(userId).select("+figmaTokenEnc");
  if (!u?.figmaTokenEnc) throw badRequest("Add your Figma personal access token in Settings first", { code: "NO_FIGMA_TOKEN" });
  try { return decrypt(u.figmaTokenEnc); } catch { throw badRequest("Stored Figma token is unreadable — please save it again in Settings"); }
}
