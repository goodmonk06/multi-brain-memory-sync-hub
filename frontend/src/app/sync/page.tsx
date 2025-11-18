'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, SyncStatus, SyncOverview } from '@/lib/api';

export default function SyncPage() {
  const [statuses, setStatuses] = useState<SyncStatus[]>([]);
  const [overview, setOverview] = useState<SyncOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'syncing' | 'success' | 'failed'>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusesData, overviewData] = await Promise.all([
        api.getSyncStatuses(),
        api.getSyncOverview(),
      ]);
      setStatuses(statusesData);
      setOverview(overviewData);
    } catch (err: any) {
      setError(err.message || 'Failed to load sync data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000); // Refresh every 3s
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

  const filteredStatuses = statuses.filter((status) => {
    if (filter === 'all') return true;
    return status.status.toLowerCase() === filter;
  });

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  if (loading && !overview) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="header">
        <h1>Sync Status</h1>
        <p>Monitor memory sync operations across all providers</p>
        <div className="nav">
          <Link href="/">Dashboard</Link>
          <Link href="/memories">Memories</Link>
          <Link href="/providers">Providers</Link>
          <Link href="/sync" className="active">
            Sync Status
          </Link>
        </div>
      </div>

      <div className="container">
        {error && <div className="error">{error}</div>}

        {overview && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Overview</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleTriggerSync} className="btn btn-primary">
                  Trigger Sync
                </button>
                {overview.byStatus.failed > 0 && (
                  <button onClick={handleRetryFailed} className="btn btn-secondary">
                    Retry Failed ({overview.byStatus.failed})
                  </button>
                )}
              </div>
            </div>

            <div className="grid">
              <div style={{ padding: '1rem', background: '#d1e7dd', borderRadius: '6px' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{overview.byStatus.success}</div>
                <div style={{ color: '#0f5132' }}>Successful Syncs</div>
              </div>
              <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '6px' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{overview.byStatus.pending}</div>
                <div style={{ color: '#856404' }}>Pending Syncs</div>
              </div>
              <div style={{ padding: '1rem', background: '#cfe2ff', borderRadius: '6px' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{overview.byStatus.syncing}</div>
                <div style={{ color: '#084298' }}>Currently Syncing</div>
              </div>
              <div style={{ padding: '1rem', background: '#f8d7da', borderRadius: '6px' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{overview.byStatus.failed}</div>
                <div style={{ color: '#842029' }}>Failed Syncs</div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Sync Details ({filteredStatuses.length})</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setFilter('all')}
                className={filter === 'all' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                All
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={filter === 'pending' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Pending
              </button>
              <button
                onClick={() => setFilter('success')}
                className={filter === 'success' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Success
              </button>
              <button
                onClick={() => setFilter('failed')}
                className={filter === 'failed' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Failed
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Memory Key</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Provider</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Last Synced</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredStatuses.map((status) => (
                  <tr key={status.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <strong>{status.memoryItem?.key || 'N/A'}</strong>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{status.provider.name}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`badge badge-${status.status.toLowerCase()}`}>
                        {status.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#666' }}>
                      {formatDate(status.lastSyncedAt)}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {status.meta && Object.keys(status.meta).length > 0 && (
                        <details>
                          <summary style={{ cursor: 'pointer', color: '#007bff', fontSize: '0.875rem' }}>
                            View
                          </summary>
                          <pre
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.5rem',
                              background: '#f8f9fa',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              overflow: 'auto',
                              maxWidth: '300px',
                            }}
                          >
                            {JSON.stringify(status.meta, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
