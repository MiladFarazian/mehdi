'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

export function LinkButton({ onLinked }: { onLinked: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/plaid/create-link-token', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => setLinkToken(d.link_token ?? null))
      .catch(() => setLinkToken(null));
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      await fetch('/api/plaid/exchange-public-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token: publicToken,
          institution_name: metadata?.institution?.name ?? null,
        }),
      });
      onLinked();
    },
    [onLinked],
  );

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  return (
    <button className="btn" disabled={!ready} onClick={() => open()}>
      Link a bank account
    </button>
  );
}
