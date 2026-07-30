/**
 * Ghost-PM Dashboard — App Logic
 *
 * Supabase credentials are BUILT-IN. Users only provide a Room ID.
 * Connects, subscribes to realtime, renders all panels.
 */

// ── Built-in Supabase credentials ────────────────────
const GHOST_SUPABASE_URL = "https://yhzbksniwuwqrdfozrmi.supabase.co";
const GHOST_SUPABASE_KEY = "sb_publishable_LiIKpOv77TJ8itK7wRk0_g_rZ9YqZIm";

// ── State ────────────────────────────────────────────
let supabase = null;
let currentRoomId = null;
let realtimeChannel = null;
let refreshInterval = null;
let timerInterval = null;
let hackathonEndTime = null;

// ── Connection ───────────────────────────────────────

async function connectToRoom() {
    const roomId = document.getElementById('room-id').value.trim();

    if (!roomId) {
        showToast('Please enter a Room ID', 'error');
        return;
    }

    try {
        // Initialize with built-in credentials
        supabase = window.supabase.createClient(GHOST_SUPABASE_URL, GHOST_SUPABASE_KEY);
        currentRoomId = roomId;

        // Fetch room data
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single();

        if (roomError) {
            if (roomError.code === 'PGRST116') {
                showToast(`Room "${roomId}" not found. Create one with: ghostpm create`, 'error');
            } else {
                throw roomError;
            }
            return;
        }

        await loadDashboard(room);

        // Update connection badge
        const badge = document.getElementById('connection-status');
        badge.textContent = 'Connected';
        badge.className = 'badge connected';
        document.getElementById('dashboard').classList.remove('hidden');

        // Subscribe to realtime
        subscribeToRealtime(roomId);

        // Start auto-refresh every 10s
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => refreshAll(), 10000);

        // Start timer countdown every second
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (hackathonEndTime) updateTimeRemaining(hackathonEndTime);
        }, 1000);

        showToast(`Connected to room: ${room.name || roomId}`, 'success');
    } catch (err) {
        console.error('Connection error:', err);
        showToast(`Connection failed: ${err.message}`, 'error');
    }
}

// Allow Enter key to connect
document.getElementById('room-id').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') connectToRoom();
});

// ── Dashboard Loading ────────────────────────────────

async function loadDashboard(room) {
    document.getElementById('room-name').textContent = room.name || room.id;
    document.getElementById('room-description').textContent = room.description || '';

    if (room.tech_stack && room.tech_stack.length > 0) {
        document.getElementById('room-tech-stack').textContent = room.tech_stack.join(' • ');
    }

    hackathonEndTime = room.hackathon_end;
    updateTimeRemaining(room.hackathon_end);
    updatePanicMode(room.panic_mode);

    await Promise.all([
        loadMilestones(),
        loadMembers(),
        loadGraphSnapshot(),
        loadCommits(),
    ]);
}

async function refreshAll() {
    try {
        await Promise.all([
            loadMilestones(),
            loadMembers(),
            loadGraphSnapshot(),
            loadCommits(),
        ]);

        const { data: room } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', currentRoomId)
            .single();

        if (room) {
            hackathonEndTime = room.hackathon_end;
            updatePanicMode(room.panic_mode);
        }
    } catch {
        // Silent refresh failure
    }
}

// ── Milestones ───────────────────────────────────────

async function loadMilestones() {
    const { data: milestones, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('room_id', currentRoomId)
        .order('order_index');

    if (error || !milestones) return;

    const container = document.getElementById('milestones-list');
    const completed = milestones.filter(m => m.status === 'completed').length;
    document.getElementById('milestone-count').textContent = `${completed}/${milestones.length}`;

    if (milestones.length === 0) {
        container.innerHTML = '<div class="empty-state">No milestones yet.<br>Add with: <code>ghostpm milestone add "Name"</code></div>';
        return;
    }

    container.innerHTML = milestones.map(ms => {
        const icon = ms.status === 'completed' ? '🟢'
            : ms.status === 'active' ? '🔵' : '⚪';
        const statusClass = ms.status;
        const percent = ms.progress_percent || 0;

        return `
            <div class="milestone-item">
                <span class="milestone-icon">${icon}</span>
                <div class="milestone-info">
                    <div class="milestone-name">${esc(ms.name)}</div>
                    <div class="milestone-description">${esc(ms.description || '')}</div>
                    <div class="milestone-progress">
                        <div class="milestone-progress-fill ${statusClass}"
                             style="width: ${percent}%"></div>
                    </div>
                </div>
                <span class="milestone-percent">${Math.round(percent)}%</span>
            </div>
        `;
    }).join('');
}

// ── Team Members ─────────────────────────────────────

async function loadMembers() {
    const { data: members, error } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', currentRoomId)
        .order('last_active', { ascending: false });

    if (error || !members) return;

    const container = document.getElementById('team-list');
    const onlineCount = members.filter(m => m.is_online).length;
    document.getElementById('member-count').textContent = `${onlineCount} online`;

    if (members.length === 0) {
        container.innerHTML = '<div class="empty-state">No members yet.<br>Join with: <code>ghostpm join ROOM_ID</code></div>';
        return;
    }

    container.innerHTML = members.map(member => {
        const initial = member.member_name.charAt(0).toUpperCase();
        const onlineClass = member.is_online ? 'online' : 'offline';
        const currentFile = member.current_file || '—';
        const idleMin = member.idle_minutes || 0;
        const commits = member.total_commits || 0;

        // Calculate time in file
        let timeStr = '';
        if (member.current_file_since && member.is_online) {
            const since = new Date(member.current_file_since);
            const diffMin = Math.round((Date.now() - since.getTime()) / 60000);
            timeStr = diffMin > 0 ? `${diffMin}m in file` : 'just now';
        } else if (idleMin > 0) {
            timeStr = `${idleMin}m idle`;
        } else {
            timeStr = member.is_online ? 'active' : 'offline';
        }

        const timeClass = idleMin > 120 ? 'warning' : '';

        return `
            <div class="member-item">
                <div class="member-avatar">
                    ${initial}
                    <span class="online-dot ${onlineClass}"></span>
                </div>
                <div class="member-info">
                    <div class="member-name">${esc(member.member_name)}</div>
                    <div class="member-file">${esc(currentFile)}</div>
                </div>
                <span class="member-time ${timeClass}">${timeStr}</span>
                <span class="member-commits">${commits} commits</span>
            </div>
        `;
    }).join('');
}

// ── Code Graph ───────────────────────────────────────

async function loadGraphSnapshot() {
    const { data: snapshots, error } = await supabase
        .from('code_graph_snapshots')
        .select('*')
        .eq('room_id', currentRoomId)
        .order('snapshot_at', { ascending: false })
        .limit(1);

    if (error || !snapshots || snapshots.length === 0) return;

    const snap = snapshots[0];

    // Update stat cards with animation
    animateValue('stat-nodes', snap.total_nodes || 0);
    animateValue('stat-edges', snap.total_edges || 0);
    animateValue('stat-functions', snap.total_functions || 0);
    animateValue('stat-files', snap.total_files || 0);

    // Timestamp
    const ts = new Date(snap.snapshot_at);
    document.getElementById('graph-timestamp').textContent =
        ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ' ' + ts.toLocaleDateString([], { month: 'short', day: 'numeric' });

    // Function status bar + legend
    const statuses = snap.function_statuses || {};
    const total = Object.values(statuses).reduce((a, b) => a + b, 0);
    const bar = document.getElementById('function-status-bar');
    const legend = document.getElementById('status-legend');

    const statusConfig = {
        tested: { color: '#22d3ee', label: 'Tested' },
        implemented: { color: '#34d399', label: 'Implemented' },
        in_progress: { color: '#fbbf24', label: 'In Progress' },
        stub: { color: '#52525b', label: 'Stub' },
        broken: { color: '#f87171', label: 'Broken' },
    };

    if (total > 0) {
        bar.innerHTML = Object.entries(statusConfig)
            .filter(([s]) => statuses[s] > 0)
            .map(([s, cfg]) => {
                const pct = (statuses[s] / total * 100).toFixed(1);
                return `<div class="status-segment ${s}" style="width: ${pct}%"
                             title="${cfg.label}: ${statuses[s]} (${pct}%)"></div>`;
            }).join('');

        legend.innerHTML = Object.entries(statusConfig)
            .filter(([s]) => statuses[s] > 0)
            .map(([s, cfg]) => `
                <span class="legend-item">
                    <span class="legend-dot" style="background: ${cfg.color}"></span>
                    ${cfg.label}: ${statuses[s]}
                </span>
            `).join('');
    }

    // God nodes
    const godNodes = snap.god_nodes || [];
    const godContainer = document.getElementById('god-nodes-list');
    if (godNodes.length > 0) {
        godContainer.innerHTML = `
            <div class="section-label">⚠️ God Nodes (high connectivity risk)</div>
            ${godNodes.map(gn => `
                <div class="god-node-item">
                    <span class="mono-text">${esc(gn.name || gn.file_path || 'unknown')}</span>
                    <span class="risk-badge ${gn.risk || 'medium'}">${gn.connections || 0} connections</span>
                </div>
            `).join('')}
        `;
    } else {
        godContainer.innerHTML = '';
    }

    // Communities
    const communities = snap.communities || [];
    const commContainer = document.getElementById('communities-list');
    if (communities.length > 0) {
        commContainer.innerHTML = `
            <div class="section-label">🏘️ Code Communities</div>
            ${communities.slice(0, 8).map(c => `
                <div class="community-item">
                    <span>${esc(c.name || 'unnamed')}</span>
                    <span class="mono-text dim">${c.functions || 0} funcs • ${(c.files || []).length} files</span>
                </div>
            `).join('')}
        `;
    } else {
        commContainer.innerHTML = '';
    }
}

function animateValue(elementId, targetValue) {
    const el = document.getElementById(elementId);
    const current = parseInt(el.textContent) || 0;
    if (current === targetValue) return;

    const diff = targetValue - current;
    const steps = 20;
    const stepSize = diff / steps;
    let step = 0;

    const interval = setInterval(() => {
        step++;
        el.textContent = Math.round(current + stepSize * step);
        if (step >= steps) {
            el.textContent = targetValue;
            clearInterval(interval);
        }
    }, 30);
}

// ── Commits ──────────────────────────────────────────

async function loadCommits() {
    const { data: commits, error } = await supabase
        .from('commits')
        .select('*')
        .eq('room_id', currentRoomId)
        .order('committed_at', { ascending: false })
        .limit(30);

    if (error || !commits) return;

    const container = document.getElementById('commits-list');
    document.getElementById('commit-count').textContent = commits.length;

    if (commits.length === 0) {
        container.innerHTML = '<div class="empty-state">No commits recorded yet.<br>Make one with: <code>ghostpm commit -m "message"</code></div>';
        return;
    }

    container.innerHTML = commits.map(c => {
        const hash = (c.commit_hash || '').substring(0, 7) || '—';
        const verdict = c.scope_verdict || {};
        const scopeClass = verdict.allowed === false ? 'blocked' : '';
        const scopeText = verdict.allowed === false ? 'BLOCKED' : '';
        const time = new Date(c.committed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const filesCount = (c.files_changed || []).length;

        return `
            <div class="commit-item">
                <span class="commit-hash">${hash}</span>
                <div class="commit-body">
                    <span class="commit-message">
                        ${esc(c.message)}
                        ${scopeText ? `<span class="commit-scope ${scopeClass}">${scopeText}</span>` : ''}
                    </span>
                    <span class="commit-meta">${filesCount} file${filesCount !== 1 ? 's' : ''} • +${c.insertions || 0} / -${c.deletions || 0}</span>
                </div>
                <span class="commit-author">${esc(c.member_name)}<br>${time}</span>
            </div>
        `;
    }).join('');
}

// ── Realtime Subscriptions ───────────────────────────

function subscribeToRealtime(roomId) {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase
        .channel(`ghost-${roomId}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'commits',
            filter: `room_id=eq.${roomId}`,
        }, (payload) => {
            loadCommits();
            if (payload.eventType === 'INSERT') {
                const c = payload.new;
                showToast(`📝 ${c.member_name}: ${c.message}`, 'info');
            }
        })
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'room_members',
            filter: `room_id=eq.${roomId}`,
        }, () => loadMembers())
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'milestones',
            filter: `room_id=eq.${roomId}`,
        }, (payload) => {
            loadMilestones();
            if (payload.eventType === 'UPDATE' && payload.new.status === 'completed') {
                showToast(`🎉 Milestone completed: ${payload.new.name}`, 'success');
            }
        })
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'code_graph_snapshots',
            filter: `room_id=eq.${roomId}`,
        }, () => {
            loadGraphSnapshot();
            showToast('🔗 Code graph updated', 'info');
        })
        .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'rooms',
            filter: `id=eq.${roomId}`,
        }, (payload) => {
            if (payload.new.panic_mode !== undefined) {
                updatePanicMode(payload.new.panic_mode);
                showToast(
                    payload.new.panic_mode ? '🔴 PANIC MODE ACTIVATED' : '✅ Panic mode deactivated',
                    payload.new.panic_mode ? 'error' : 'success'
                );
            }
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Realtime connected');
            }
        });
}

// ── UI Helpers ───────────────────────────────────────

function updateTimeRemaining(hackathonEnd) {
    if (!hackathonEnd) return;
    const end = new Date(hackathonEnd);
    const now = new Date();
    const diffMs = end - now;

    const el = document.getElementById('time-remaining');
    if (diffMs <= 0) {
        el.textContent = "⏱ Time's up!";
        el.style.color = 'var(--red)';
        return;
    }

    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    el.textContent = `⏱ ${hours}h ${minutes}m ${seconds}s remaining`;
    el.style.color = hours < 2 ? 'var(--red)' : hours < 6 ? 'var(--yellow)' : 'var(--green)';
}

function updatePanicMode(isPanic) {
    const indicator = document.getElementById('panic-indicator');
    const text = document.getElementById('panic-text');
    if (isPanic) {
        indicator.className = 'panic-on';
        text.textContent = '🔴 PANIC MODE';
    } else {
        indicator.className = 'panic-off';
        text.textContent = 'Normal Mode';
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(16px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ── Init ─────────────────────────────────────────────

// Auto-fill room from URL param
const params = new URLSearchParams(window.location.search);
if (params.get('room')) {
    document.getElementById('room-id').value = params.get('room');
    // Auto-connect
    window.addEventListener('DOMContentLoaded', () => setTimeout(connectToRoom, 500));
}
