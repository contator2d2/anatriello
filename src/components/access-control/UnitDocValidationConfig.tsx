import { useQuery } from '@tanstack/react-query';
import { Info, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { Link } from 'react-router-dom';

/**
 * Document validation and approval are ALWAYS configured at the Network (Rede) level.
 * PDVs only have operational control to block individual promoters after approval.
 * This component now only shows where to go to configure docs.
 */
export function UnitDocValidationConfig({ unitId }: { unitId: string }) {
  const { data: unit } = useQuery<any>({
    queryKey: ['unit-info-for-doc-config', unitId],
    queryFn: () => api(`/api/access-control/units/${unitId}`).catch(() => null),
    enabled: !!unitId,
  });
  const networkId = unit?.network_id;

  return (
    <div className="space-y-3">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Validação de documentos é configurada na Rede</AlertTitle>
        <AlertDescription className="space-y-2">
          <p className="text-sm">
            A documentação exigida, o modo de aprovação (IA, híbrido, manual) e as notificações
            externas são definidos uma única vez por <strong>Rede</strong>. A rede aprova o
            cadastro do promotor e libera o acesso a todos os PDVs vinculados.
          </p>
          <p className="text-sm">
            Este PDV pode <strong>bloquear individualmente</strong> um promotor já aprovado se
            houver algum problema operacional — a agência e a rede são notificadas
            automaticamente do bloqueio.
          </p>
          {networkId && (
            <Link
              to={`/access-control?tab=networks`}
              className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
            >
              Abrir configuração da rede <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
