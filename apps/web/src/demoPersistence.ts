/**
 * OJIX Property Intelligence — Demo Persistence Service
 *
 * Guarantees that in demo mode:
 * 1. User-created properties persist across page refreshes, lambda recycles, and role switches.
 * 2. Uploaded documents persist and remain visible in Document Operations, Lawyer Workbench, and Matter Details.
 * 3. Workflow assignments (assigning to Lawyer, Operations, Analyst) and status changes stick permanently.
 * 4. Task checklist progress persists.
 */

export interface DemoPropertyOverride {
  status?: string;
  workflow_priority?: string;
  due_date?: string | null;
  assigned_lawyer_uid?: string | null;
  assigned_analyst_uid?: string | null;
  assigned_operations_uid?: string | null;
  assigned_consultant_uid?: string | null;
  assigned_viewer_uid?: string | null;
  archived_at?: string | null;
  [key: string]: any;
}

const STORAGE_KEYS = {
  CUSTOM_PROPERTIES: 'ojix_demo_custom_properties',
  PROPERTY_OVERRIDES: 'ojix_demo_property_overrides',
  CUSTOM_DOCUMENTS: 'ojix_demo_custom_documents',
  TASK_OVERRIDES: 'ojix_demo_task_overrides',
};

function safeGetItem<T>(key: string, defaultValue: T): T {
  if (typeof localStorage === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (err) {
    console.warn(`[demoPersistence] Failed to read ${key}:`, err);
    return defaultValue;
  }
}

function safeSetItem<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[demoPersistence] Failed to write ${key}:`, err);
  }
}

// ─── Custom Properties ────────────────────────────────────────────────────────

export function getStoredDemoProperties(): any[] {
  return safeGetItem<any[]>(STORAGE_KEYS.CUSTOM_PROPERTIES, []);
}

export function saveStoredDemoProperty(property: any): void {
  const current = getStoredDemoProperties();
  const filtered = current.filter((p) => p.id !== property.id);
  filtered.unshift(property);
  safeSetItem(STORAGE_KEYS.CUSTOM_PROPERTIES, filtered);
}

export function removeStoredDemoProperty(propertyId: string): void {
  const current = getStoredDemoProperties();
  const filtered = current.filter((p) => p.id !== propertyId);
  safeSetItem(STORAGE_KEYS.CUSTOM_PROPERTIES, filtered);
}

// ─── Property Overrides (Status, Assignments, etc.) ─────────────────────────

export function getStoredPropertyOverrides(): Record<string, DemoPropertyOverride> {
  return safeGetItem<Record<string, DemoPropertyOverride>>(STORAGE_KEYS.PROPERTY_OVERRIDES, {});
}

export function saveStoredPropertyOverride(propertyId: string, overrides: Partial<DemoPropertyOverride>): void {
  const all = getStoredPropertyOverrides();
  all[propertyId] = {
    ...(all[propertyId] || {}),
    ...overrides,
  };
  safeSetItem(STORAGE_KEYS.PROPERTY_OVERRIDES, all);
}

// ─── Merging Logic ────────────────────────────────────────────────────────────

export function applyDemoPersistence(serverProperties: any[] = []): any[] {
  const custom = getStoredDemoProperties();
  const overrides = getStoredPropertyOverrides();

  // Custom properties take precedence if same id
  const customIds = new Set(custom.map((c) => c.id));
  const base = serverProperties.filter((p) => !customIds.has(p.id));
  const combined = [...custom, ...base];

  // Apply workflow & assignment overrides
  return combined.map((prop) => {
    const override = overrides[prop.id];
    if (!override) return prop;
    return {
      ...prop,
      ...override,
    };
  });
}

// ─── Custom Documents ─────────────────────────────────────────────────────────

export function getStoredDemoDocuments(propertyId?: string): any[] {
  const allDocs = safeGetItem<any[]>(STORAGE_KEYS.CUSTOM_DOCUMENTS, []);
  if (!propertyId) return allDocs;
  return allDocs.filter((d) => d.property_id === propertyId);
}

export function saveStoredDemoDocuments(propertyId: string, newDocs: any[]): void {
  const allDocs = safeGetItem<any[]>(STORAGE_KEYS.CUSTOM_DOCUMENTS, []);
  const docIds = new Set(newDocs.map((d) => d.id));
  const filtered = allDocs.filter((d) => !docIds.has(d.id));
  const normalized = newDocs.map((d) => ({
    ...d,
    property_id: propertyId,
  }));
  safeSetItem(STORAGE_KEYS.CUSTOM_DOCUMENTS, [...normalized, ...filtered]);
}

// ─── Task / Workbench Checklist Overrides ──────────────────────────────────────

export function getStoredTaskOverrides(): Record<string, any> {
  return safeGetItem<Record<string, any>>(STORAGE_KEYS.TASK_OVERRIDES, {});
}

export function saveStoredTaskOverride(taskId: string, override: Record<string, any>): void {
  const all = getStoredTaskOverrides();
  all[taskId] = {
    ...(all[taskId] || {}),
    ...override,
  };
  safeSetItem(STORAGE_KEYS.TASK_OVERRIDES, all);
}
