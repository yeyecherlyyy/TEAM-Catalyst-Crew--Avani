'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useArtifacts } from '@/hooks/use-artifacts';
import {
  FolderOpen, FileText, Link as LinkIcon, Plus, Trash2,
  ExternalLink, Map, GitBranch, Code2, Brain,
  Clock, Search, Filter,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Artifact, ArtifactType, SharedResource } from '@/lib/types';

const ARTIFACT_ICONS: Record<string, React.ElementType> = {
  scorecard: Brain,
  roadmap: Map,
  flowchart: GitBranch,
  brief: FileText,
  code: Code2,
  note: FileText,
};

const ARTIFACT_COLORS: Record<string, string> = {
  scorecard: 'text-violet-400 bg-violet-500/10',
  roadmap: 'text-blue-400 bg-blue-500/10',
  flowchart: 'text-cyan-400 bg-cyan-500/10',
  brief: 'text-emerald-400 bg-emerald-500/10',
  code: 'text-amber-400 bg-amber-500/10',
  note: 'text-gray-400 bg-gray-500/10',
  comparison_table: 'text-indigo-400 bg-indigo-500/10',
  nudge: 'text-rose-400 bg-rose-500/10',
  resource_list: 'text-teal-400 bg-teal-500/10',
  schedule: 'text-orange-400 bg-orange-500/10',
};

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const { artifacts, loading: artifactLoading, fetchArtifacts } = useArtifacts(teamId);
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [tab, setTab] = useState<'artifacts' | 'resources'>('artifacts');
  const [filter, setFilter] = useState<ArtifactType | ''>('');
  const [search, setSearch] = useState('');
  const [showAddResource, setShowAddResource] = useState(false);
  const [newResource, setNewResource] = useState({ name: '', url: '', description: '' });
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  useEffect(() => {
    fetchArtifacts(filter || undefined);
  }, [fetchArtifacts, filter]);

  useEffect(() => {
    async function fetchResources() {
      const supabase = createClient();
      const { data } = await supabase
        .from('shared_resources')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });
      setResources(data || []);
    }
    fetchResources();
  }, [teamId]);

  const addResource = async () => {
    if (!newResource.name || !newResource.url) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('shared_resources').insert({
      team_id: teamId,
      name: newResource.name,
      url: newResource.url,
      description: newResource.description || null,
      added_by: user?.id,
    });
    setNewResource({ name: '', url: '', description: '' });
    setShowAddResource(false);
    const { data } = await supabase
      .from('shared_resources')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });
    setResources(data || []);
  };

  const deleteResource = async (id: string) => {
    const supabase = createClient();
    await supabase.from('shared_resources').delete().eq('id', id);
    setResources((prev) => prev.filter((r) => r.id !== id));
  };

  const filteredArtifacts = artifacts.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase())
  );

  const renderArtifactContent = (artifact: Artifact) => {
    const content = artifact.content;
    switch (artifact.artifact_type) {
      case 'brief':
        return (
          <div className="space-y-3">
            {Object.entries(content).map(([key, value]) => (
              <div key={key}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{key.replace(/_/g, ' ')}</p>
                <p className="text-sm">{Array.isArray(value) ? (value as string[]).join(', ') : String(value)}</p>
              </div>
            ))}
          </div>
        );
      case 'flowchart':
        return (
          <div className="bg-secondary rounded-lg p-4">
            <pre className="text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {(content as { mermaid_source: string }).mermaid_source}
            </pre>
          </div>
        );
      case 'code':
        return (
          <pre className="bg-secondary rounded-lg p-4 text-xs font-mono overflow-x-auto">
            <code>{(content as { source: string }).source}</code>
          </pre>
        );
      case 'note':
        return <p className="text-sm whitespace-pre-wrap">{(content as { text: string }).text}</p>;
      default:
        return (
          <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-4 overflow-x-auto">
            {JSON.stringify(content, null, 2)}
          </pre>
        );
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderOpen className="w-6 h-6 text-emerald-400" />
          Workspace
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-secondary rounded-xl w-fit">
        {(['artifacts', 'resources'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-all',
              tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'artifacts' ? 'Artifacts' : 'Resources'}
          </button>
        ))}
      </div>

      {tab === 'artifacts' && (
        <div>
          {/* Search & Filter */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search artifacts..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-input border border-border rounded-lg focus:ring-2 focus:ring-ring outline-none transition-all placeholder:text-muted-foreground"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as ArtifactType | '')}
              className="px-3 py-2 text-sm bg-input border border-border rounded-lg outline-none"
            >
              <option value="">All types</option>
              <option value="scorecard">Scorecards</option>
              <option value="roadmap">Roadmaps</option>
              <option value="brief">Briefs</option>
              <option value="flowchart">Flowcharts</option>
              <option value="code">Code</option>
              <option value="note">Notes</option>
            </select>
          </div>

          {filteredArtifacts.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <FolderOpen className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No artifacts yet</h3>
              <p className="text-sm text-muted-foreground">
                AI-generated artifacts will appear here
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {filteredArtifacts.map((artifact) => {
                const Icon = ARTIFACT_ICONS[artifact.artifact_type] || FileText;
                const colorClass = ARTIFACT_COLORS[artifact.artifact_type] || 'text-gray-400 bg-gray-500/10';

                return (
                  <button
                    key={artifact.id}
                    onClick={() => setSelectedArtifact(selectedArtifact?.id === artifact.id ? null : artifact)}
                    className={cn(
                      'text-left card-elevated p-4 hover:border-violet-500/20 transition-all duration-300',
                      selectedArtifact?.id === artifact.id && 'border-violet-500/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{artifact.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {artifact.artifact_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-muted-foreground">v{artifact.version}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatRelativeTime(artifact.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Artifact Detail Panel */}
          {selectedArtifact && (
            <div className="mt-4 card-elevated p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{selectedArtifact.title}</h3>
                <span className="text-xs text-muted-foreground">Version {selectedArtifact.version}</span>
              </div>
              {renderArtifactContent(selectedArtifact)}
            </div>
          )}
        </div>
      )}

      {tab === 'resources' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowAddResource(!showAddResource)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-secondary transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Resource
            </button>
          </div>

          {showAddResource && (
            <div className="card-elevated p-5 mb-4 animate-fade-in">
              <div className="space-y-3">
                <input
                  type="text"
                  value={newResource.name}
                  onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
                  placeholder="Resource name..."
                  className="w-full px-4 py-2.5 text-sm bg-input border border-border rounded-lg focus:ring-2 focus:ring-ring outline-none placeholder:text-muted-foreground"
                />
                <input
                  type="url"
                  value={newResource.url}
                  onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
                  placeholder="URL..."
                  className="w-full px-4 py-2.5 text-sm bg-input border border-border rounded-lg focus:ring-2 focus:ring-ring outline-none placeholder:text-muted-foreground"
                />
                <input
                  type="text"
                  value={newResource.description}
                  onChange={(e) => setNewResource({ ...newResource, description: e.target.value })}
                  placeholder="Short description (optional)..."
                  className="w-full px-4 py-2.5 text-sm bg-input border border-border rounded-lg focus:ring-2 focus:ring-ring outline-none placeholder:text-muted-foreground"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addResource}
                    disabled={!newResource.name || !newResource.url}
                    className="px-4 py-2 text-sm font-semibold text-white rounded-lg gradient-primary disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button onClick={() => setShowAddResource(false)} className="px-4 py-2 text-sm text-muted-foreground">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {resources.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <LinkIcon className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No resources yet</h3>
              <p className="text-sm text-muted-foreground">
                Share links, docs, and references with your team
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {resources.map((resource) => (
                <div key={resource.id} className="card-elevated p-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{resource.name}</p>
                    {resource.description && (
                      <p className="text-xs text-muted-foreground truncate">{resource.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => deleteResource(resource.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
