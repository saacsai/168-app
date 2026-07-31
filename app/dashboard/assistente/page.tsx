'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import ChatWithSidebar from '@/components/ChatWithSidebar'

// Nomes terminados em 'A' são tratados como femininos (MAIA, BIA, OLIVIA, SOFIA…).
// Todo o resto é masculino (ZEUS, ADONAI, THOR…).
function isFeminine(name: string): boolean {
  return name.trim().toUpperCase().endsWith('A')
}

export default function AssistentePage() {
  const [assistantName, setAssistantName] = useState<string | null>(null)

  useEffect(() => {
    async function loadPersona() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('instances')
        .select('persona_name')
        .eq('user_id', session.user.id)
        .eq('active', true)
        .single()
      setAssistantName(data?.persona_name || 'Assistente')
    }
    loadPersona()
  }, [])

  if (assistantName === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <p className="text-sm text-gray-400">Carregando…</p>
      </div>
    )
  }

  const fem = isFeminine(assistantName)
  const artigo = fem ? 'a' : 'o'
  const possessivo = fem ? 'sua' : 'seu'
  const subtitulo = fem ? 'Sua assistente pessoal' : 'Seu assistente pessoal'
  const welcomeMessage = `Olá! Sou ${artigo} ${assistantName}, ${possessivo} assistente no MeuDIA. Posso ajudar você a gerenciar seus contatos, consultar a fila de mensagens, criar grupos e muito mais. O que você precisa hoje?`

  return (
    <ChatWithSidebar
      chatSource="olivia"
      sendPath="/api/assistente/olivia"
      historyPath="/api/assistente/olivia/historico"
      conversasPath="/api/assistente/conversas"
      headerName={assistantName}
      headerSubtitle={subtitulo}
      welcomeMessage={welcomeMessage}
      configLink="/dashboard/configuracoes"
    />
  )
}
