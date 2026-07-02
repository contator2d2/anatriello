// Capabilities do App do Colaborador — helper client-side.
// A lista técnica é a mesma do backend (backend/src/lib/colab-capabilities.js).
// Recebemos as capabilities do usuário no login e em /me/full, e salvamos
// em localStorage para funcionar offline.

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
] as const;

export type CapabilityKey = typeof COLAB_CAPABILITIES[number]['key'];

const STORAGE_KEY = 'promotor_capabilities';

export function setCapabilities(caps: string[] | undefined | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(caps) ? caps : []));
  } catch { /* ignore */ }
}

export function getCapabilities(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function hasCap(cap: CapabilityKey | string): boolean {
  return getCapabilities().includes(cap);
}

export function clearCapabilities() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// Agrupa o catálogo para renderizar o editor.
export function capabilitiesByGroup() {
  const groups: Record<string, { key: string; label: string }[]> = {};
  for (const c of COLAB_CAPABILITIES) {
    (groups[c.group] ||= []).push({ key: c.key, label: c.label });
  }
  return groups;
}
