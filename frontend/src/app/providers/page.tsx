'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Provider } from '@/lib/api';

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProviders();
      setProviders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
    const interval = setInterval(loadProviders, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleEnabled = async (provider: Provider) => {
    try {
      await api.updateProvider(provider.id, {
        enabled: !provider.enabled,
      });
      loadProviders();
    } catch (err: any) {
      alert(`Failed to update provider: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="header">
        <h1>Providers</h1>
        <p>Configure and manage LLM provider connections</p>
        <div className="nav">
          <Link href="/">Dashboard</Link>
          <Link href="/memories">Memories</Link>
          <Link href="/providers" className="active">
            Providers
          </Link>
          <Link href="/sync">Sync Status</Link>
        </div>
      </div>

      <div className="container">
        {error && <div className="error">{error}</div>}

        <div className="card">
          <h2>Configured Providers ({providers.length})</h2>
          <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1.5rem' }}>
            {providers.map((provider) => (
              <div
                key={provider.id}
                style={{
                  padding: '1.5rem',
                  background: provider.enabled ? '#f8f9fa' : '#e9ecef',
                  borderRadius: '8px',
                  border: provider.enabled ? '2px solid #28a745' : '2px solid #ccc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                      {provider.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#007bff',
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}
                      >
                        {provider.type}
                      </span>
                      <span
                        className={provider.enabled ? 'badge badge-success' : 'badge'}
                        style={!provider.enabled ? { background: '#6c757d', color: 'white' } : {}}
                      >
                        {provider.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleEnabled(provider)}
                    className={provider.enabled ? 'btn btn-secondary' : 'btn btn-primary'}
                  >
                    {provider.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>

                {provider.stats && (
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                      Sync Status:
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <div className="badge badge-success" style={{ width: '100%', textAlign: 'center' }}>
                          {provider.stats.success} Success
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="badge badge-pending" style={{ width: '100%', textAlign: 'center' }}>
                          {provider.stats.pending} Pending
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="badge badge-syncing" style={{ width: '100%', textAlign: 'center' }}>
                          {provider.stats.syncing} Syncing
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="badge badge-failed" style={{ width: '100%', textAlign: 'center' }}>
                          {provider.stats.failed} Failed
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <details style={{ marginTop: '1rem' }}>
                  <summary style={{ cursor: 'pointer', color: '#007bff', fontSize: '0.875rem' }}>
                    View Configuration
                  </summary>
                  <pre
                    style={{
                      marginTop: '0.5rem',
                      padding: '1rem',
                      background: 'white',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      overflow: 'auto',
                    }}
                  >
                    {JSON.stringify(provider.config, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>About Provider Integration</h2>
          <p style={{ color: '#666', lineHeight: 1.6 }}>
            This system uses stub implementations for provider sync operations. In a production
            environment, each provider would use their respective SDKs and APIs to sync memory items.
            See the README for details on how to wire up real provider integrations.
          </p>
        </div>
      </div>
    </>
  );
}
