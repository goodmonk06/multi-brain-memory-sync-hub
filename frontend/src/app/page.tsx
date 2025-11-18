'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, MemoryItem, Provider, SyncOverview } from '@/lib/api';

export default function Home() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [syncOverview, setSyncOverview] = useState<SyncOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [memoriesData, providersData, syncData] = await Promise.all([
        api.getMemories(),
        api.getProviders(),
        api.getSyncOverview(),
      ]);
      setMemories(memoriesData);
      setProviders(providersData);
      setSyncOverview(syncData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const handleTriggerSync = async () => {
    try {
      await api.triggerSync();
      setTimeout(loadData, 500);
    } catch (err: any) {
      alert(`Failed to trigger sync: ${err.message}`);
    }
  };

  const handleRetryFailed = async () => {
    try {
      const result = await api.retryFailedSyncs();
      alert(`${result.message}: ${result.count} syncs`);
      setTimeout(loadData, 500);
    } catch (err: any) {
      alert(`Failed to retry syncs: ${err.message}`);
    }
  };

  if (loading && !syncOverview) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="header">
        <h1>Multi-Brain Memory Sync Hub</h1>
        <p>Sync your memory items across multiple LLM providers</p>
        <div className="nav">
          <Link href="/" className="active">
            Dashboard
          </Link>
          <Link href="/memories">Memories</Link>
          <Link href="/providers">Providers</Link>
          <Link href="/sync">Sync Status</Link>
        </div>
      </div>

      <div className="container">
        {error && <div className="error">{error}</div>}

        {/* Overview Stats */}
        <div className="grid">
          <div className="card">
            <h2>Memory Items</h2>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {memories.length}
            </div>
            <p style={{ color: '#666' }}>Total memories stored</p>
          </div>

          <div className="card">
            <h2>Providers</h2>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {providers.filter((p) => p.enabled).length}/{providers.length}
            </div>
            <p style={{ color: '#666' }}>Active providers</p>
          </div>

          <div className="card">
            <h2>Sync Status</h2>
            {syncOverview && (
              <>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <span className="badge badge-success">
                    {syncOverview.byStatus.success} success
                  </span>
                  <span className="badge badge-pending">
                    {syncOverview.byStatus.pending} pending
                  </span>
                  <span className="badge badge-failed">
                    {syncOverview.byStatus.failed} failed
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={handleTriggerSync} className="btn btn-primary">
                    Trigger Sync
                  </button>
                  {syncOverview.byStatus.failed > 0 && (
                    <button onClick={handleRetryFailed} className="btn btn-secondary">
                      Retry Failed
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Provider Status */}
        <div className="card">
          <h2>Provider Status</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {providers.map((provider) => (
              <div
                key={provider.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: '#f8f9fa',
                  borderRadius: '6px',
                }}
              >
                <div>
                  <strong>{provider.name}</strong>
                  <span style={{ marginLeft: '0.5rem', color: '#666' }}>
                    ({provider.type})
                  </span>
                  {!provider.enabled && (
                    <span className="badge" style={{ marginLeft: '0.5rem', background: '#e0e0e0' }}>
                      Disabled
                    </span>
                  )}
                </div>
                {provider.stats && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span className="badge badge-success">
                      {provider.stats.success}
                    </span>
                    <span className="badge badge-pending">
                      {provider.stats.pending}
                    </span>
                    <span className="badge badge-failed">
                      {provider.stats.failed}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Memories */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Recent Memories</h2>
            <Link href="/memories" className="btn btn-primary">
              View All
            </Link>
          </div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {memories.slice(0, 5).map((memory) => (
              <div
                key={memory.id}
                style={{
                  padding: '1rem',
                  background: '#f8f9fa',
                  borderRadius: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong>{memory.key}</strong>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {memory.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: '0.125rem 0.5rem',
                          background: '#e0e0e0',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <p style={{ color: '#666', fontSize: '0.875rem' }}>
                  {memory.content.length > 100
                    ? `${memory.content.substring(0, 100)}...`
                    : memory.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
