export type Txn = {
  id: string;
  date: string;
  name: string;
  amount: number;
  category: string;
  pending: boolean;
};

// Plaid amount convention: positive = money OUT (spending), negative = money IN.
function formatAmount(amount: number): string {
  const sign = amount < 0 ? '+' : '-';
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

export function TransactionsList({ txns }: { txns: Txn[] }) {
  if (!txns.length) return <p className="muted">No transactions yet.</p>;

  return (
    <table className="txns">
      <thead>
        <tr>
          <th>Date</th>
          <th>Merchant</th>
          <th>Category</th>
          <th className="r">Amount</th>
        </tr>
      </thead>
      <tbody>
        {txns.map((t) => (
          <tr key={t.id}>
            <td>{t.date}</td>
            <td>{t.name}{t.pending ? ' (pending)' : ''}</td>
            <td><span className="tag">{t.category}</span></td>
            <td className="r">{formatAmount(t.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
