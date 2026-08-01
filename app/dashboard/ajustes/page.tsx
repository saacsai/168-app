'use client'

const SECOES = [
  { label: 'Pacto & Metas', desc: 'Seu briefing de vida, distribuição das 168h e metas por esfera', status: 'em breve' },
  { label: 'Blocos Fixos', desc: 'Academia, sono, família e outros blocos inegociáveis da sua rotina', status: 'em breve' },
  { label: 'Contas Google', desc: 'Calendar e Gmail — conecte até 3 contas do Google Workspace', status: 'em breve' },
  { label: 'WhatsApp', desc: 'Conexão, contatos e grupos com intenção configurável', status: 'em breve' },
  { label: 'Notificações', desc: 'Alertas de timer, auditoria noturna e resumo diário', status: 'em breve' },
]

export default function AjustesPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Ajustes</h1>
        <p className="text-xs text-gray-400 mt-0.5">Configurações do seu 168</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {SECOES.map(s => (
          <div key={s.label} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{s.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
            </div>
            <span className="text-xs text-gray-300 flex-shrink-0 ml-4">{s.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
