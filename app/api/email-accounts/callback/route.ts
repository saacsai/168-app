import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getGoogleUserEmail } from '@/lib/gmail-accounts';
import { supabaseAdmin, resolveOwnerUserId } from '@/lib/owner';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const apelido = req.nextUrl.searchParams.get('state') || null;
  const erroGoogle = req.nextUrl.searchParams.get('error');

  if (erroGoogle) {
    return NextResponse.json({ erro: `Google recusou: ${erroGoogle}` }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ erro: 'Sem código de autorização.' }, { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await getGoogleUserEmail(tokens.access_token);
    const userId = await resolveOwnerUserId();
    const tokenExpiraEm = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error } = await supabaseAdmin()
      .from('contas_email_conectadas')
      .upsert(
        {
          user_id: userId,
          email,
          apelido,
          provedor: 'google',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token, // só vem preenchido na 1ª autorização (prompt=consent força isso)
          token_expira_em: tokenExpiraEm,
          ativo: true,
        },
        { onConflict: 'user_id,email' }
      );

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2>✅ Conta ${email} conectada${apelido ? ` (${apelido})` : ''}</h2>
        <p>Pode fechar esta aba.</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
