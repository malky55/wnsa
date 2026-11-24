import { verifyKey } from 'discord-interactions';

// التحقق من إن الطلب جاي فعلاً من ديسكورد (توقيع Ed25519)
export async function verifyDiscordRequest(request, publicKey) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  if (!signature || !timestamp) {
    return { isValid: false, body };
  }
  const isValid = await verifyKey(body, signature, timestamp, publicKey);
  return { isValid, body };
}
