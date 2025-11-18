'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, MemoryItem } from '@/lib/api';

export default function MemoriesPage() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    key: '',
    content: '',
    tags: '',
  });

  const loadMemories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMemories();
      setMemories(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await api.createMemory({
        key: formData.key,
        content: formData.content,
        tags,
      });
      setFormData({ key: '', content: '', tags: '' });
      setShowForm(false);
      loadMemories();
    } catch (err: any) {
      alert(`Failed to create memory: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) {
      return;
    }
    try {
      await api.deleteMemory(id);
      loadMemories();
    } catch (err: any) {
      alert(`Failed to delete memory: ${err.message}`);
    }
  };

  const getSyncStatusSummary = (memory: MemoryItem) => {
    if (!memory.syncStatuses) return null;
    const success = memory.syncStatuses.filter((s) => s.status === 'SUCCESS').length;
    const pending = memory.syncStatuses.filter((s) => s.status === 'PENDING').length;
    const failed = memory.syncStatuses.filter((s) => s.status === 'FAILED').length;
    return { success, pending, failed, total: memory.syncStatuses.length };
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
        <h1>Memory Items</h1>
        <p>Manage your memory items that sync across providers</p>
        <div className="nav">
          <Link href="/">Dashboard</Link>
          <Link href="/memories" className="active">
            Memories
          </Link>
          <Link href="/providers">Providers</Link>
          <Link href="/sync">Sync Status</Link>
        </div>
      </div>

      <div className="container">
        {error && <div className="error">{error}</div>}

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>All Memories ({memories.length})</h2>
            <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
              {showForm ? 'Cancel' : '+ Add Memory'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '6px' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Key (unique identifier)
                </label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Content
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                  rows={4}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g., personal, work, preferences"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Create Memory
              </button>
            </form>
          )}

          <div style={{ display: 'grid', gap: '1rem' }}>
            {memories.map((memory) => {
              const syncSummary = getSyncStatusSummary(memory);
              return (
                <div
                  key={memory.id}
                  style={{
                    padding: '1.5rem',
                    background: '#f8f9fa',
                    borderRadius: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '1.1rem' }}>{memory.key}</strong>
                    <button
                      onClick={() => handleDelete(memory.id)}
                      className="btn btn-danger"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                    >
                      Delete
                    </button>
                  </div>
                  <p style={{ color: '#666', marginBottom: '1rem' }}>{memory.content}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    {memory.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#e0e0e0',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {syncSummary && (
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <span>Sync:</span>
                      <span className="badge badge-success">{syncSummary.success} synced</span>
                      {syncSummary.pending > 0 && (
                        <span className="badge badge-pending">{syncSummary.pending} pending</span>
                      )}
                      {syncSummary.failed > 0 && (
                        <span className="badge badge-failed">{syncSummary.failed} failed</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
