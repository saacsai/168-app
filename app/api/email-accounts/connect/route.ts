import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleAuthUrl } from '@/lib/gmail-accounts';

// GET /api/email-accounts/connect?apelido=AUA
// Abre isso no navegador (logado como você mesmo) pra autorizar a leitura de
// uma conta de Gmail adicional. Redireciona pro consentimento do Google.
export async function GET(req: NextRequest) {
  const apelido = req.nextUrl.searchParams.get('apelido') || 'conta';
  const url = buildGoogleAuthUrl(apelido);
  return NextResponse.redirect(url);
}
