import { useState, useEffect } from 'react';
import {
  TestTube2,
  Minus,
  Maximize2,
  Users,
  Building,
  Activity,
  RotateCcw,
  Zap,
  ShieldAlert,
  Database,
  LogOut,
  AlertOctagon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useSandboxStore, DEFAULT_SANDBOX_PERSONAS } from '../store/sandbox-store';
import { sandboxManager } from '../manager/sandbox-manager';
import { mockMetadataStore } from '@/features/metadata/data/mock-metadata';
import { sandboxResetRegistry, dlqSandboxRepository } from '@unipost/sandbox';
import { useSpringAuthStore, springApiClient } from '@/features/spring-auth';
import { useQueryClient } from '@tanstack/react-query';
import { DLQ_QUERY_KEY } from '@/features/dlq/hooks/use-dlq';
import type { SandboxPersonaId } from '../types';

export function SandboxDock() {
  const queryClient = useQueryClient();
  const {
    enabled,
    activePersonaId,
    activeTenantId,
    networkSimulation,
    setEnabled,
    setActiveTenant,
    setNetworkLatency,
    setFaultInjection,
  } = useSandboxStore();

  const { isAuthenticated, isSandbox, clearTokens } =
    useSpringAuthStore();

  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('unipost_unified_sandbox_minimized') === 'true';
  });

  const [activeTab, setActiveTab] = useState<'persona' | 'network' | 'auth'>('persona');
  const [dashboardData, setDashboardData] = useState<Record<string, unknown> | null>(null);

  // URL Bootstrap: Check for ?sandbox=true & ?persona= & ?tenant=
  useEffect(() => {
    try {
      const search = new URLSearchParams(window.location.search);
      if (search.get('sandbox') === 'true') {
        setEnabled(true);
        const persona = search.get('persona') as SandboxPersonaId | null;
        if (persona && persona in DEFAULT_SANDBOX_PERSONAS) {
          sandboxManager.switchPersona(persona);
        } else {
          sandboxManager.syncPersonaAuthTokens(activePersonaId);
        }
        const tenant = search.get('tenant');
        if (tenant) {
          setActiveTenant(tenant);
        }
      }
    } catch {
      /* ignore */
    }
  }, [setEnabled, setActiveTenant, activePersonaId]);

  const toggleMinimized = () => {
    setIsMinimized((prev) => {
      const next = !prev;
      localStorage.setItem('unipost_unified_sandbox_minimized', String(next));
      return next;
    });
  };

  const handleResetAllData = () => {
    mockMetadataStore.resetToInitialState();
    sandboxResetRegistry.resetAll();

    // Clear all user default workspace selections and active assumed tenant sessions from localStorage
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('unipost_user_default_ws_') || key.startsWith('unipost_assumed_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }

    sandboxManager.syncPersonaAuthTokens(activePersonaId);
    queryClient.invalidateQueries();
    toast.success('Unified Sandbox: Reset all domain records and user preferences to pristine baseline');
  };

  const handleTestDashboard = async () => {
    try {
      const { data } = await springApiClient.get('/admin/dashboard');
      setDashboardData(data);
      toast.success('Protected route access granted!');
    } catch (e: any) {
      const status = e.response?.status || 'Unknown';
      toast.error(`Dashboard Access Failed: ${status}`);
      setDashboardData(null);
    }
  };

  const handleHardLogout = async () => {
    try {
      await springApiClient.post('/auth/logout');
    } catch {
      /* ignore */
    } finally {
      clearTokens();
      toast.success('Hard Logout Complete');
    }
  };

  const tenants = [
    { id: 'SYSTEM', label: '👑 SYSTEM (Sovereign Root System)' },
    { id: 'tenant-acme', label: 'Acme International Corp (tenant-acme)' },
    { id: 'tenant-us-east-1', label: 'US East Operations Ltd (tenant-us-east-1)' },
    { id: 'tenant-eu-central-1', label: 'EU Central Publishing (tenant-eu-central-1)' },
    { id: 'tenant-us-west-2', label: 'West Coast Media (tenant-us-west-2)' },
  ];

  // Sandbox Dock is strictly unavailable in production builds or when disabled
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_SANDBOX === 'false') {
    return null;
  }

  const hasSandboxUrlParam =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('sandbox') === 'true';

  // Display dock if authenticated in sandbox mode OR ?sandbox=true was explicitly passed
  if (!hasSandboxUrlParam && (!isAuthenticated || !isSandbox)) {
    return null;
  }

  // Minimized floating trigger pill
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMinimized}
          className="flex items-center gap-2 h-9 px-3 rounded-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-emerald-500/40 shadow-lg hover:bg-emerald-500/10 transition-all text-xs font-medium"
          title="Open Unified Sandbox Dock"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <TestTube2 className="size-3.5 text-emerald-500" />
          <span>Unified Sandbox</span>
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-emerald-600/30 text-emerald-800 dark:text-emerald-300">
            {DEFAULT_SANDBOX_PERSONAS[activePersonaId]?.name || activePersonaId}
          </Badge>
          <Maximize2 className="size-3 text-muted-foreground ml-0.5" />
        </Button>
      </div>
    );
  }

  // Expanded Dock Window
  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 rounded-2xl bg-white/80 dark:bg-slate-900/85 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-2xl p-4 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <TestTube2 className="size-5 text-emerald-500" />
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm leading-none">Unified Sandbox Dock</h3>
              <Badge variant={enabled ? 'default' : 'secondary'} className="text-[9px] px-1 py-0 h-3.5">
                {enabled ? 'Active' : 'Bypass'}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground">Global Mock & Security Context</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleResetAllData}
            className="h-7 w-7 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground"
            title="Reset all mock data across all features"
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMinimized}
            className="h-7 w-7 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground"
            title="Minimize dock"
          >
            <Minus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 bg-muted/60 p-1 rounded-lg text-xs">
        <button
          onClick={() => setActiveTab('persona')}
          className={`flex-1 py-1 px-2 rounded-md font-medium transition-all ${activeTab === 'persona'
            ? 'bg-background shadow-xs text-foreground'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Persona & Scope
        </button>
        <button
          onClick={() => setActiveTab('network')}
          className={`flex-1 py-1 px-2 rounded-md font-medium transition-all ${activeTab === 'network'
            ? 'bg-background shadow-xs text-foreground'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Network / Chaos
        </button>
        {isAuthenticated && isSandbox && (
          <button
            onClick={() => setActiveTab('auth')}
            className={`flex-1 py-1 px-2 rounded-md font-medium transition-all ${activeTab === 'auth'
              ? 'bg-background shadow-xs text-foreground'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            Auth Engine
          </button>
        )}
      </div>

      {/* Tab: Persona & Scope */}
      {activeTab === 'persona' && (
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Users className="size-3.5 text-blue-500" /> Active Persona
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['system', 'admin', 'creator', 'user'] as SandboxPersonaId[]).map((pId) => {
                const persona = DEFAULT_SANDBOX_PERSONAS[pId];
                const isActive = activePersonaId === pId;
                const isSys = pId === 'system';
                return (
                  <button
                    key={pId}
                    onClick={() => sandboxManager.switchPersona(pId)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${isActive
                      ? isSys
                        ? 'border-amber-500 bg-amber-500/15 text-amber-950 dark:text-amber-200 font-semibold shadow-xs ring-1 ring-amber-500/40'
                        : 'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-semibold shadow-xs'
                      : 'border-border/60 hover:border-border hover:bg-muted/40'
                      }`}
                  >
                    <span className="truncate max-w-full text-[11px]">
                      {isSys ? '👑 System' : persona.name.split(' ')[0]}
                    </span>
                    <span className="text-[8px] text-muted-foreground font-normal truncate max-w-full">
                      {isSys ? 'CUSTODIAN' : persona.roles[persona.roles.length - 1].replace('ROLE_', '')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="sandbox-dock-active-tenant" className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Building className="size-3.5 text-violet-500" /> Active Scope Tenant
            </label>
            <select
              id="sandbox-dock-active-tenant"
              aria-label="Active Scope Tenant"
              value={activeTenantId}
              onChange={(e) => sandboxManager.switchTenant(e.target.value)}
              className="w-full text-xs rounded-md border border-input bg-background/80 px-2 py-1.5 shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2 text-[10px] text-muted-foreground">
            Current Persona: <strong className="text-foreground">{DEFAULT_SANDBOX_PERSONAS[activePersonaId]?.name}</strong>
            <br />
            Tenant: <strong className="text-foreground">{activeTenantId}</strong>
          </div>

          {/* Quick Simulation Diagnostics */}
          <div className="pt-2 border-t border-border/40 space-y-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Edge-Case Diagnostics
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  useSpringAuthStore.setState({
                    user: {
                      sub: 'unassigned_test_user',
                      roles: ['ROLE_USER'],
                      tenantId: undefined,
                      tid: undefined,
                      iat: Math.floor(Date.now() / 1000),
                      exp: Math.floor(Date.now() / 1000) + 3600,
                    },
                    currentTenantId: null,
                    isAuthenticated: true,
                  });
                  toast.info('Simulated unassigned user: tenant removed from session context');
                }}
                className="text-[10px] h-7 px-2 justify-start border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
                title="Bar user from entering workspace and trigger intervention screen"
              >
                <ShieldAlert className="size-3 mr-1 text-amber-500" />
                Unassigned User
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  sandboxManager.switchTenant('tenant-empty', 'Empty Org Without Workspaces');
                  toast.info('Simulated orphaned tenant with 0 workspaces');
                }}
                className="text-[10px] h-7 px-2 justify-start border-blue-500/30 hover:bg-blue-500/10 text-blue-700 dark:text-blue-300"
                title="Switch to orphaned tenant state with 0 workspaces"
              >
                <Database className="size-3 mr-1 text-blue-500" />
                Orphaned Tenant
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await springApiClient.post('/system/dlq/inject', {});
                    const injected = res.data;
                    toast.error(`Injected DLQ task: ${injected.taskId} (ISOLATED)`);
                  } catch {
                    const injected = dlqSandboxRepository.injectPoisonTask(undefined, activeTenantId);
                    toast.error(`Injected DLQ task: ${injected.taskId} (ISOLATED)`);
                  } finally {
                    queryClient.invalidateQueries({ queryKey: DLQ_QUERY_KEY });
                  }
                }}
                className="col-span-2 text-[10px] h-7 px-2 justify-start border-rose-500/30 hover:bg-rose-500/10 text-rose-700 dark:text-rose-300"
                title="Simulate workflow failure and isolate new poison execution unit into DLQ"
              >
                <AlertOctagon className="size-3 mr-1 text-rose-500" />
                Inject Poison Task (DLQ)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Network Simulation */}
      {activeTab === 'network' && (
        <div className="space-y-3 text-xs">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Activity className="size-3.5 text-amber-500" /> Latency Jitter
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {networkSimulation.latencyMinMs === 0 ? 'Disabled (0ms)' : `${networkSimulation.latencyMinMs}ms - ${networkSimulation.latencyMaxMs}ms`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[
                { label: '0ms', min: 0, max: 0 },
                { label: '200ms', min: 100, max: 300 },
                { label: '600ms', min: 400, max: 800 },
                { label: '1.5s', min: 1000, max: 2000 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setNetworkLatency(opt.min, opt.max)}
                  className={`py-1 rounded border text-[10px] transition-all ${networkSimulation.latencyMaxMs === opt.max && networkSimulation.latencyMinMs === opt.min
                    ? 'border-amber-500 bg-amber-500/10 font-medium text-amber-900 dark:text-amber-200'
                    : 'border-border/60 hover:bg-muted/40'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-medium text-muted-foreground">Fault Chaos Injection</span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {networkSimulation.faultRate === 0 ? 'None' : `${Math.round(networkSimulation.faultRate * 100)}% (HTTP ${networkSimulation.faultStatusCode})`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[
                { label: 'None', rate: 0, code: 500 },
                { label: '10% (500)', rate: 0.1, code: 500 },
                { label: '25% (429)', rate: 0.25, code: 429 },
                { label: '50% (503)', rate: 0.5, code: 503 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setFaultInjection(opt.rate, opt.code)}
                  className={`py-1 rounded border text-[10px] transition-all ${networkSimulation.faultRate === opt.rate && networkSimulation.faultStatusCode === opt.code
                    ? 'border-rose-500 bg-rose-500/10 font-medium text-rose-900 dark:text-rose-200'
                    : 'border-border/60 hover:bg-muted/40'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Auth Engine */}
      {activeTab === 'auth' && isAuthenticated && isSandbox && (
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearTokens}
              className="text-[10px] h-8"
              title="Force Access Token Expiration (Silent Refresh Test)"
            >
              <Zap className="me-1.5 size-3 text-orange-500" /> Expire Access
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearTokens}
              className="text-[10px] h-8"
              title="Force Refresh Token Expiration (Hard Logout Test)"
            >
              <ShieldAlert className="me-1.5 size-3 text-destructive" /> Expire Refresh
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={handleTestDashboard} className="text-[10px] h-8">
              <Database className="me-1.5 size-3 text-blue-500" /> Test Dashboard
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleHardLogout}
              className="text-[10px] h-8 hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="me-1.5 size-3" /> Hard Logout
            </Button>
          </div>

          {dashboardData && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 text-[10px] font-mono text-blue-700 dark:text-blue-300">
              {JSON.stringify(dashboardData)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
