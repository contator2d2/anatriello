import AssistantAuditPanel from '@/components/access-control/AssistantAuditPanel';

export default function SupermarketAssistant() {
  return (
    <div className="p-4 md:p-6">
      <AssistantAuditPanel portal="supermarket" />
    </div>
  );
}
