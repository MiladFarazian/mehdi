'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

const LS_KEY = 'plaid_link_token';

export function LinkButton({ onLinked }: { onLinked: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [oauthReturn, setOauthReturn] = useState(false);

  useEffect(() => {
    // OAuth banks redirect back here with ?oauth_state_id=… — resume the same
    // Link session using the token we stashed before opening.
    if (window.location.href.includes('oauth_state_id=')) {
      setOauthReturn(true);
      setLinkToken(localStorage.getItem(LS_KEY));
      return;
    }
    fetch('/api/plaid/create-link-token', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        setLinkToken(d.link_token ?? null);
        if (d.link_token) localStorage.setItem(LS_KEY, d.link_token);
      })
      .catch(() => setLinkToken(null));
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      localStorage.removeItem(LS_KEY);
      await fetch('/api/plaid/exchange-public-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token: publicToken,
          institution_name: metadata?.institution?.name ?? null,
        }),
      });
      // Strip the OAuth query params so a refresh doesn't re-trigger the flow.
      if (window.location.search.includes('oauth_state_id')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      onLinked();
    },
    [onLinked],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    ...(oauthReturn && typeof window !== 'undefined'
      ? { receivedRedirectUri: window.location.href }
      : {}),
  });

  // Auto-resume Link after returning from the bank's OAuth page.
  useEffect(() => {
    if (oauthReturn && ready) open();
  }, [oauthReturn, ready, open]);

  return (
    <button className="btn" disabled={!ready} onClick={() => open()}>
      Link a bank account
    </button>
  );
}
