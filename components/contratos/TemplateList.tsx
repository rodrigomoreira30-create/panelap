'use client'

type Template = {
  id: string
  name: string
  is_default: boolean
  created_at: Date | string
}

type Props = {
  templates: Template[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onCreate: () => void
}

export function TemplateList({ templates, onEdit, onDelete, onCreate }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Templates de Contrato</h2>
        <button
          onClick={onCreate}
          className="bg-blue-600 text-white px-4 py-2 text-sm rounded hover:bg-blue-700"
        >
          Novo Template
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhum template encontrado. Crie um para começar.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{template.name}</p>
                  {template.is_default && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Padrão</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(template.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => onEdit(template.id)} className="text-sm text-blue-600 hover:text-blue-800">
                  Editar
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir o template "${template.name}"?`)) {
                      onDelete(template.id)
                    }
                  }}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
