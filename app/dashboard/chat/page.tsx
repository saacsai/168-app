'use client'

import ChatWithSidebar from '@/components/ChatWithSidebar'

export default function ChatPage() {
  return (
    <ChatWithSidebar
      chatSource="bia"
      sendPath="/api/assistente/comando"
      historyPath="/api/assistente/historico"
      conversasPath="/api/assistente/conversas"
      headerName="BIA"
      headerSubtitle="Assistente MeuDIA"
      welcomeMessage="Olá! Sou a BIA. Estou aqui para tirar suas dúvidas sobre como usar o MeuDIA — configurações, funcionalidades, o que cada coisa faz. O que você quer saber?"
    />
  )
}
