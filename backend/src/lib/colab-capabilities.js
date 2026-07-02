// Catálogo central de capabilities do App do Colaborador.
// Cada capability é uma chave técnica que liga/desliga uma função no app.
// Adicionar novas funções é apenas incluir aqui + usar no frontend.

export const COLAB_CAPABILITIES = [
  { key: 'punch.register',         group: 'Ponto',         label: 'Bater ponto pelo celular' },
  { key: 'punch.facial_required',  group: 'Ponto',         label: 'Exigir reconhecimento facial' },
  { key: 'punch.view_history',     group: 'Ponto',         label: 'Ver histórico de batidas / espelho' },
  { key: 'journey.view',           group: 'Ponto',         label: 'Aba Jornada (horas / banco)' },

  { key: 'requests.view',          group: 'Solicitações',  label: 'Ver solicitações' },
  { key: 'requests.create',        group: 'Solicitações',  label: 'Abrir novas solicitações' },
  { key: 'vacations.view',         group: 'Solicitações',  label: 'Consultar férias' },
  { key: 'vacations.request',      group: 'Solicitações',  label: 'Solicitar férias' },

  { key: 'payslip.view',           group: 'Financeiro',    label: 'Ver holerite' },
  { key: 'payslip.download_pdf',   group: 'Financeiro',    label: 'Baixar holerite em PDF' },
  { key: 'benefits.view',          group: 'Financeiro',    label: 'Ver benefícios (VR/VT/plano)' },

  { key: 'documents.view',         group: 'Documentos',    label: 'Ver documentos pessoais' },
  { key: 'documents.upload',       group: 'Documentos',    label: 'Enviar documentos' },

  { key: 'announcements.view',     group: 'Comunicação',   label: 'Receber comunicados' },
  { key: 'notifications.receive',  group: 'Comunicação',   label: 'Receber notificações push' },

  { key: 'profile.view',           group: 'Perfil',        label: 'Ver perfil' },
  { key: 'profile.change_password',group: 'Perfil',        label: 'Trocar a própria senha' },
];

export const CAPABILITY_KEYS = COLAB_CAPABILITIES.map(c => c.key);

// Templates padrão criados automaticamente para cada organização.
export const DEFAULT_TEMPLATES = [
  {
    name: 'Operacional',
    description: 'Colaborador de campo/loja: bate ponto, vê holerite e comunicados.',
    is_default: true,
    caps: [
      'punch.register', 'punch.facial_required', 'punch.view_history', 'journey.view',
      'payslip.view', 'payslip.download_pdf',
      'announcements.view', 'notifications.receive',
      'profile.view', 'profile.change_password',
    ],
  },
  {
    name: 'Administrativo',
    description: 'Escritório: tudo do Operacional + solicitações, férias, benefícios e documentos.',
    is_default: false,
    caps: [
      'punch.register', 'punch.view_history', 'journey.view',
      'requests.view', 'requests.create',
      'vacations.view', 'vacations.request',
      'payslip.view', 'payslip.download_pdf', 'benefits.view',
      'documents.view', 'documents.upload',
      'announcements.view', 'notifications.receive',
      'profile.view', 'profile.change_password',
    ],
  },
  {
    name: 'Gestor',
    description: 'Acesso completo às funções do app.',
    is_default: false,
    caps: CAPABILITY_KEYS,
  },
  {
    name: 'Visitante / Terceirizado',
    description: 'Sem bater ponto: apenas comunicados e perfil.',
    is_default: false,
    caps: ['announcements.view', 'notifications.receive', 'profile.view', 'profile.change_password'],
  },
];

// Ensure schema (idempotent) — chamado antes de qualquer I/O de templates.
export async function ensureAppTemplatesSchema(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS app_access_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name VARCHAR(120) NOT NULL,
      description TEXT,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS app_access_template_caps (
      template_id UUID NOT NULL REFERENCES app_access_templates(id) ON DELETE CASCADE,
      capability VARCHAR(80) NOT NULL,
      PRIMARY KEY (template_id, capability)
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_app_templates_org ON app_access_templates(organization_id)
  `);
  await query(`
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS app_access_template_id UUID
  `).catch(() => {});
}

// Cria os 4 templates padrão para uma org, se ela ainda não tiver nenhum.
export async function seedDefaultTemplates(query, organizationId) {
  const existing = await query(
    `SELECT COUNT(*)::int AS c FROM app_access_templates WHERE organization_id = $1`,
    [organizationId]
  );
  if (existing.rows[0].c > 0) return;

  for (const tpl of DEFAULT_TEMPLATES) {
    const r = await query(
      `INSERT INTO app_access_templates (organization_id, name, description, is_default)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [organizationId, tpl.name, tpl.description, tpl.is_default]
    );
    const id = r.rows[0].id;
    for (const cap of tpl.caps) {
      await query(
        `INSERT INTO app_access_template_caps (template_id, capability) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, cap]
      );
    }
  }
}

// Retorna array de capabilities aplicadas ao colaborador.
// Se não tiver template atribuído, usa o template marcado is_default da org.
// Se a org ainda não tem templates, aplica os padrões do "Operacional" para não travar o app.
export async function getEmployeeCapabilities(query, employeeId) {
  const emp = await query(
    `SELECT id, organization_id, app_access_template_id FROM employees WHERE id = $1`,
    [employeeId]
  );
  if (!emp.rows[0]) return [];
  const { organization_id, app_access_template_id } = emp.rows[0];

  await ensureAppTemplatesSchema(query);
  await seedDefaultTemplates(query, organization_id).catch(() => {});

  let tplId = app_access_template_id;
  if (!tplId) {
    const def = await query(
      `SELECT id FROM app_access_templates
        WHERE organization_id = $1 AND is_default = true
        ORDER BY created_at ASC LIMIT 1`,
      [organization_id]
    );
    tplId = def.rows[0]?.id;
  }
  if (!tplId) {
    return DEFAULT_TEMPLATES[0].caps;
  }
  const caps = await query(
    `SELECT capability FROM app_access_template_caps WHERE template_id = $1`,
    [tplId]
  );
  return caps.rows.map(r => r.capability);
}
