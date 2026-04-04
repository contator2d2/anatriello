import AuthorizedContactsPanel from '@/components/access-control/AuthorizedContactsPanel';

export default function SupermarketContacts() {
  return (
    <div className="p-4 md:p-6">
      <AuthorizedContactsPanel portal="supermarket" />
    </div>
  );
}
