import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
  type DragEvent,
} from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  CloudUpload,
  Eye,
  FileCheck2,
  FileSearch,
  FileText,
  Filter,
  FolderOpen,
  Gauge,
  Layers3,
  LayoutDashboard,
  MapPin,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  LoaderCircle,
  ExternalLink,
  Download,
  Clock3,
  Map as MapIcon,
  GitMerge,
  Scale,
  UserCheck,
  LogOut,
  Key,
} from "lucide-react";
import { LoginPage } from "./components/LoginPage";
import { SideBySideReview } from "./components/SideBySideReview";
import { TitleChainTimeline } from "./components/TitleChainTimeline";
import { MapViewer } from "./components/MapViewer";
import {
  DiscrepancyMatrix,
  type DiscrepancyFinding,
} from "./components/DiscrepancyMatrix";
import { ReportViewer } from "./components/ReportViewer";
import { LegalResearchView } from "./components/LegalResearchView";
import { SourceRegistryView } from "./components/SourceRegistryView";
import { GlobalDocumentsView } from "./components/GlobalDocumentsView";
import { GlobalRiskView } from "./components/GlobalRiskView";
import { GlobalMapView } from "./components/GlobalMapView";
import { SettingsView } from "./components/SettingsView";
import ApiConsole from "./components/ApiConsole";
import { AdminModule, type AdminSection } from "./components/AdminModule";
import { SuperAdminPage } from "./components/SuperAdminPage";
import { WorkflowGuide } from "./components/WorkflowGuide";
import { LawyerWorkbench } from "./components/LawyerWorkbench";
import { ConsultantWorkspace, SharedConsultantReport } from "./components/ConsultantWorkspace";
import { OwnerAnalytics, OwnerPortfolioMap } from "./components/OwnerDashboardVisuals";
import OwnerInactivityGuard from "./components/OwnerInactivityGuard";
import { authFetch } from "./authFetch";
import { API_BASE_URL } from "./apiConfig";
import { validatePropertyForm } from "./propertyFormValidation";
import "./owner-dashboard.css";

import type { PropertyDoc, UserAccount, UserRole } from "./types";

type Property = {
  id: string;
  application_number: string;
  name: string;
  review_purpose?: string;
  review_purpose_custom?: string;
  primary_document_type?: string;
  primary_document_type_custom?: string;
  property_identifier: string;
  property_identifier_type?: string;
  property_type: string;
  village: string;
  hobli: string;
  taluk: string;
  district: string;
  district_id?: string | null;
  taluk_id?: string | null;
  hobli_id?: string | null;
  village_id?: string | null;
  survey_number: string;
  subdivision: string;
  extent: string;
  extent_value: number | null;
  extent_unit: string;
  boundary_north: string;
  boundary_south: string;
  boundary_east: string;
  boundary_west: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  coordinate_source: string;
  coordinate_confidence: number | null;
  coordinate_captured_at: string | null;
  identity_state: string;
  notes: string;
  status: string;
  workflow_priority?: string;
  due_date?: string | null;
  assigned_lawyer_uid?: string;
  assigned_analyst_uid?: string;
  assigned_operations_uid?: string;
  updated_at: string;
  document_count?: number;
};
type WorkspaceChoice={id:string;name:string;slug:string;role:UserRole;status:string};
type Finding = {
  id?: string;
  code: string;
  title: string;
  severity: string;
  points: number;
  explanation: string;
  evidence_status: string;
  next_action: string;
};
type Doc = {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256?: string;
  doc_type?: string;
  doc_type_custom?: string;
  classification_confidence?: number | null;
  classification_source?: string;
  manual_review_status?: string;
  processing_status: string;
  extracted_fields?: any;
  created_at: string;
};
type ParcelReference = {
  id: string;
  sequence_no: number;
  is_primary: number | boolean;
  district: string;
  taluk: string;
  hobli: string;
  village: string;
  survey_number: string;
  subdivision: string;
  extent_raw: string;
  extent_value: number | null;
  extent_unit: string;
  source_description: string;
  fact_state: string;
  notes: string;
};
const API = API_BASE_URL;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("ojix_auth_token")
      : null;
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has("Authorization"))
    headers.set("Authorization", `Bearer ${token}`);
  const res = await authFetch(`${API}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details =
      Array.isArray(data.issues) && data.issues.length
        ? ` ${data.issues.join(" ")}`
        : "";
    throw new Error(
      `${data.error || `Request failed (${res.status})`}${details}`,
    );
  }
  return data as T;
}
const dateLabel = (date?: string) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const pretty = (value?: string) =>
  value
    ? value.replace(/_/g, " ").replace(/\b\w/g, (s) => s.toUpperCase())
    : "Not recorded";
const propertyIdentityLabel = (
  property: Pick<
    Property,
    | "property_type"
    | "property_identifier"
    | "property_identifier_type"
    | "survey_number"
    | "subdivision"
  >,
) =>
  property.property_type === "non_agricultural"
    ? [property.property_identifier_type, property.property_identifier]
        .filter(Boolean)
        .join(": ") || "Property number not recorded"
    : `Survey ${property.survey_number || "—"}${property.subdivision ? ` · Hissa ${property.subdivision}` : ""}`;
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
type AppPage =
  | "overview"
  | "properties"
  | "property"
  | "all-documents"
  | "all-findings"
  | "all-maps"
  | "legal-research"
  | "source-registry"
  | "settings"
  | "api-console"
  | "super-admin"
  | "workflow-guide"
  | "lawyer-workbench"
  | "consultant-issues"
  | "consultant-reports"
  | "consultant-exports"
  | "consultant-shared"
  | AdminSection;
const PAGE_PATHS: Record<Exclude<AppPage, "property">, string> = {
  overview: "/dashboard",
  properties: "/properties",
  "all-documents": "/documents",
  "all-findings": "/risk-reviews",
  "all-maps": "/maps",
  "legal-research": "/legal-research",
  "source-registry": "/sources",
  settings: "/settings",
  "api-console": "/api-console",
  "super-admin": "/super-admin",
  "workflow-guide": "/workflows",
  "lawyer-workbench": "/lawyer-workbench",
  "consultant-issues": "/consultant/issues",
  "consultant-reports": "/consultant/reports",
  "consultant-exports": "/consultant/exports",
  "consultant-shared": "/consultant/shared",
  "admin-overview": "/admin",
  "admin-members": "/admin/members",
  "admin-roles": "/admin/roles",
  "admin-applications": "/admin/applications",
  "admin-documents": "/admin/documents",
  "admin-integrations": "/admin/integrations",
  "admin-security": "/admin/security",
  "admin-retention": "/admin/retention",
  "admin-audit": "/admin/audit",
  "admin-sources": "/admin/sources",
  "admin-gis-rules": "/admin/gis-rules",
  "admin-discrepancy-rules": "/admin/discrepancy-rules",
  "admin-models": "/admin/models",
  "admin-templates": "/admin/templates",
  "admin-exports": "/admin/exports",
};
const ADMIN_PAGES: AdminSection[] = [
  "admin-overview",
  "admin-members",
  "admin-roles",
  "admin-applications",
  "admin-documents",
  "admin-integrations",
  "admin-security",
  "admin-retention",
  "admin-audit",
  "admin-sources",
  "admin-gis-rules",
  "admin-discrepancy-rules",
  "admin-models",
  "admin-templates",
  "admin-exports",
];
const ROLE_PAGES: Record<UserRole, AppPage[]> = {
  super_admin: ["overview", "super-admin"],
  owner: [
    "overview",
    "properties",
    "property",
    "all-documents",
    "all-findings",
    "all-maps",
    "legal-research",
    "source-registry",
    "settings",
    "consultant-reports",
    "workflow-guide",
    "api-console",
    "super-admin",
    "lawyer-workbench",
    ...ADMIN_PAGES,
  ],
  admin: ["overview", "settings", "lawyer-workbench", ...ADMIN_PAGES],
  lawyer: [
    "overview",
    "properties",
    "property",
    "all-documents",
    "all-findings",
    "legal-research",
    "lawyer-workbench",
    "consultant-issues",
  ],
  analyst: [
    "overview",
    "properties",
    "property",
    "all-documents",
    "all-findings",
    "all-maps",
    "lawyer-workbench",
  ],
  operations: ["overview", "properties", "property", "all-documents"],
  consultant: [
    "overview",
    "properties",
    "property",
    "all-documents",
    "all-findings",
    "all-maps",
    "consultant-issues",
    "consultant-reports",
    "consultant-exports",
    "consultant-shared",
  ],
  support: ["overview"],
  data_steward: [
    "overview",
    "properties",
    "property",
    "all-documents",
    "all-maps",
    "source-registry",
  ],
  viewer: ["overview", "properties", "property"],
};
const PAGE_PERMISSIONS: Partial<Record<AppPage,string>> = {
  overview:"dashboard.view",properties:"properties.view",property:"properties.view",
  "all-documents":"documents.view","all-findings":"findings.view","all-maps":"maps.view",
  "legal-research":"legal.view","source-registry":"sources.view",settings:"settings.view",
  "api-console":"admin.view","lawyer-workbench":"workbench.view","consultant-issues":"findings.view",
  "consultant-reports":"reports.view","consultant-exports":"reports.export","consultant-shared":"reports.export",
  "admin-overview":"admin.view","admin-members":"members.view","admin-roles":"permissions.view",
  "admin-applications":"properties.manage","admin-documents":"documents.view","admin-integrations":"admin.view",
  "admin-security":"sessions.view","admin-retention":"retention.view","admin-audit":"audit.view",
  "admin-sources":"sources.view","admin-gis-rules":"maps.configure","admin-discrepancy-rules":"admin.manage",
  "admin-models":"admin.manage","admin-templates":"admin.manage","admin-exports":"admin.view",
};
const canAccessPage = (user: UserAccount, page: AppPage) => {
  if(page==="super-admin")return Boolean(user.isSuperAdmin);
  if(page==="workflow-guide")return user.role!=="owner";
  const required=PAGE_PERMISSIONS[page];
  if(user.permissions?.length&&required)return user.permissions.includes(required);
  return ROLE_PAGES[user.role]?.includes(page)??false;
};
function routeFromPath(pathname: string): {
  page: AppPage;
  propertyId?: string;
} {
  const propertyMatch = pathname.match(/^\/properties\/([^/]+)\/?$/);
  if (propertyMatch)
    return {
      page: "property",
      propertyId: decodeURIComponent(propertyMatch[1]),
    };
  const roleDashboard = pathname
    .replace(/\/$/, "")
    .match(
      /^\/(super-admin|owner|admin|lawyer|analyst|operations|consultant|support|data-steward|viewer)\/dashboard$/,
    );
  if (roleDashboard)
    return {
      page:
        roleDashboard[1] === "super-admin"
          ? "super-admin"
          : roleDashboard[1] === "admin"
            ? "admin-overview"
            : "overview",
    };
  const match = (
    Object.entries(PAGE_PATHS) as Array<[Exclude<AppPage, "property">, string]>
  ).find(
    ([, path]) =>
      path === pathname.replace(/\/$/, "") || `${path}/` === pathname,
  );
  return { page: match?.[0] || "overview" };
}
function loginRoleFromPath(pathname: string) {
  const normalizedPath = pathname.replace(/\/$/, "");
  const match = normalizedPath.match(
      /^\/login\/(super-admin|owner|admin|lawyer|analyst|operations|consultant|support|data-steward|viewer)$/,
    );
  const role = match?.[1] || dashboardRoleFromPath(normalizedPath);
  return role === "data-steward" ? "data_steward" : role;
}
function dashboardRoleFromPath(pathname: string) {
  const match = pathname
    .replace(/\/$/, "")
    .match(
      /^\/(super-admin|owner|admin|lawyer|analyst|operations|consultant|support|data-steward|viewer)\/dashboard$/,
    );
  return match?.[1] === "data-steward" ? "data_steward" : match?.[1];
}
function dashboardPathForUser(user: UserAccount, useSuperAdminPortal = false) {
  if (useSuperAdminPortal && user.isSuperAdmin)
    return "/super-admin/dashboard";
  const role = user.role === "super_admin" ? "super-admin" : user.role === "data_steward" ? "data-steward" : user.role;
  return `/${role}/dashboard`;
}
function updateBrowserUrl(page: AppPage, propertyId?: string, replace = false) {
  const path =
    page === "property" && propertyId
      ? `/properties/${encodeURIComponent(propertyId)}`
      : page === "property"
        ? "/properties"
        : PAGE_PATHS[page];
  if (window.location.pathname === path) return;
  window.history[replace ? "replaceState" : "pushState"](
    { page, propertyId },
    "",
    path,
  );
}

export default function App() {
  const isDedicatedLoginRoute = /^\/login(?:\/|$)/.test(window.location.pathname);
  const [page, setPage] = useState<AppPage>(
    () => routeFromPath(window.location.pathname).page,
  );
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    if (isDedicatedLoginRoute) return null;
    const saved = localStorage.getItem("ojix_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return null;
  });
  const [authToken, setAuthToken] = useState<string | null>(() =>
    isDedicatedLoginRoute ? null : localStorage.getItem("ojix_auth_token"),
  );
  const [portalMode, setPortalMode] = useState<"workspace" | "super-admin">(
    () => localStorage.getItem("ojix_portal_mode") === "super-admin" ? "super-admin" : "workspace",
  );
  const [authChecking, setAuthChecking] = useState(() =>
    !isDedicatedLoginRoute && Boolean(localStorage.getItem("ojix_auth_token")),
  );
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [availableAccounts, setAvailableAccounts] = useState<UserAccount[]>([]);
  const [workspaces,setWorkspaces]=useState<WorkspaceChoice[]>([]);
  const [activeWorkspaceId,setActiveWorkspaceId]=useState(()=>localStorage.getItem('ojix_workspace_id')||'');
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState(() =>
    sessionStorage.getItem("ojix_session_expired_message") || "",
  );

  const [properties, setProperties] = useState<Property[]>([]);
  const [overview, setOverview] = useState({
    total: 0,
    in_review: 0,
    ready_for_review: 0,
    documents: 0,
  });
  const [ownerDashboardData, setOwnerDashboardData] = useState<any>(null);
  const [ownerDashboardError, setOwnerDashboardError] = useState("");
  const [ownerDashboardActionFilter, setOwnerDashboardActionFilter] = useState("");
  const [selected, setSelected] = useState<Property | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [riskSummary, setRiskSummary] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    fetch(`${API}/api/auth/dummy-accounts`)
      .then((res) => res.json())
      .then((data) => {
        if (data.accounts) setAvailableAccounts(data.accounts);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!authToken) {
      setAuthChecking(false);
      return;
    }
    let active = true;
    setAuthChecking(true);
    authFetch(`${API}/api/auth/me`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(data.error || "Your session is no longer valid.");
        if (!active) return;
        localStorage.setItem("ojix_user", JSON.stringify(data.user));
        setCurrentUser(data.user);
        if(data.user.tenantId){localStorage.setItem('ojix_workspace_id',data.user.tenantId);setActiveWorkspaceId(data.user.tenantId);}
      })
      .catch((sessionError) => {
        if (!active) return;
        if (String(sessionError?.message || "").toLowerCase().includes("inactiv")) {
          const message = "Your session has expired due to inactivity. Please log in again.";
          sessionStorage.setItem("ojix_session_expired_message", message);
          setSessionExpiredMessage(message);
        }
        localStorage.removeItem("ojix_auth_token");
        localStorage.removeItem("ojix_user");
        setAuthToken(null);
        setCurrentUser(null);
        setSelected(null);
      })
      .finally(() => {
        if (active) setAuthChecking(false);
      });
    return () => {
      active = false;
    };
  }, [authToken]);

  useEffect(()=>{
    if(!authToken||!currentUser||authChecking)return;
    let active=true;
    authFetch(`${API}/api/auth/workspaces`).then(async response=>{
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Could not load authorized workspaces.');
      if(!active)return;
      const choices:WorkspaceChoice[]=data.items||[];
      setWorkspaces(choices);
      const saved=localStorage.getItem('ojix_workspace_id')||currentUser.tenantId||data.activeWorkspaceId||'';
      const selected=choices.some(item=>item.id===saved)?saved:(choices[0]?.id||'');
      if(selected){localStorage.setItem('ojix_workspace_id',selected);setActiveWorkspaceId(selected);}
    }).catch(()=>{if(active)setWorkspaces([]);});
    return()=>{active=false;};
  },[authToken,currentUser?.uid,currentUser?.tenantId,authChecking]);

  const refresh = useCallback(async () => {
    if (!authToken || !currentUser || authChecking) return;
    if (portalMode === "super-admin" || currentUser.role === "super_admin") return;
    setLoading(true);
    setError("");
    try {
      const [o, p, ownerData] = await Promise.all([
        api<any>("/api/overview"),
        api<{ items: Property[] }>("/api/properties"),
        currentUser.role === "owner"
          ? api<any>("/api/owner/dashboard").catch((ownerError) => ({
              dashboardError: (ownerError as Error).message,
            }))
          : Promise.resolve(null),
      ]);
      setOverview(o);
      setProperties(p.items);
      if (currentUser.role === "owner") {
        if (ownerData?.dashboardError) {
          setOwnerDashboardData(null);
          setOwnerDashboardError(ownerData.dashboardError);
        } else {
          setOwnerDashboardData(ownerData);
          setOwnerDashboardError("");
        }
      } else {
        setOwnerDashboardData(null);
        setOwnerDashboardError("");
      }
      if (selected) {
        const d = await api<{
          item: Property;
          documents: Doc[];
          findings: Finding[];
        }>(`/api/properties/${selected.id}`);
        setSelected(d.item);
        setDocs(d.documents);
        setFindings(d.findings);
      }
    } catch (e) {
      if (selected) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selected?.id, authToken, currentUser, authChecking, portalMode, activeWorkspaceId]);

  useEffect(() => {
    if (authToken && currentUser && !authChecking) {
      refresh();
    }
  }, [authToken, currentUser, authChecking, activeWorkspaceId, page]);

  const switchWorkspace=async(workspaceId:string)=>{
    const target=workspaces.find(item=>item.id===workspaceId&&item.status==='active');
    if(!target||workspaceId===activeWorkspaceId)return;
    const previous=activeWorkspaceId;
    localStorage.setItem('ojix_workspace_id',workspaceId);setActiveWorkspaceId(workspaceId);
    setSelected(null);setDocs([]);setFindings([]);setProperties([]);setOwnerDashboardData(null);setError('');setAuthChecking(true);
    try{
      const response=await authFetch(`${API}/api/auth/me`),data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Workspace membership could not be verified.');
      localStorage.setItem('ojix_user',JSON.stringify(data.user));setCurrentUser(data.user);
      const platform=Boolean(data.user.isSuperAdmin&&data.user.role==='super_admin');
      setPortalMode(platform?'super-admin':'workspace');localStorage.setItem('ojix_portal_mode',platform?'super-admin':'workspace');
      const nextPage:AppPage=platform?'super-admin':'overview';setPage(nextPage);updateBrowserUrl(nextPage,undefined,true);
      setNotice(`Switched to ${target.name} as ${target.role.replace(/_/g,' ')}.`);
    }catch(error){localStorage.setItem('ojix_workspace_id',previous);setActiveWorkspaceId(previous);setError((error as Error).message);}
    finally{setAuthChecking(false);}
  };

  const switchRole = async (targetUid: string) => {
    if (!import.meta.env.DEV) return;
    setBusy(true);
    setError("");
    try {
      setShowRoleSwitcher(false);
      localStorage.removeItem("ojix_auth_token");
      localStorage.removeItem("ojix_workspace_id");setActiveWorkspaceId("");
      localStorage.removeItem("ojix_user");
      setAuthToken("");
      setCurrentUser(null);
      setPage("overview");
      setNotice(`Sign in again to authenticate as ${availableAccounts.find((account) => account.uid === targetUid)?.name || "the selected account"}.`);
    } catch (err: any) {
      setError(`Unable to switch account: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = useCallback((reason: "manual" | "inactivity" = "manual") => {
    authFetch(`${API}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch(() => {});
    if (reason === "inactivity") {
      const message = "Your session has expired due to inactivity. Please log in again.";
      sessionStorage.setItem("ojix_session_expired_message", message);
      setSessionExpiredMessage(message);
      localStorage.setItem("ojix_session_event", JSON.stringify({ type: "logout", reason, at: Date.now() }));
    }
    localStorage.removeItem("ojix_auth_token");
    localStorage.removeItem("ojix_workspace_id");setActiveWorkspaceId("");setWorkspaces([]);
    localStorage.removeItem("ojix_workspace_id");
    localStorage.removeItem("ojix_user");
    localStorage.removeItem("ojix_portal_mode");
    setAuthToken(null);
    setCurrentUser(null);
    setPortalMode("workspace");
    setSelected(null);
    setPage("overview");
    window.history.replaceState({}, "", "/login");
  }, []);
  const handleOwnerInactivity = useCallback(() => handleLogout("inactivity"), [handleLogout]);

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await authFetch(`${API}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Password change failed.");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordChange(false);
      setNotice(data.message || "Password changed successfully.");
    } catch (changeError) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : "Password change failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const openProperty = async (property: Property, updateUrl = true) => {
    setBusy(true);
    setError("");
    try {
      const d = await api<{
        item: Property;
        documents: Doc[];
        findings: Finding[];
      }>(`/api/properties/${property.id}`);
      setSelected(d.item);
      setDocs(d.documents);
      setFindings(d.findings);
      setRiskSummary(null);
      setPage("property");
      setMobileNav(false);
      if (updateUrl) updateBrowserUrl("property", d.item.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openPropertyById = async (propId: string, updateUrl = true) => {
    const found = properties.find((p) => p.id === propId);
    if (found) {
      await openProperty(found, updateUrl);
    } else {
      setBusy(true);
      setError("");
      try {
        const d = await api<{
          item: Property;
          documents: Doc[];
          findings: Finding[];
        }>(`/api/properties/${propId}`);
        setSelected(d.item);
        setDocs(d.documents);
        setFindings(d.findings);
        setRiskSummary(null);
        setPage("property");
        setMobileNav(false);
        if (updateUrl) updateBrowserUrl("property", d.item.id);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
  };

  useEffect(() => {
    if (!authToken || !currentUser || authChecking) return;
    const applyRoute = () => {
      const requestedDashboardRole = dashboardRoleFromPath(
        window.location.pathname,
      );
      if (
        requestedDashboardRole &&
        (requestedDashboardRole === "super-admin"
          ? !currentUser.isSuperAdmin || portalMode !== "super-admin"
          : portalMode === "super-admin" || currentUser.role !== requestedDashboardRole)
      ) {
        setError(
          `This account is not authorized for the ${requestedDashboardRole === "super-admin" ? "Super Admin" : requestedDashboardRole.replace("_", " ")} dashboard.`,
        );
        setPage("overview");
        setSelected(null);
        window.history.replaceState({}, "", dashboardPathForUser(currentUser, portalMode === "super-admin"));
        return;
      }
      const route = routeFromPath(window.location.pathname);
      if (!canAccessPage(currentUser, route.page)) {
        setError("This page is not available for your assigned role.");
        setPage("overview");
        setSelected(null);
        updateBrowserUrl("overview", undefined, true);
        return;
      }
      if (route.page === "property" && route.propertyId) {
        if (selected?.id !== route.propertyId)
          void openPropertyById(route.propertyId, false);
        else setPage("property");
      } else {
        setPage(route.page);
        setSelected(null);
        setMobileNav(false);
        if (
          window.location.pathname === "/" ||
          window.location.pathname === "/login"
        )
          updateBrowserUrl("overview", undefined, true);
      }
    };
    applyRoute();
    window.addEventListener("popstate", applyRoute);
    return () => window.removeEventListener("popstate", applyRoute);
  }, [
    authToken,
    currentUser?.uid,
    currentUser?.role,
    currentUser?.isSuperAdmin,
    portalMode,
    authChecking,
    properties.length,
    selected?.id,
  ]);

  const createProperty = async (form: Record<string, any>) => {
    setBusy(true);
    setError("");
    try {
      const { additionalParcels = [], ...propertyForm } = form;
      let payload = propertyForm;
      let response = await authFetch(`${API}/api/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let result = await response.json();
      if (response.status === 409 && result.duplicate) {
        const duplicate = result.duplicate;
        const proceed = window.confirm(
          `A similar property already exists: ${duplicate.name} (${duplicate.survey_number}${duplicate.subdivision ? `/${duplicate.subdivision}` : ""}). Create another workspace anyway?`,
        );
        if (!proceed) {
          setError(
            "Property creation cancelled. Review the existing matching property.",
          );
          return;
        }
        payload = { ...propertyForm, allowDuplicate: true };
        response = await authFetch(`${API}/api/properties`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        result = await response.json();
      }
      if (!response.ok)
        throw new Error(result.error || `Request failed (${response.status})`);
      let parcelSaveWarning = "";
      for (const parcel of additionalParcels) {
        const parcelResponse = await authFetch(
          `${API}/api/properties/${result.item.id}/parcels`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              district: form.district,
              taluk: form.taluk,
              hobli: form.hobli,
              village: form.village,
              surveyNumber: parcel.surveyNumber,
              subdivision: parcel.subdivision,
              extentRaw: parcel.extentRaw,
              sourceDescription: "Added during property workspace creation",
              factState: "known",
            }),
          },
        );
        const parcelResult = await parcelResponse.json();
        if (!parcelResponse.ok) {
          parcelSaveWarning = ` The case was created, but an additional parcel could not be saved: ${parcelResult.error || "request failed"}. Add it from the Parcels tab.`;
          break;
        }
      }
      setShowCreate(false);
      setSelected(null);
      setNotice(
        `Application ${result.item.application_number} created.${parcelSaveWarning || " The Overview has been refreshed."}`,
      );
      setProperties((current) => [
        result.item,
        ...current.filter((property) => property.id !== result.item.id),
      ]);
      setOverview((current) => ({
        ...current,
        total: Number(current.total || 0) + 1,
        in_review:
          Number(current.in_review || 0) +
          (result.item.status === "in_review" ? 1 : 0),
      }));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updateProperty = async (form: Record<string, any>) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ item: Property }>(
        `/api/properties/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      setSelected(result.item);
      setProperties((current) =>
        current.map((item) =>
          item.id === result.item.id ? { ...item, ...result.item } : item,
        ),
      );
      setShowEdit(false);
      await refresh();
      setNotice(
        `Application ${result.item.application_number} updated successfully.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const analyze = async (): Promise<boolean> => {
    if (!selected) return false;
    setBusy(true);
    setError("");
    try {
      const documentsNeedingExtraction = docs.filter(
        (document) =>
          !document.extracted_fields ||
          ["uploaded", "pending", "queued"].includes(
            String(document.processing_status || "").toLowerCase(),
          ),
      );
      let extractedCount = 0;
      if (documentsNeedingExtraction.length) {
        setNotice(
          `Automatic review: extracting ${documentsNeedingExtraction.length} document${documentsNeedingExtraction.length === 1 ? "" : "s"}…`,
        );
        for (const document of documentsNeedingExtraction) {
          await api(
            `/api/properties/${selected.id}/documents/${document.id}/extract`,
            { method: "POST" },
          );
          extractedCount += 1;
        }
      }

      setNotice("Automatic review: checking available map evidence…");
      const spatial = await api<{
        screeningStatus?: string;
        message?: string;
      }>(`/api/properties/${selected.id}/spatial-screening`);

      setNotice("Automatic review: generating preliminary findings…");
      const result = await api<{
        summary: any;
        findings: Finding[];
        dataStatus: string;
      }>(`/api/properties/${selected.id}/analyze`, { method: "POST" });

      const refreshed = await api<{
        item: Property;
        documents: Doc[];
        findings: Finding[];
      }>(`/api/properties/${selected.id}`);
      setSelected(refreshed.item);
      setDocs(refreshed.documents);
      setRiskSummary(result.summary);
      setFindings(refreshed.findings || result.findings);
      const mapNote =
        spatial.screeningStatus === "missing_coordinates"
          ? " Map screening remains pending because coordinates are missing."
          : spatial.message
            ? ` ${spatial.message}`
            : " Map screening was refreshed.";
      setNotice(
        `Automatic review completed${extractedCount ? `; ${extractedCount} document${extractedCount === 1 ? "" : "s"} extracted` : ""}.${mapNote} Review all unverified findings before lawyer sign-off.`,
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const uploadFiles = async (
    files: FileList | File[] | null,
    metadata?: Array<{
      documentType: string;
      customDocumentType: string;
      classificationConfidence: number;
      manualReview: boolean;
    }>,
  ): Promise<Doc[]> => {
    if (!selected || !files || !files.length) return [];
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      Array.from(files).forEach((file) => body.append("files", file));
      if (metadata) body.append("metadata", JSON.stringify(metadata));
      const result = await api<{ items: Doc[]; note: string }>(
        `/api/properties/${selected.id}/documents`,
        { method: "POST", body },
      );
      setDocs((prev) => [...result.items, ...prev]);
      setNotice(result.note);
      await refresh();
      return result.items;
    } catch (e) {
      setError((e as Error).message);
      return [];
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await authFetch(
        `${API}/api/properties/${selected.id}/report`,
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Unable to create report");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ojix-property-report-${selected.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const printReport = async () => {
    if (!selected) return;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setError("Pop-up blocked. Allow pop-ups to print the report.");
      return;
    }
    reportWindow.document.write(
      '<title>OJIX Property Report</title><p style="font-family:Arial;padding:24px">Preparing evidence report…</p>',
    );
    setBusy(true);
    try {
      const res = await authFetch(
        `${API}/api/properties/${selected.id}/report`,
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Unable to create report");
      }
      const report = await res.json();
      const p = report.property || {};
      const docsHtml = (report.documents || [])
        .map(
          (d: any) =>
            `<tr><td>${escapeHtml(d.original_filename)}</td><td>${escapeHtml(d.mime_type)}</td><td>${escapeHtml(String(d.processing_status))}</td><td>${escapeHtml(String(d.sha256 || ""))}</td></tr>`,
        )
        .join("");
      const findingsHtml =
        (report.findings || [])
          .map(
            (f: any) =>
              `<article><h3>${escapeHtml(f.title)} <small>${escapeHtml(f.severity)} · ${escapeHtml(f.evidence_status)} evidence</small></h3><p>${escapeHtml(f.explanation)}</p><p><b>Next action:</b> ${escapeHtml(f.next_action)}</p></article>`,
          )
          .join("") || "<p>No screening findings recorded yet.</p>";
      reportWindow.document.open();
      reportWindow.document.write(
        `<!doctype html><html><head><title>OJIX Property Evidence Report</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:13px Arial,sans-serif;color:#243247;max-width:900px;margin:36px auto;padding:0 28px;line-height:1.5}h1{font-size:26px;margin:4px 0}h2{font-size:16px;border-bottom:1px solid #dfe5ed;padding-bottom:7px;margin-top:28px}.eyebrow{font-size:10px;letter-spacing:1.5px;color:#b34a42;font-weight:bold}p{color:#5c6879}table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}td,th{padding:8px;border:1px solid #e2e6ec;text-align:left;overflow-wrap:anywhere}th{background:#f5f7fa}article{border:1px solid #e2e6ec;padding:12px 15px;margin:10px 0;border-radius:6px}article h3{font-size:13px;margin:0}article small{color:#9b7430;font-weight:normal}article p{font-size:12px;margin:8px 0}.warning{border:1px solid #ecdcb6;background:#fff9ed;padding:12px;border-radius:6px;color:#806a40;font-size:11px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px}.meta div{padding:10px;background:#f7f9fb;border-radius:5px}.meta span{display:block;color:#8792a2;font-size:10px}.meta b{font-size:12px}@media print{body{margin:0;max-width:none}.no-print{display:none}}</style></head><body><div class="eyebrow">OJIX PROPERTY INTELLIGENCE</div><h1>Property Evidence Report</h1><p>Generated ${escapeHtml(new Date(report.generatedAt).toLocaleString())} · Preliminary due-diligence workspace</p><h2>Property identity</h2><div class="meta"><div><span>Property name</span><b>${escapeHtml(p.name || "Not recorded")}</b></div><div><span>Survey number / subdivision</span><b>${escapeHtml([p.survey_number, p.subdivision].filter(Boolean).join(" / ") || "Not recorded")}</b></div><div><span>Village / Hobli / Taluk</span><b>${escapeHtml([p.village, p.hobli, p.taluk].filter(Boolean).join(" / ") || "Not recorded")}</b></div><div><span>District</span><b>${escapeHtml(p.district || "Not recorded")}</b></div><div><span>Extent</span><b>${escapeHtml(p.extent || "Not recorded")}</b></div><div><span>Coordinates</span><b>${escapeHtml(p.latitude != null && p.longitude != null ? `${p.latitude}, ${p.longitude}` : "Not recorded")}</b></div></div><h2>Source documents (${(report.documents || []).length})</h2><table><thead><tr><th>Filename</th><th>Type</th><th>Processing status</th><th>SHA-256 checksum</th></tr></thead><tbody>${docsHtml || '<tr><td colspan="4">No documents uploaded.</td></tr>'}</tbody></table><h2>Review findings (${(report.findings || []).length})</h2>${findingsHtml}<h2>Limitations and professional review</h2><div class="warning">${escapeHtml(report.reviewNotice || "This is not a legal opinion or government certification.")}<br><br>${(report.dataLimitations || []).map((x: string) => escapeHtml(x)).join("<br>")}</div><p class="no-print">Use your browser's Print command and choose “Save as PDF” to create a PDF copy.</p><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));</script></body></html>`,
      );
      reportWindow.document.close();
    } catch (e) {
      reportWindow.close();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = properties.filter((p) =>
    `${p.application_number || ""} ${p.name} ${p.village} ${p.survey_number} ${p.property_identifier_type || ""} ${p.property_identifier || ""} ${p.district}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const navigate = (next: Exclude<AppPage, "property">) => {
    const activeRole = currentUser?.role;
    if (!activeRole || !canAccessPage(currentUser!, next) || (portalMode === "super-admin" ? next !== "super-admin" : next === "super-admin")) {
      setError("This page is not available for your assigned role.");
      setPage(portalMode === "super-admin" ? "super-admin" : "overview");
      updateBrowserUrl(portalMode === "super-admin" ? "super-admin" : "overview");
      return;
    }
    setPage(next);
    updateBrowserUrl(next);
    setMobileNav(false);
    setSelected(null);
    setNotice("");
  };

  useEffect(() => {
    const handlePlatformNavigation = (event: Event) => {
      const target = (event as CustomEvent<string>).detail as Exclude<
        AppPage,
        "property"
      >;
      if (currentUser?.isSuperAdmin && target) navigate(target);
    };
    window.addEventListener("ojix:navigate", handlePlatformNavigation);
    return () =>
      window.removeEventListener("ojix:navigate", handlePlatformNavigation);
  }, [currentUser?.isSuperAdmin]);

  const getPageTitle = () => {
    switch (page) {
      case "overview":
        return "Overview";
      case "properties":
        return "Properties";
      case "all-documents":
        return "Document Vault & Evidence Repository";
      case "all-findings":
        return "Risk Reviews & Audit Findings";
      case "all-maps":
        return "Map Intelligence & Spatial Review";
      case "legal-research":
        return "Legal Research & Case Precedents";
      case "source-registry":
        return "Government Source Catalog & Connection Status";
      case "settings":
        return "Workspace & Engine Settings";
      case "admin-overview":
        return "Organisation Administration";
      case "super-admin":
        return "Super Admin";
      case "workflow-guide":
        return "Workflow Guide";
      case "lawyer-workbench":
        return "Lawyer Workspace – Pending Work";
      case "consultant-issues":
        return "Consultant · Property Issue List";
      case "consultant-reports":
        return "Consultant · Report Preparation";
      case "consultant-exports":
        return "Consultant · Approved Report Exports";
      case "consultant-shared":
        return "Consultant · Shared Client Reports";
      case "admin-members":
        return "Admin · Members";
      case "admin-roles":
        return "Admin · Roles & Permissions";
      case "admin-applications":
        return "Admin · Applications";
      case "admin-documents":
        return "Admin · Documents";
      case "admin-integrations":
        return "Admin · Integrations";
      case "admin-security":
        return "Admin · Security";
      case "admin-retention":
        return "Admin · Retention";
      case "admin-audit":
        return "Admin · Audit";
      case "admin-sources": return "Admin · Source Health";
      case "admin-gis-rules": return "Admin · GIS Rules";
      case "admin-discrepancy-rules": return "Admin · Discrepancy Rules";
      case "admin-models": return "Admin · AI Models";
      case "admin-templates": return "Admin · Report Templates";
      case "admin-exports": return "Admin · Export History";
      case "property":
        return selected?.name || "Property workspace";
      default:
        return "Overview";
    }
  };

  const sharedReportMatch = window.location.pathname.match(/^\/shared\/reports\/([a-f0-9]{64})\/?$/i);
  if (sharedReportMatch) return <SharedConsultantReport apiUrl={API} token={sharedReportMatch[1]} />;
  if (authChecking) {
    return (
      <div className="login-loading">
        <LoaderCircle size={24} className="spin" />
        <span>Validating secure session…</span>
      </div>
    );
  }

  if (!currentUser || !authToken) {
    return (
      <><div className={sessionExpiredMessage ? "session-expired-notice is-visible" : "session-expired-notice"} role="alert">{sessionExpiredMessage}</div><LoginPage
        apiUrl={API}
        expectedRole={loginRoleFromPath(window.location.pathname)}
        onLoginSuccess={(token, user, requestedRole) => {
          sessionStorage.removeItem("ojix_session_expired_message");
          setSessionExpiredMessage("");
          const requestedPortal = requestedRole;
          const openSuperAdmin = requestedPortal === "super-admin";
          localStorage.setItem("ojix_auth_token", token);
          localStorage.setItem("ojix_user", JSON.stringify(user));
          if(user.tenantId){localStorage.setItem("ojix_workspace_id",user.tenantId);setActiveWorkspaceId(user.tenantId);}
          else{localStorage.removeItem("ojix_workspace_id");setActiveWorkspaceId("");}
          localStorage.setItem("ojix_portal_mode", openSuperAdmin ? "super-admin" : "workspace");
          setAuthChecking(true);
          setAuthToken(token);
          setCurrentUser(user);
          setPortalMode(openSuperAdmin ? "super-admin" : "workspace");
          setPage(openSuperAdmin ? "super-admin" : "overview");
          window.history.replaceState(
            { page: openSuperAdmin ? "super-admin" : "overview" },
            "",
            dashboardPathForUser(user, openSuperAdmin),
          );
        }}
      /></>
    );
  }

  const getRoleStyle = (role?: UserRole) => {
    switch (role) {
      case "super_admin":
        return { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe", label: "SUPER ADMIN" };
      case "owner":
        return {
          bg: "#eef2ff",
          text: "#4338ca",
          border: "#c7d2fe",
          label: "OWNER",
        };
      case "admin":
        return {
          bg: "#e0f2fe",
          text: "#0369a1",
          border: "#bae6fd",
          label: "ADMIN",
        };
      case "lawyer":
        return {
          bg: "#eff6ff",
          text: "#1d4ed8",
          border: "#bfdbfe",
          label: "LAWYER",
        };
      case "analyst":
        return {
          bg: "#ecfdf5",
          text: "#047857",
          border: "#a7f3d0",
          label: "ANALYST",
        };
      case "operations":
        return {
          bg: "#fff7ed",
          text: "#c2410c",
          border: "#fed7aa",
          label: "OPERATIONS",
        };
      case "consultant":
        return {
          bg: "#f0fdfa",
          text: "#0f766e",
          border: "#99f6e4",
          label: "CONSULTANT",
        };
      case "support":
        return {
          bg: "#f5f3ff",
          text: "#7c3aed",
          border: "#ddd6fe",
          label: "SUPPORT",
        };
      case "data_steward":
        return {
          bg: "#ecfeff",
          text: "#0e7490",
          border: "#a5f3fc",
          label: "DATA STEWARD",
        };
      case "viewer":
        return {
          bg: "#fffbeb",
          text: "#b45309",
          border: "#fde68a",
          label: "VIEWER",
        };
      default:
        return {
          bg: "#f1f5f9",
          text: "#475569",
          border: "#cbd5e1",
          label: "MEMBER",
        };
    }
  };
  const roleStyle = portalMode === "super-admin"
    ? { bg: "#fef2f2", text: "#b42318", border: "#fecaca", label: "SUPER ADMIN" }
    : getRoleStyle(currentUser.role);
  const displayedUserName = portalMode === "super-admin" ? "Sharath — Super Admin" : currentUser.name;

  return (
    <div className={`app-shell premium-shell role-${currentUser.role} ${portalMode === "super-admin" ? "platform-only-shell" : ""}`}>
      {portalMode === "workspace" && currentUser.role === "owner" && (
        <OwnerInactivityGuard onExpire={handleOwnerInactivity} apiUrl={API} />
      )}
      <aside className={`sidebar ${portalMode === "super-admin" ? "super-admin-sidebar" : ""} ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <img
            className="brand-logo"
            src="/assets/ojix-primary-dark.png"
            alt="OJIX Property Intelligence"
          />
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobileNav(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        {portalMode === "super-admin" && <>
          <div className="workspace-switch platform-switch">
            <div className="workspace-icon">SA</div>
            <div className="workspace-copy"><strong>OJIX Platform</strong><span>Global administration</span></div>
          </div>
          <div className="nav-label super-admin-nav-label">PLATFORM CONTROL</div>
          <nav className="super-admin-nav">
            <button className={`nav-item ${page === "super-admin" ? "active" : ""}`} onClick={() => navigate("super-admin")}>
              <ShieldAlert size={18}/><span>Super Admin Console</span>
            </button>
          </nav>
        </>}
        <div className="workspace-switch">
          <div className="workspace-icon">OD</div>
          <div className="workspace-copy">
            <strong>OJIX Demo Workspace</strong>
            <span>Property due diligence</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">
          {currentUser.role === "admin"
            ? "ADMINISTRATION"
            : currentUser.role === "lawyer"
              ? "LEGAL REVIEW"
              : currentUser.role === "analyst"
                ? "EVIDENCE ANALYSIS"
                : currentUser.role === "operations"
                  ? "DOCUMENT INTAKE"
                  : currentUser.role === "consultant"
                    ? "CLIENT DOSSIERS"
                    : currentUser.role === "support"
                      ? "SUPPORT DIAGNOSTICS"
                      : currentUser.role === "data_steward"
                        ? "DATA GOVERNANCE"
                        : currentUser.role === "viewer"
                          ? "CLIENT ACCESS"
                          : "WORKSPACE"}
        </div>
        <nav>
          <button
            className={`nav-item ${page === "overview" ? "active" : ""}`}
            onClick={() => navigate("overview")}
          >
            <LayoutDashboard size={18} />
            <span>
              {currentUser.role === "admin"
                ? "Admin Overview"
                : currentUser.role === "lawyer"
                  ? "Lawyer Overview"
                  : currentUser.role === "analyst"
                    ? "Analyst Overview"
                    : currentUser.role === "operations"
                      ? "Operations Overview"
                      : currentUser.role === "consultant"
                        ? "Consultant Overview"
                        : currentUser.role === "support"
                          ? "System Diagnostics"
                          : currentUser.role === "data_steward"
                            ? "Data Quality Overview"
                            : currentUser.role === "viewer"
                              ? "Released Reports"
                              : currentUser.role === "owner" ? "Dashboard" : "Overview"}
            </span>
          </button>
          {!["admin", "support"].includes(currentUser.role) && (
            <button
              className={`nav-item ${page === "properties" || page === "property" ? "active" : ""}`}
              onClick={() => navigate("properties")}
            >
              <Building2 size={18} />
              <span>
                {currentUser.role === "viewer"
                  ? "Approved matters"
                  : currentUser.role === "owner"
                    ? "Portfolio & Matters"
                  : currentUser.role === "consultant"
                    ? "Client Matters"
                    : currentUser.role === "data_steward"
                      ? "Reference Data QA"
                      : ["lawyer", "analyst", "operations"].includes(
                            currentUser.role,
                          )
                        ? "Assigned Applications"
                        : "Properties"}
              </span>
              <span className="nav-count">
                {[
                  "viewer",
                  "lawyer",
                  "analyst",
                  "operations",
                  "consultant",
                  "data_steward",
                ].includes(currentUser.role)
                  ? properties.length
                  : overview.total}
              </span>
            </button>
          )}
          {!["admin", "viewer", "support"].includes(currentUser.role) && (
            <button
              className={`nav-item ${page === "all-documents" ? "active" : ""}`}
              onClick={() => navigate("all-documents")}
            >
              <FolderOpen size={18} />
              <span>
                {currentUser.role === "lawyer"
                  ? "Evidence Review"
                  : currentUser.role === "analyst"
                    ? "Extraction Review"
                    : currentUser.role === "operations"
                      ? "Upload Documents"
                      : currentUser.role === "consultant"
                        ? "Evidence Register"
                        : currentUser.role === "data_steward"
                          ? "Ingestion Register"
                          : currentUser.role === "owner" ? "Documents" : "Document Vault"}
              </span>
            </button>
          )}
          {![
            "admin",
            "operations",
            "viewer",
            "support",
            "data_steward",
          ].includes(currentUser.role) && (
            <button
              className={`nav-item ${page === "all-findings" ? "active" : ""}`}
              onClick={() => navigate("all-findings")}
            >
              <ShieldAlert size={18} />
              <span>
                {currentUser.role === "lawyer"
                  ? "Legal Issues"
                  : currentUser.role === "analyst"
                    ? "Preliminary Findings"
                    : currentUser.role === "consultant"
                      ? "Issue Register"
                      : currentUser.role === "owner" ? "Risk & Compliance" : "Risk reviews"}
              </span>
            </button>
          )}
          {["owner", "admin", "lawyer", "analyst"].includes(currentUser.role) && (
            <button className={`nav-item ${page === "lawyer-workbench" ? "active" : ""}`} onClick={() => navigate("lawyer-workbench")}>
              <ClipboardCheck size={18} />
              <span>{currentUser.role === "owner" ? "Matters & Case Files" : "Lawyer Workbench"}</span>
            </button>
          )}
          {currentUser.role === "owner" && (
            <button className={`nav-item ${page === "consultant-reports" ? "active" : ""}`} onClick={() => navigate("consultant-reports")}>
              <FileCheck2 size={18}/><span>Reports</span>
            </button>
          )}
          {currentUser.role === "consultant" && (
            <>
              <button className={`nav-item ${page === "consultant-issues" ? "active" : ""}`} onClick={() => navigate("consultant-issues")}><ShieldAlert size={18}/><span>Property Issue List</span></button>
              <button className={`nav-item ${page === "consultant-reports" ? "active" : ""}`} onClick={() => navigate("consultant-reports")}><FileCheck2 size={18}/><span>Report Preparation</span></button>
              <button className={`nav-item ${page === "consultant-exports" ? "active" : ""}`} onClick={() => navigate("consultant-exports")}><Download size={18}/><span>Report Exports</span></button>
              <button className={`nav-item ${page === "consultant-shared" ? "active" : ""}`} onClick={() => navigate("consultant-shared")}><ExternalLink size={18}/><span>Shared Client Reports</span></button>
            </>
          )}
          {currentUser.role === "lawyer" && (
            <button className={`nav-item ${page === "consultant-issues" ? "active" : ""}`} onClick={() => navigate("consultant-issues")}><ShieldCheck size={18}/><span>Finding Review</span></button>
          )}
          {!["admin", "lawyer", "operations", "viewer", "support"].includes(
            currentUser.role,
          ) && (
            <button
              className={`nav-item ${page === "all-maps" ? "active" : ""}`}
              onClick={() => navigate("all-maps")}
            >
              <MapIcon size={18} />
              <span>
                {currentUser.role === "analyst"
                  ? "Map & GIS"
                  : currentUser.role === "consultant"
                    ? "Map Context"
                    : currentUser.role === "data_steward"
                      ? "GIS Layer QA"
                      : "Map intelligence"}
              </span>
            </button>
          )}
        </nav>
        {!["admin", "analyst", "operations", "viewer", "support"].includes(
          currentUser.role,
        ) && (
          <>
            <div className="nav-label nav-label-spaced">TOOLS</div>
            <nav>
              {currentUser.role !== "data_steward" && (
                <button
                  className={`nav-item ${page === "legal-research" ? "active" : ""}`}
                  onClick={() => navigate("legal-research")}
                >
                  <BookOpen size={18} />
                  <span>Legal research</span>
                </button>
              )}
              {currentUser.role !== "lawyer" && (
                <button
                  className={`nav-item ${page === "source-registry" ? "active" : ""}`}
                  onClick={() => navigate("source-registry")}
                >
                  <Activity size={18} />
                  <span>Source registry</span>
                </button>
              )}
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${page === "workflow-guide" ? "active" : ""}`}
            onClick={() => navigate("workflow-guide")}
          >
            <CircleHelp size={18} />
            <span>Workflow Guide</span>
          </button>
          {currentUser.role !== "admin" && (
            <div className="secure-note">
              <ShieldCheck size={16} />
              <div>
                <strong>Evidence-first workflow</strong>
                <span>Every finding needs a source.</span>
              </div>
            </div>
          )}
          {["owner", "admin"].includes(currentUser.role) && (
            <button
              className={`nav-item ${ADMIN_PAGES.includes(page as AdminSection) ? "active" : ""}`}
              onClick={() => navigate("admin-overview")}
            >
              <Key size={18} />
              <span>{currentUser.role === "owner" ? "Team & Access" : "Admin Console"}</span>
            </button>
          )}
          {currentUser.isSuperAdmin && portalMode === "super-admin" && (
            <button
              className={`nav-item ${page === "super-admin" ? "active" : ""}`}
              onClick={() => navigate("super-admin")}
            >
              <ShieldAlert size={18} />
              <span>Super Admin</span>
            </button>
          )}
          {["owner", "admin"].includes(currentUser.role) && (
            <button
              className={`nav-item ${page === "settings" ? "active" : ""}`}
              onClick={() => navigate("settings")}
            >
              <Settings2 size={18} />
              <span>{currentUser.role === "owner" ? "Workspace Settings" : "Settings"}</span>
            </button>
          )}
          <div
            className="user-profile"
            onClick={
              import.meta.env.DEV ? () => setShowRoleSwitcher(true) : undefined
            }
            style={{ cursor: import.meta.env.DEV ? "pointer" : "default" }}
            title={
              import.meta.env.DEV
                ? "Click to switch development test role"
                : undefined
            }
          >
            <div
              className="avatar"
              style={{ backgroundColor: roleStyle.text, color: "#fff" }}
            >
              {currentUser.avatar || initials(displayedUserName)}
            </div>
            <div className="user-copy">
              <strong>{displayedUserName}</strong>
              <span style={{ color: roleStyle.text, fontWeight: 700 }}>
                {portalMode === "super-admin" ? "Platform Administrator" : currentUser.designation}
              </span>
            </div>
            {import.meta.env.DEV && <MoreHorizontal size={18} />}
          </div>
        </div>
      </aside>
      {mobileNav && (
        <div className="nav-scrim" onClick={() => setMobileNav(false)} />
      )}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobileNav(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              Workspace <span>/</span> <strong>{getPageTitle()}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            {workspaces.length>1&&<label className="workspace-picker"><span>Workspace</span><select aria-label="Select authorized workspace" value={activeWorkspaceId} onChange={event=>void switchWorkspace(event.target.value)}>{workspaces.map(workspace=><option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.role.replace(/_/g,' ')}</option>)}</select></label>}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 10px",
                borderRadius: "16px",
                backgroundColor: roleStyle.bg,
                border: `1px solid ${roleStyle.border}`,
                color: roleStyle.text,
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.5px",
              }}
            >
              {roleStyle.label}
            </div>

            {import.meta.env.DEV && (
              <button
                className="secondary-btn"
                onClick={() => setShowRoleSwitcher(true)}
                title="Switch dummy account to test RBAC"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                <UserCheck size={14} /> Switch Account
              </button>
            )}

            <button
              className="icon-btn"
              onClick={() => {
                setPasswordForm({
                  currentPassword: "",
                  newPassword: "",
                  confirmPassword: "",
                });
                setShowPasswordChange(true);
              }}
              title="Change Password"
              aria-label="Change password"
              style={{ color: "#64748b" }}
            >
              <Key size={16} />
            </button>

            <button
              className="icon-btn"
              onClick={() => handleLogout()}
              title="Sign Out"
              aria-label="Sign out"
              style={{ color: "#64748b" }}
            >
              <LogOut size={16} />
            </button>

            <div
              className="top-avatar"
              style={{ backgroundColor: roleStyle.text, color: "#fff" }}
            >
              {currentUser.avatar || initials(displayedUserName)}
            </div>
          </div>
        </header>

        {currentUser.role === "viewer" && (
          <div
            style={{
              background: "#fffbeb",
              borderBottom: "1px solid #fde68a",
              padding: "8px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "11px",
              color: "#92400e",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle
                size={15}
                style={{ color: "#d97706", flexShrink: 0 }}
              />
              <span>
                <strong>Read-Only Auditor Mode:</strong> Logged in as{" "}
                <strong>{currentUser.name} (VIEWER)</strong>. Modifying
                properties, uploading documents, running screening analyses, and
                updating title/settings are blocked by RBAC.
              </span>
            </div>
            <button
              onClick={() => setShowRoleSwitcher(true)}
              style={{
                background: "#d97706",
                color: "#fff",
                border: "none",
                padding: "3px 8px",
                borderRadius: "4px",
                fontSize: "10px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Switch Role
            </button>
          </div>
        )}

        <div className="content">
          {error && (
            <div className="alert alert-error">
              <AlertTriangle size={17} />
              <span>{error}</span>
              <button onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert alert-info">
              <Sparkles size={17} />
              <span>{notice}</span>
              <button onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {page === "overview" &&
            (currentUser.role === "lawyer" ? (
              <ReviewerOverview
                overview={overview}
                properties={properties}
                loading={loading}
                onOpen={openProperty}
                onProperties={() => navigate("properties")}
                currentUser={currentUser}
              />
            ) : currentUser.role === "operations" ? (
              <DocumentIntakeDashboard
                properties={properties}
                loading={loading}
                onOpen={openProperty}
                onRefresh={refresh}
                currentUser={currentUser}
              />
            ) : currentUser.role === "analyst" ? (
              <AnalystDashboard
                overview={overview}
                properties={properties}
                loading={loading}
                onOpen={openProperty}
                currentUser={currentUser}
              />
            ) : currentUser.role === "admin" ? (
              <AdminDashboard
                overview={overview}
                properties={properties}
                accounts={availableAccounts}
                loading={loading}
                currentUser={currentUser}
                onNavigate={navigate}
              />
            ) : currentUser.role === "viewer" ? (
              <ClientDashboard
                properties={properties}
                loading={loading}
                currentUser={currentUser}
                onOpen={openProperty}
              />
            ) : currentUser.role === "consultant" ? (
              <ConsultantDashboard
                overview={overview}
                properties={properties}
                loading={loading}
                currentUser={currentUser}
                apiUrl={API}
                onOpen={openProperty}
                onNavigate={navigate}
              />
            ) : currentUser.role === "support" ? (
              <SupportDashboard overview={overview} currentUser={currentUser} />
            ) : currentUser.role === "data_steward" ? (
              <DataStewardDashboard
                overview={overview}
                properties={properties}
                loading={loading}
                currentUser={currentUser}
                onNavigate={navigate}
              />
            ) : currentUser.role === "owner" ? (
              <OwnerDashboard
                overview={overview}
                dashboardData={ownerDashboardData}
                dashboardError={ownerDashboardError}
                properties={properties}
                accounts={availableAccounts}
                loading={loading}
                currentUser={currentUser}
                onOpen={openProperty}
                onNavigate={navigate}
                pendingActionFilter={ownerDashboardActionFilter}
                onPendingAction={(action) => {
                  setOwnerDashboardActionFilter(action.id);
                  navigate(action.target);
                }}
                onRefresh={() => void refresh()}
                onPropertyUpdated={(item) => setProperties((current) => current.map((property) => property.id === item.id ? { ...property, ...item } : property))}
              />
            ) : (
              <Overview
                overview={overview}
                properties={properties}
                loading={loading}
                onCreate={() => setShowCreate(true)}
                onOpen={openProperty}
                onProperties={() => navigate("properties")}
                currentUser={currentUser}
              />
            ))}
          {page === "properties" && (
            <PropertiesPage
              properties={filtered}
              query={query}
              setQuery={setQuery}
              loading={loading}
              onCreate={() => setShowCreate(true)}
              onOpen={openProperty}
              currentUser={currentUser}
            />
          )}
          {page === "lawyer-workbench" && (
            <LawyerWorkbench apiUrl={API} properties={properties} currentUser={currentUser} onOpenProperty={(id) => void openPropertyById(id)} initialFilter={ownerDashboardActionFilter === "overdue" ? "overdue" : undefined} />
          )}
          {["consultant-issues","consultant-reports","consultant-exports","consultant-shared"].includes(page) && (
            <ConsultantWorkspace apiUrl={API} properties={properties} currentUser={currentUser} mode={page === "consultant-issues" ? "issues" : page === "consultant-exports" ? "exports" : page === "consultant-shared" ? "shared" : "reports"} onOpenProperty={(id) => void openPropertyById(id)} onNavigate={navigate} initialApprovalStatus={ownerDashboardActionFilter === "legal" ? "submitted" : undefined} />
          )}
          {page === "property" && selected && (
            <PropertyPage
              property={selected}
              docs={docs}
              findings={findings}
              riskSummary={riskSummary}
              busy={busy}
              onAnalyze={analyze}
              onUpload={uploadFiles}
              onReport={downloadReport}
              onPrint={printReport}
              onEdit={() => setShowEdit(true)}
              onWorkflowUpdated={async (item) => {
                setSelected(item);
                setProperties((current) =>
                  current.map((property) =>
                    property.id === item.id
                      ? { ...property, ...item }
                      : property,
                  ),
                );
                await refresh();
                setNotice(`Workflow for ${item.application_number} updated.`);
              }}
              onBack={() => navigate("properties")}
              onDocUpdated={async (updatedDoc) => {
                setDocs((prev) =>
                  prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)),
                );
                await refresh();
              }}
              currentUser={currentUser}
            />
          )}
          {page === "all-documents" && (
            <GlobalDocumentsView
              apiUrl={API}
              onOpenProperty={openPropertyById}
              initialReviewOnly={ownerDashboardActionFilter === "documents"}
            />
          )}
          {page === "all-findings" && (
            <GlobalRiskView apiUrl={API} onOpenProperty={openPropertyById} />
          )}
          {page === "all-maps" && (
            <GlobalMapView
              properties={properties}
              apiUrl={API}
              onOpenProperty={openProperty}
            />
          )}
          {page === "legal-research" && (
            <LegalResearchView apiUrl={API} onOpenProperty={openPropertyById} />
          )}
          {page === "source-registry" && (
            <SourceRegistryView
              apiUrl={API}
              properties={properties}
              onOpenProperty={openProperty}
              currentUser={currentUser}
              onCreateProperty={createProperty}
            />
          )}
          {page === "settings" && (
            <SettingsView apiUrl={API} currentUser={currentUser} />
          )}
          {page === "api-console" && <ApiConsole />}
          {page === "super-admin" && currentUser.isSuperAdmin && portalMode === "super-admin" && (
            <SuperAdminPage apiUrl={API} />
          )}
          {page === "workflow-guide" && (
            <WorkflowGuide currentUser={currentUser} onNavigate={navigate} showSuperAdmin={portalMode === "super-admin"} />
          )}
          {ADMIN_PAGES.includes(page as AdminSection) && (
            <AdminModule
              key={page}
              apiUrl={API}
              section={page as AdminSection}
              onNavigate={(next) => navigate(next)}
            />
          )}
        </div>
        <footer className="footer">
          <span>
            OJIX Property Intelligence <b>•</b> MVP 0.1.0
          </span>
          <span>
            <ShieldCheck size={13} /> Confidential workspace <b>•</b>{" "}
            Evidence-based, not legal advice
          </span>
        </footer>
      </main>
      {showPasswordChange && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setShowPasswordChange(false);
          }}
        >
          <div className="modal" style={{ maxWidth: "470px" }}>
            <div className="modal-header">
              <div>
                <div className="eyebrow">ACCOUNT SECURITY</div>
                <h2>Change password</h2>
                <p>
                  Super Admin will see the security event, never your password.
                </p>
              </div>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setShowPasswordChange(false)}
                aria-label="Close password change"
              >
                <X size={17} />
              </button>
            </div>
            <form onSubmit={changePassword}>
              <div className="form-grid">
                <label className="form-field span-2">
                  <span>Current password</span>
                  <input
                    autoFocus
                    required
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        currentPassword: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="form-field span-2">
                  <span>New password</span>
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={currentUser?.isSuperAdmin ? 12 : 8}
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        newPassword: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="form-field span-2">
                  <span>Confirm new password</span>
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={currentUser?.isSuperAdmin ? 12 : 8}
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirmPassword: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="form-note">
                <ShieldCheck size={15} /> {currentUser?.isSuperAdmin ? "Use 12+ characters with uppercase, lowercase, a number and a special character." : "Use at least eight characters with uppercase, lowercase, and a number."} Other sessions will be revoked.
              </div>
              <div className="modal-actions">
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={() => setShowPasswordChange(false)}
                >
                  Cancel
                </button>
                <button className="primary-btn" type="submit" disabled={busy}>
                  Save new password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showCreate && (
        <CreatePropertyModal
          onClose={() => setShowCreate(false)}
          onSubmit={createProperty}
          busy={busy}
        />
      )}
      {showEdit && selected && (
        <CreatePropertyModal
          initialProperty={selected}
          onClose={() => setShowEdit(false)}
          onSubmit={updateProperty}
          busy={busy}
        />
      )}
      {import.meta.env.DEV && showRoleSwitcher && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowRoleSwitcher(false);
          }}
        >
          <div className="modal" style={{ maxWidth: "560px" }}>
            <div className="modal-header">
              <div>
                <div className="eyebrow">RBAC IDENTITY SIMULATION</div>
                <h2>Switch Active User & Role</h2>
                <p>
                  Instantly switch dummy accounts to test frontend & backend
                  RBAC permissions.
                </p>
              </div>
              <button
                className="icon-btn"
                onClick={() => setShowRoleSwitcher(false)}
              >
                <X size={19} />
              </button>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                padding: "20px 24px",
              }}
            >
              {availableAccounts.map((acc) => {
                const style = getRoleStyle(acc.role);
                const isCurrent = currentUser?.uid === acc.uid;
                return (
                  <div
                    key={acc.uid}
                    onClick={() => switchRole(acc.uid)}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "8px",
                      border: `1.5px solid ${isCurrent ? "#2563eb" : "#e2e8f0"}`,
                      backgroundColor: isCurrent ? "#eff6ff" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        backgroundColor: style.bg,
                        color: style.text,
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        fontSize: "13px",
                        flexShrink: 0,
                      }}
                    >
                      {acc.avatar}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                          {acc.name}
                        </strong>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: style.bg,
                            color: style.text,
                            border: `1px solid ${style.border}`,
                            textTransform: "uppercase",
                          }}
                        >
                          {acc.role}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#64748b",
                          display: "block",
                        }}
                      >
                        {acc.designation} • {acc.email}
                      </span>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: "10px",
                          color: "#475569",
                        }}
                      >
                        {acc.description}
                      </p>
                    </div>
                    {isCurrent && (
                      <Check
                        size={18}
                        style={{ color: "#2563eb", flexShrink: 0 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div
              className="modal-actions"
              style={{
                padding: "12px 24px 20px",
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowRoleSwitcher(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {busy && (
        <div className="busy-indicator">
          <LoaderCircle size={16} className="spin" /> Processing request…
        </div>
      )}
    </div>
  );
}

function DataStewardDashboard({
  overview,
  properties,
  loading,
  currentUser,
  onNavigate,
}: {
  overview: any;
  properties: Property[];
  loading: boolean;
  currentUser: UserAccount;
  onNavigate: (
    page: "source-registry" | "all-maps" | "all-documents" | "properties",
  ) => void;
}) {
  const qualityChecks = [
    {
      label: "Official hierarchy reference",
      count: properties.filter(
        (p) => !p.district_id || !p.taluk_id || !p.hobli_id || !p.village_id,
      ).length,
      note: "Properties missing one or more reference IDs",
    },
    {
      label: "Normalized extent",
      count: properties.filter((p) => p.extent_value === null || !p.extent_unit)
        .length,
      note: "Properties without normalized measurement",
    },
    {
      label: "Coordinate provenance",
      count: properties.filter(
        (p) =>
          (p.latitude !== null || p.longitude !== null) && !p.coordinate_source,
      ).length,
      note: "Mapped properties missing coordinate source",
    },
    {
      label: "Property identifier",
      count: properties.filter((p) => !p.property_identifier).length,
      note: "Properties without PID, khata or site ID",
    },
    {
      label: "Four-side boundaries",
      count: properties.filter(
        (p) =>
          !p.boundary_north ||
          !p.boundary_south ||
          !p.boundary_east ||
          !p.boundary_west,
      ).length,
      note: "Properties with incomplete boundary facts",
    },
  ];
  const totalIssues = qualityChecks.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="steward-dashboard">
      <div className="steward-welcome">
        <div>
          <div className="eyebrow">OJIX DATA STEWARD</div>
          <h1>Source and ingestion governance</h1>
          <p>
            Welcome, {currentUser.name}. Maintain trustworthy mappings, rule
            metadata and reference-data quality without making legal
            conclusions.
          </p>
        </div>
        <button
          className="primary-btn"
          onClick={() => onNavigate("source-registry")}
        >
          <Activity size={16} /> Open source registry
        </button>
      </div>
      <div className="steward-kpis">
        <div>
          <span>
            <Building2 />
          </span>
          <small>Records inspected</small>
          <strong>{loading ? "—" : properties.length}</strong>
          <p>Current tenant properties</p>
        </div>
        <div>
          <span>
            <AlertTriangle />
          </span>
          <small>Quality observations</small>
          <strong>{loading ? "—" : totalIssues}</strong>
          <p>Across configured checks</p>
        </div>
        <div>
          <span>
            <FileText />
          </span>
          <small>Source documents</small>
          <strong>{loading ? "—" : overview.documents || 0}</strong>
          <p>Available for ingestion QA</p>
        </div>
        <div>
          <span>
            <Layers3 />
          </span>
          <small>GIS configuration</small>
          <strong>Demo</strong>
          <p>Production sources not connected</p>
        </div>
      </div>
      <div className="steward-main-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Ingestion quality queue</h3>
              <p>
                Metadata completeness observations; these are not legal
                findings.
              </p>
            </div>
            <span className="result-count">{totalIssues} observations</span>
          </div>
          <div className="quality-check-list">
            {qualityChecks.map((item) => (
              <div key={item.label}>
                <span className={item.count ? "attention" : "complete"}>
                  {item.count ? (
                    <AlertTriangle size={14} />
                  ) : (
                    <Check size={14} />
                  )}
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.note}</small>
                </div>
                <b>{item.count}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel steward-sources">
          <div className="panel-head">
            <div>
              <h3>Source pipeline state</h3>
              <p>Authority and processing availability</p>
            </div>
            <Activity size={18} className="panel-head-icon" />
          </div>
          <SourceStatus
            label="MariaDB workspace"
            status={pretty(overview.sourceHealth?.database || "Connected")}
            tone="green"
          />
          <SourceStatus
            label="Government connectors"
            status={pretty(
              overview.sourceHealth?.governmentConnectors || "Not connected",
            )}
            tone="grey"
          />
          <SourceStatus
            label="Document storage"
            status={pretty(
              overview.sourceHealth?.documentStorage || "Local development",
            )}
            tone="amber"
          />
          <SourceStatus
            label="Document OCR"
            status={pretty(overview.sourceHealth?.ocr || "Not enabled")}
            tone="grey"
          />
          <SourceStatus
            label="GIS layers"
            status={pretty(overview.sourceHealth?.gisLayers || "Demo only")}
            tone="amber"
          />
        </section>
      </div>
      <div className="steward-lower-grid">
        <section className="panel steward-rules">
          <div className="panel-head">
            <div>
              <h3>Rule and mapping governance</h3>
              <p>Current implementation state</p>
            </div>
            <Settings2 size={18} className="panel-head-icon" />
          </div>
          <div>
            <p>
              <Check size={14} />
              <span>
                <strong>Property completeness rules</strong>
                <small>Active starter checks with evidence-state output</small>
              </span>
              <em>ACTIVE</em>
            </p>
            <p>
              <Check size={14} />
              <span>
                <strong>Karnataka location hierarchy</strong>
                <small>
                  District, taluk, hobli and village reference mapping
                </small>
              </span>
              <em>ACTIVE</em>
            </p>
            <p className="pending">
              <AlertTriangle size={14} />
              <span>
                <strong>Government source mappings</strong>
                <small>
                  Connector-specific mappings await approved integrations
                </small>
              </span>
              <em>PENDING</em>
            </p>
            <p className="pending">
              <AlertTriangle size={14} />
              <span>
                <strong>Versioned GIS rules</strong>
                <small>
                  Production rule registry and effective dates not enabled
                </small>
              </span>
              <em>PENDING</em>
            </p>
            <p className="pending">
              <AlertTriangle size={14} />
              <span>
                <strong>OCR schema mappings</strong>
                <small>Production Document AI provider not configured</small>
              </span>
              <em>PENDING</em>
            </p>
          </div>
        </section>
        <section className="panel steward-tools">
          <div className="panel-head">
            <div>
              <h3>Data stewardship tools</h3>
              <p>Reference and ingestion oversight</p>
            </div>
          </div>
          <button onClick={() => onNavigate("source-registry")}>
            <Activity />
            <span>
              <strong>Source registry</strong>
              <small>Authority, connector and health metadata</small>
            </span>
            <ArrowUpRight />
          </button>
          <button onClick={() => onNavigate("all-documents")}>
            <FileSearch />
            <span>
              <strong>Ingestion register</strong>
              <small>Document types and processing states</small>
            </span>
            <ArrowUpRight />
          </button>
          <button onClick={() => onNavigate("all-maps")}>
            <Layers3 />
            <span>
              <strong>GIS layer inspection</strong>
              <small>Imported layer status and provenance</small>
            </span>
            <ArrowUpRight />
          </button>
          <button onClick={() => onNavigate("properties")}>
            <Building2 />
            <span>
              <strong>Reference-data QA</strong>
              <small>Property identity and location completeness</small>
            </span>
            <ArrowUpRight />
          </button>
        </section>
      </div>
      <div className="steward-boundary">
        <ShieldCheck size={17} />
        <div>
          <strong>Data quality is not a legal conclusion</strong>
          <p>
            The Data Steward manages mappings, rules and ingestion quality.
            Legal interpretation, finding resolution and report approval remain
            with the Lead Advocate.
          </p>
        </div>
      </div>
    </div>
  );
}

function SupportDashboard({
  overview,
  currentUser,
}: {
  overview: any;
  currentUser: UserAccount;
}) {
  const [now, setNow] = useState(Date.now());
  const [ocrJobs, setOcrJobs] = useState<any[]>([]);
  const [ocrError, setOcrError] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let cancelled=false;
    const load=async()=>{try{const response=await authFetch(`${API}/api/support/ocr/jobs`);const data=await response.json();if(!response.ok)throw new Error(data.error||'OCR diagnostics unavailable.');if(!cancelled)setOcrJobs(data.items||[]);}catch(e){if(!cancelled)setOcrError((e as Error).message);}};
    void load();const timer=window.setInterval(load,15000);return()=>{cancelled=true;window.clearInterval(timer);};
  },[]);
  const retryOcrJob=async(id:string)=>{try{const response=await authFetch(`${API}/api/support/ocr/jobs/${id}/retry`,{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not retry job.');setOcrJobs(items=>items.map(item=>item.id===id?{...item,status:data.status,progress:0,error_code:null}:item));setOcrError('');}catch(e){setOcrError((e as Error).message);}};
  const expiresAt = currentUser.accessExpiresAt
    ? new Date(currentUser.accessExpiresAt).getTime()
    : now;
  const remaining = Math.max(0, expiresAt - now);
  const remainingLabel = `${String(Math.floor(remaining / 60000)).padStart(2, "0")}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}`;
  const diagnostics = [
    { label: "API service", status: "Available", tone: "green" },
    {
      label: "MariaDB connection",
      status: pretty(overview.sourceHealth?.database || "Connected"),
      tone: "green",
    },
    {
      label: "Document storage",
      status: pretty(
        overview.sourceHealth?.documentStorage || "Local development",
      ),
      tone: "amber",
    },
    {
      label: "Government connectors",
      status: pretty(
        overview.sourceHealth?.governmentConnectors || "Not connected",
      ),
      tone: "grey",
    },
    {
      label: "OCR service",
      status: pretty(overview.sourceHealth?.ocr || "Not enabled"),
      tone: "grey",
    },
    {
      label: "GIS data",
      status: pretty(overview.sourceHealth?.gisLayers || "Demo only"),
      tone: "amber",
    },
  ];
  return (
    <div className="support-dashboard">
      <div className="support-welcome">
        <div>
          <div className="eyebrow">OJIX SUPPORT / DIAGNOSTICS ONLY</div>
          <h1>Scoped support session</h1>
          <p>
            Welcome, {currentUser.name}. Diagnose service health without
            accessing property, document or legal-review content.
          </p>
        </div>
        <div
          className={`support-timer ${remaining < 10 * 60 * 1000 ? "expiring" : ""}`}
        >
          <Clock3 size={18} />
          <span>Session expires in</span>
          <strong>{remainingLabel}</strong>
        </div>
      </div>
      <div className="support-scope">
        <ShieldCheck size={20} />
        <div>
          <strong>Diagnostics-only scope is active</strong>
          <p>
            This session is read-only, expires automatically and does not
            include business-data access. Session creation is recorded in the
            audit log.
          </p>
        </div>
        <span>TIME-LIMITED</span>
      </div>
      <div className="support-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Service diagnostics</h3>
              <p>Configuration states visible to the support session</p>
            </div>
            <Activity size={18} className="panel-head-icon" />
          </div>
          <div className="support-diagnostic-list">
            {diagnostics.map((item) => (
              <SourceStatus
                key={item.label}
                label={item.label}
                status={item.status}
                tone={item.tone}
              />
            ))}
          </div>
        </section>
        <section className="panel support-access">
          <div className="panel-head">
            <div>
              <h3>Access boundaries</h3>
              <p>Enforced for this support identity</p>
            </div>
            <Key size={18} className="panel-head-icon" />
          </div>
          <div>
            <p className="allowed">
              <Check size={14} />
              <span>
                <strong>Allowed</strong>API, database and integration status
              </span>
            </p>
            <p className="allowed">
              <Check size={14} />
              <span>
                <strong>Allowed</strong>Configuration-state troubleshooting
              </span>
            </p>
            <p>
              <X size={14} />
              <span>
                <strong>Blocked</strong>Property and client matter records
              </span>
            </p>
            <p>
              <X size={14} />
              <span>
                <strong>Blocked</strong>Documents and extracted evidence
              </span>
            </p>
            <p>
              <X size={14} />
              <span>
                <strong>Blocked</strong>Findings, reports and legal decisions
              </span>
            </p>
            <p>
              <X size={14} />
              <span>
                <strong>Blocked</strong>All create, update and delete actions
              </span>
            </p>
          </div>
        </section>
      </div>
      <section className="panel support-ocr-jobs"><div className="panel-head"><div><h3>OCR processing diagnostics</h3><p>Status and safe error codes only · last 24 hours · document contents are hidden</p></div><Activity size={18} className="panel-head-icon"/></div>{ocrError&&<p className="alert alert-warning">{ocrError}</p>}<div className="admin-table-wrap"><table><thead><tr><th>JOB</th><th>STATUS</th><th>PROGRESS</th><th>ATTEMPTS</th><th>ERROR CODE</th><th>UPDATED</th><th>ACTION</th></tr></thead><tbody>{ocrJobs.map(j=><tr key={j.id}><td>{j.id.slice(0,8)}…</td><td>{pretty(j.status)}</td><td>{j.progress}%</td><td>{j.attempts}/{j.max_attempts}</td><td>{j.error_code||'—'}</td><td>{j.updated_at?new Date(j.updated_at).toLocaleString():'—'}</td><td>{['failed','retry_wait'].includes(j.status)&&<button className="secondary-btn" onClick={()=>void retryOcrJob(j.id)}>Retry job</button>}</td></tr>)}</tbody></table>{!ocrJobs.length&&<div className="admin-empty">No OCR jobs in the permitted diagnostic window.</div>}</div></section>
      <section className="panel support-runbook">
        <div className="panel-head">
          <div>
            <h3>Support runbook</h3>
            <p>Safe troubleshooting sequence</p>
          </div>
          <ClipboardCheck size={18} className="panel-head-icon" />
        </div>
        <div>
          <span>
            <b>1</b>
            <strong>Confirm incident scope</strong>
            <small>
              Record the affected feature without copying client data.
            </small>
          </span>
          <span>
            <b>2</b>
            <strong>Check service health</strong>
            <small>Review API, database, storage and connector state.</small>
          </span>
          <span>
            <b>3</b>
            <strong>Reproduce safely</strong>
            <small>
              Use demonstration data or a customer-authorized scoped case.
            </small>
          </span>
          <span>
            <b>4</b>
            <strong>Record intervention</strong>
            <small>
              Capture actions, outcome and session expiry in the audit trail.
            </small>
          </span>
        </div>
      </section>
      <div className="support-warning">
        <AlertTriangle size={17} />
        <div>
          <strong>Do not request screenshots containing client evidence</strong>
          <p>
            Escalate any need for matter-level access to an Organisation Admin.
            Access must be explicitly scoped, time-bound and audited before
            support continues.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConsultantDashboard({
  overview,
  properties,
  loading,
  currentUser,
  apiUrl,
  onOpen,
  onNavigate,
}: {
  overview: any;
  properties: Property[];
  loading: boolean;
  currentUser: UserAccount;
  apiUrl: string;
  onOpen: (property: Property) => void;
  onNavigate: (page: "properties" | "all-findings" | "all-maps") => void;
}) {
  const [assignedIssueCount, setAssignedIssueCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void authFetch(`${apiUrl}/api/consultant/issues`).then((response) => response.json()).then((data) => {
      if (active) setAssignedIssueCount(Number(data.openCount || 0));
    }).catch(() => { if (active) setAssignedIssueCount(null); });
    return () => { active = false; };
  }, [apiUrl]);
  const dossierRows = [...properties].sort((a, b) => {
    const aReady = (a.document_count || 0) > 0 && a.latitude !== null ? 1 : 0;
    const bReady = (b.document_count || 0) > 0 && b.latitude !== null ? 1 : 0;
    return (
      bReady - aReady ||
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  });
  const completeEvidence = properties.filter(
    (property) =>
      (property.document_count || 0) > 0 &&
      property.latitude !== null &&
      property.longitude !== null,
  ).length;
  return (
    <div className="consultant-dashboard">
      <div className="consultant-welcome">
        <div>
          <div className="eyebrow">PROPERTY CONSULTANT</div>
          <h1>Client dossier preparation</h1>
          <p>
            Welcome, {currentUser.name}. Assemble clear property context and
            issue summaries from reviewer-controlled evidence.
          </p>
        </div>
        <button
          className="primary-btn"
          onClick={() => onNavigate("properties")}
        >
          <BriefcaseBusiness size={16} /> Open matter register
        </button>
      </div>
      <div className="consultant-kpis">
        <div>
          <span>
            <BriefcaseBusiness />
          </span>
          <small>Accessible matters</small>
          <strong>{loading ? "—" : properties.length}</strong>
          <p>Current tenant portfolio</p>
        </div>
        <div>
          <span>
            <FileCheck2 />
          </span>
          <small>Evidence assembled</small>
          <strong>{loading ? "—" : completeEvidence}</strong>
          <p>Documents and coordinates recorded</p>
        </div>
        <div>
          <span>
            <ShieldAlert />
          </span>
          <small>Open issue items</small>
          <strong>{loading || assignedIssueCount === null ? "—" : assignedIssueCount}</strong>
          <p>For reviewer-controlled disclosure</p>
        </div>
        <div>
          <span>
            <BadgeCheck />
          </span>
          <small>Ready for review</small>
          <strong>{loading ? "—" : properties.filter((property) => property.status === "ready_for_review").length}</strong>
          <p>Awaiting legal approval</p>
        </div>
      </div>
      <section className="panel consultant-register">
        <div className="panel-head">
          <div>
            <div className="eyebrow">DOSSIER REGISTER</div>
            <h3>Client-pack preparation queue</h3>
            <p>
              Completeness describes available workspace evidence, not
              transaction safety.
            </p>
          </div>
          <button className="text-btn" onClick={() => onNavigate("properties")}>
            All matters <ArrowUpRight size={14} />
          </button>
        </div>
        {loading ? (
          <div className="loading-state">
            <LoaderCircle className="spin" /> Loading matters…
          </div>
        ) : (
          <div className="consultant-table-wrap">
            <table className="consultant-table">
              <thead>
                <tr>
                  <th>APPLICATION</th>
                  <th>PROPERTY</th>
                  <th>DOCUMENTS</th>
                  <th>LOCATION</th>
                  <th>DOSSIER STATE</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {dossierRows.slice(0, 10).map((property) => {
                  const hasDocs = (property.document_count || 0) > 0;
                  const hasMap =
                    property.latitude !== null && property.longitude !== null;
                  const ready = hasDocs && hasMap;
                  return (
                    <tr key={property.id}>
                      <td>
                        <strong className="mono">
                          {property.application_number}
                        </strong>
                        <small>{dateLabel(property.updated_at)}</small>
                      </td>
                      <td>
                        <strong>{property.name}</strong>
                        <small>
                          {propertyIdentityLabel(property)} ·{" "}
                          {property.village || "Location pending"}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`review-signal ${hasDocs ? "ready" : "attention"}`}
                        >
                          {hasDocs
                            ? `${property.document_count} file${property.document_count === 1 ? "" : "s"}`
                            : "Missing"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`review-signal ${hasMap ? "ready" : "attention"}`}
                        >
                          {hasMap ? "Recorded" : "Missing"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`consultant-state ${ready ? "ready" : "draft"}`}
                        >
                          {ready
                            ? "Evidence assembled"
                            : "Preparation required"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="application-view"
                          onClick={() => onOpen(property)}
                        >
                          Open dossier <ArrowUpRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="consultant-lower-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Client-ready dossier checklist</h3>
              <p>Prepare; do not independently approve.</p>
            </div>
            <ClipboardCheck size={18} className="panel-head-icon" />
          </div>
          <div className="consultant-checks">
            <p>
              <Check size={14} />
              <span>
                <strong>Property identity</strong>Application number, survey and
                location presented clearly
              </span>
            </p>
            <p>
              <Check size={14} />
              <span>
                <strong>Document index</strong>Source files classified and
                traceable
              </span>
            </p>
            <p>
              <Check size={14} />
              <span>
                <strong>Issue list</strong>Reviewer-approved findings separated
                from open questions
              </span>
            </p>
            <p>
              <Check size={14} />
              <span>
                <strong>Map context</strong>Recorded location and limitations
                disclosed
              </span>
            </p>
            <p>
              <Check size={14} />
              <span>
                <strong>Report status</strong>Only approved versions shared with
                the client
              </span>
            </p>
          </div>
        </section>
        <section className="panel consultant-shortcuts">
          <div className="panel-head">
            <div>
              <h3>Dossier tools</h3>
              <p>Read-only preparation and export context</p>
            </div>
          </div>
          <button onClick={() => onNavigate("properties")}>
            <Building2 />
            <span>
              <strong>Property matters</strong>
              <small>Identity, documents and report workspace</small>
            </span>
            <ArrowUpRight />
          </button>
          <button onClick={() => onNavigate("all-findings")}>
            <ShieldAlert />
            <span>
              <strong>Issue register</strong>
              <small>Review findings and disclosure status</small>
            </span>
            <ArrowUpRight />
          </button>
          <button onClick={() => onNavigate("all-maps")}>
            <MapIcon />
            <span>
              <strong>Map context</strong>
              <small>Location and imported-layer limitations</small>
            </span>
            <ArrowUpRight />
          </button>
        </section>
      </div>
      <div className="consultant-boundary">
        <ShieldCheck size={17} />
        <div>
          <strong>Consultant access is preparation-focused</strong>
          <p>
            You may review matters and prepare exports. You cannot change
            evidence, run legal screening, resolve findings or approve the final
            report.
          </p>
        </div>
      </div>
    </div>
  );
}

function OwnerDashboard({
  overview,
  dashboardData,
  dashboardError,
  properties,
  accounts,
  loading,
  currentUser,
  onOpen,
  onNavigate,
  onPropertyUpdated,
  pendingActionFilter,
  onPendingAction,
  onRefresh,
}: {
  overview: any;
  dashboardData: any;
  dashboardError: string;
  properties: Property[];
  accounts: UserAccount[];
  loading: boolean;
  currentUser: UserAccount;
  onOpen: (property: Property) => void;
  onPropertyUpdated: (property: Property) => void;
  pendingActionFilter: string;
  onPendingAction: (action: any) => void;
  onRefresh: () => void;
  onNavigate: (
    page:
      | "properties"
      | "settings"
      | "source-registry"
      | "all-documents"
      | "all-findings"
      | "lawyer-workbench"
      | "consultant-reports"
      | "admin-overview"
      | "workflow-guide",
  ) => void;
}) {
  const [workflowProperty, setWorkflowProperty] = useState<Property | null>(null);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [workflowPriorityFilter, setWorkflowPriorityFilter] = useState("all");
  const [workflowSort, setWorkflowSort] = useState("priority");
  const [workflowPage, setWorkflowPage] = useState(1);
  const [workloadRole, setWorkloadRole] = useState("all");
  const [workloadStatus, setWorkloadStatus] = useState("all");
  const [portfolioTaluk, setPortfolioTaluk] = useState("all");
  const [analyticsData, setAnalyticsData] = useState<any>(dashboardData?.analytics || null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [findingsPage,setFindingsPage]=useState(1);
  const [activityPage,setActivityPage]=useState(1);
  const [pagedFeed,setPagedFeed]=useState<any>(null);
  const [feedError,setFeedError]=useState("");
  const [globalSearch,setGlobalSearch]=useState("");
  const [globalSearchResults,setGlobalSearchResults]=useState<any[]>([]);
  const [globalSearchLoading,setGlobalSearchLoading]=useState(false);
  const [showSearchResults,setShowSearchResults]=useState(false);
  const globalSearchInput=useRef<HTMLInputElement>(null);
  useEffect(() => { if (dashboardData?.analytics) setAnalyticsData(dashboardData.analytics); }, [dashboardData?.analytics]);
  useEffect(() => {
    if (!pendingActionFilter) return;
    setWorkflowFilter(pendingActionFilter === "evidence" ? "missing_evidence" : pendingActionFilter === "approval" ? "ready_for_review" : "all");
    if (pendingActionFilter === "evidence" || pendingActionFilter === "approval") {
      window.setTimeout(() => document.getElementById("owner-workflow-register")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  }, [pendingActionFilter]);
  useEffect(()=>{
    if(findingsPage===1&&activityPage===1){setPagedFeed(null);setFeedError("");return;}
    let active=true;
    setFeedError("");
    api<any>(`/api/owner/dashboard?findingsPage=${findingsPage}&activityPage=${activityPage}`)
      .then(result=>{if(active)setPagedFeed(result);})
      .catch(error=>{if(active)setFeedError((error as Error).message||"Dashboard feeds could not be loaded.");});
    return()=>{active=false;};
  },[findingsPage,activityPage]);
  useEffect(()=>{
    const term=globalSearch.trim();
    if(term.length<2){setGlobalSearchResults([]);setGlobalSearchLoading(false);return;}
    let active=true;
    setGlobalSearchLoading(true);
    const timer=window.setTimeout(()=>{
      api<{items:any[]}>(`/api/owner/dashboard/search?q=${encodeURIComponent(term)}`)
        .then(result=>{if(active)setGlobalSearchResults(result.items||[]);})
        .catch(()=>{if(active)setGlobalSearchResults([]);})
        .finally(()=>{if(active)setGlobalSearchLoading(false);});
    },250);
    return()=>{active=false;window.clearTimeout(timer);};
  },[globalSearch]);
  useEffect(()=>{
    const handleShortcut=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();globalSearchInput.current?.focus();setShowSearchResults(true);}};
    window.addEventListener('keydown',handleShortcut);return()=>window.removeEventListener('keydown',handleShortcut);
  },[]);
  const updateAnalyticsRange = async (from:string,to:string) => {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try { const result=await api<any>(`/api/owner/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);setAnalyticsData(result.analytics); }
    catch (rangeError) { setAnalyticsError((rangeError as Error).message || "Analytics could not be updated."); }
    finally { setAnalyticsLoading(false); }
  };
  const memberName = (uid?: string) =>
    accounts.find((account) => account.uid === uid)?.name || "Unassigned";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOpen = (property: Property) =>
    !["complete", "closed", "archived"].includes(property.status);
  const isOverdue = (property: Property) =>
    Boolean(
      property.due_date &&
        isOpen(property) &&
        new Date(property.due_date).getTime() < today.getTime(),
    );
  const priorityWeight: Record<string, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };
  const dashboardWorkflow = Array.isArray(dashboardData?.workflow)
    ? dashboardData.workflow
    : [];
  const workflowRows = [...dashboardWorkflow].sort(
    (a, b) =>
      Number(isOverdue(b)) -
        Number(isOverdue(a)) +
        (priorityWeight[b.workflow_priority || "normal"] || 0) -
        (priorityWeight[a.workflow_priority || "normal"] || 0) ||
      (a.due_date || "9999").localeCompare(b.due_date || "9999"),
  );
  const filteredWorkflowRows = workflowRows.filter((property: any) => {
    const term = workflowSearch.trim().toLowerCase();
    const matchesSearch = !term || [property.name, property.application_number, property.village, property.taluk, property.district, property.review_stage, property.next_action]
      .some((value) => String(value || "").toLowerCase().includes(term));
    const matchesFilter = workflowFilter === "all" ||
      (workflowFilter === "overdue" ? isOverdue(property) :
        workflowFilter === "missing_evidence" ? Number(property.missing_evidence) > 0 :
        workflowFilter === "document_review" ? Number(property.pending_document_reviews) > 0 :
        property.status === workflowFilter);
    const matchesPriority = workflowPriorityFilter === "all" || property.workflow_priority === workflowPriorityFilter;
    return matchesSearch && matchesFilter && matchesPriority;
  }).sort((a: any, b: any) => {
    if (workflowSort === "due") return String(a.due_date || "9999").localeCompare(String(b.due_date || "9999"));
    if (workflowSort === "name") return String(a.name || "").localeCompare(String(b.name || ""));
    if (workflowSort === "status") return String(a.status || "").localeCompare(String(b.status || ""));
    return workflowRows.indexOf(a) - workflowRows.indexOf(b);
  });
  const workflowPageSize = 10;
  const workflowPageCount = Math.max(1, Math.ceil(filteredWorkflowRows.length / workflowPageSize));
  const visibleWorkflowRows = filteredWorkflowRows.slice((Math.min(workflowPage, workflowPageCount) - 1) * workflowPageSize, Math.min(workflowPage, workflowPageCount) * workflowPageSize);
  const metrics = dashboardData?.metrics || {};
  const dashboardAvailable = Boolean(dashboardData);
  const overdueCount = Number(metrics.overdue_tasks ?? 0) || 0;
  const readyCount = Number(metrics.ready_for_legal_review ?? 0) || 0;
  const documentReviewCount = Number(metrics.documents_requiring_review) || 0;
  const pendingActions = Array.isArray(dashboardData?.pendingActions) ? dashboardData.pendingActions : [];
  const recentFindings = Array.isArray(pagedFeed?.recentFindings) ? pagedFeed.recentFindings : (Array.isArray(dashboardData?.recentFindings) ? dashboardData.recentFindings : (overview.recentFindings || []));
  const teamWorkload = Array.isArray(dashboardData?.teamWorkload) ? dashboardData.teamWorkload : [];
  const reports = Array.isArray(dashboardData?.reports) ? dashboardData.reports : [];
  const recentActivity = Array.isArray(pagedFeed?.recentActivity) ? pagedFeed.recentActivity : (Array.isArray(dashboardData?.recentActivity) ? dashboardData.recentActivity : []);
  const readiness=dashboardData?.readiness||{};
  const distributions=dashboardData?.distributions||{};
  const districtDistribution=Array.isArray(distributions.districts)?distributions.districts:[];
  const talukDistribution=Array.isArray(distributions.taluks)?distributions.taluks:[];
  const riskOverview=Array.isArray(dashboardData?.riskOverview)?dashboardData.riskOverview:[];
  const documentCategories=dashboardData?.documentCategories||{};
  const sourceStatus=Array.isArray(dashboardData?.evidenceSourceStatus)?dashboardData.evidenceSourceStatus:[];
  const pagination=pagedFeed?.pagination||dashboardData?.pagination||{};
  const findingsPagination=pagination.findings||{page:findingsPage,pageSize:6,total:recentFindings.length,totalPages:1};
  const activityPagination=pagination.activity||{page:activityPage,pageSize:8,total:recentActivity.length,totalPages:1};
  const unreadActionCount=pendingActions.filter((item:any)=>Number(item.count||0)>0).length;
  const openPropertyById = async (id?: string) => {
    const property = properties.find((item) => item.id === id) || dashboardWorkflow.find((item: Property) => item.id === id);
    if (property) onOpen(property);
    else if(id){try{const result=await api<{item:Property}>(`/api/properties/${encodeURIComponent(id)}`);if(result.item)onOpen(result.item);}catch{}}
  };
  if (!dashboardAvailable) {
    return <div className="owner-dashboard owner-command-center">
      {loading ? <div className="panel owner-dashboard-loading" role="status">Loading Owner Dashboard data…</div> :
        <div className="owner-dashboard-error" role="alert"><AlertTriangle size={17}/><span>Owner Dashboard data is unavailable. {dashboardError || "The workspace dashboard request failed."}</span><button type="button" onClick={onRefresh}>Retry</button></div>}
    </div>;
  }
  return (
    <div className="owner-dashboard owner-command-center">
      <div className="owner-welcome">
        <div>
          <div className="owner-eyebrow"><span className="owner-live-dot"/> OWNER WORKSPACE · LIVE OPERATIONS</div>
          <h1>Owner Command Center</h1>
          <p>
            Prioritise the work that needs attention, then track portfolio health and team delivery.
          </p>
          <div className="owner-global-search-wrap">
            <label className="owner-global-search"><Search size={17}/><input ref={globalSearchInput} value={globalSearch} onChange={event=>setGlobalSearch(event.target.value)} onFocus={()=>setShowSearchResults(true)} onKeyDown={event=>{if(event.key==='Escape')setShowSearchResults(false);}} placeholder="Search properties, matters or documents" aria-label="Search properties, matters or documents"/><kbd>⌘ K</kbd></label>
            {showSearchResults&&globalSearch.trim().length>=2&&<div className="owner-search-results" role="listbox" aria-label="Search results">{globalSearchLoading?<div className="owner-search-empty"><LoaderCircle className="spin" size={15}/> Searching workspace…</div>:globalSearchResults.length?globalSearchResults.map((result:any)=><button type="button" key={`${result.type}:${result.id}`} onClick={()=>{setShowSearchResults(false);setGlobalSearch("");void openPropertyById(result.property_id||result.id);}}><span className={`owner-search-type ${result.type}`}>{result.type==='document'?<FileText size={14}/>:<Building2 size={14}/>}</span><span><strong>{result.title}</strong><small>{result.type==='document'?'Document':'Matter'}{result.reference?` · ${result.reference}`:''}{result.subtitle?` · ${result.subtitle}`:''}</small></span><ArrowUpRight size={14}/></button>):<div className="owner-search-empty">No matching properties, matters, or documents were found.</div>}</div>}
          </div>
        </div>
        <div className="owner-actions">
          <button className="owner-notification-button" onClick={() => document.getElementById("owner-pending-actions")?.scrollIntoView({ behavior: "smooth" })} aria-label={`${unreadActionCount} outstanding action items`} title="Open pending actions"><Bell size={17}/>{unreadActionCount>0&&<span>{unreadActionCount>99?'99+':unreadActionCount}</span>}</button>
          <button className="secondary-btn" onClick={()=>onNavigate("workflow-guide")}><CircleHelp size={15}/> Help</button>
          <button
            className="secondary-btn"
            onClick={() => document.getElementById("owner-pending-actions")?.scrollIntoView({ behavior: "smooth" })}
          >
            <ClipboardCheck size={15} /> Pending actions
          </button>
          <button
            className="primary-btn"
            onClick={() => onNavigate("properties")}
          >
            <BriefcaseBusiness size={16} /> View portfolio
          </button>
        </div>
      </div>
      {dashboardError && <div className="owner-dashboard-error" role="alert"><AlertTriangle size={16}/><span>Owner dashboard details could not be loaded: {dashboardError}</span></div>}
      <div className="owner-kpis">
        <button type="button" onClick={() => onNavigate("properties")}><span><Building2 /></span><small>Total Matters</small><strong>{loading || !dashboardAvailable ? "—" : Number(metrics.total_matters) || 0}</strong><p>Recorded in this workspace</p><i className="owner-kpi-state neutral">Portfolio</i></button>
        <button type="button" onClick={() => onNavigate("properties")}><span><Clock3 /></span><small>Active Reviews</small><strong>{loading || !dashboardAvailable ? "—" : Number(metrics.active_reviews) || 0}</strong><p>Evidence review or clarification</p><i className="owner-kpi-state">Live queue</i></button>
        <button type="button" onClick={() => onNavigate("lawyer-workbench")}><span><BadgeCheck /></span><small>Ready for Legal Review</small><strong>{loading || !dashboardAvailable ? "—" : readyCount}</strong><p>Awaiting assigned reviewer</p><i className={`owner-kpi-state ${readyCount?'attention':'success'}`}>{readyCount?'Action needed':'Clear'}</i></button>
        <button type="button" onClick={() => onNavigate("all-documents")}><span><FileSearch /></span><small>Documents Requiring Review</small><strong>{loading || !dashboardAvailable ? "—" : documentReviewCount}</strong><p>Pending field or processing review</p><i className={`owner-kpi-state ${documentReviewCount?'attention':'success'}`}>{documentReviewCount?'Review queue':'Clear'}</i></button>
        <button type="button" onClick={() => onNavigate("lawyer-workbench")}><span><AlertTriangle /></span><small>Overdue Tasks</small><strong>{loading || !dashboardAvailable ? "—" : overdueCount}</strong><p>Incomplete tasks past due date</p><i className={`owner-kpi-state ${overdueCount?'urgent':'success'}`}>{overdueCount?'Overdue':'On track'}</i></button>
      </div>
      <div className="owner-command-grid">
        <section className="panel owner-readiness">
          <div className="panel-head">
            <div>
              <h3>Portfolio readiness</h3>
              <p>Existing five-part completeness measure; it is not a legal-risk score.</p>
            </div>
            <span className="owner-readiness-score">
              {dashboardAvailable ? `${Number(readiness.readiness_pct) || 0}%` : "—"}
            </span>
          </div>
          <div className="owner-readiness-body">
            <div
              className="readiness-donut"
              style={
                {
                  "--readiness": `${Math.max(0, Math.min(100, dashboardAvailable ? Number(readiness.readiness_pct) || 0 : 0)) * 3.6}deg`,
                } as React.CSSProperties
              }
            >
              <div>
                <strong>{dashboardAvailable ? `${Number(readiness.readiness_pct) || 0}%` : "—"}</strong>
                <span>complete</span>
              </div>
            </div>
            <div>
              <div>
                <span>Ready for legal review</span>
                <strong>{dashboardAvailable ? Number(readiness.ready_for_legal_review) || 0 : "—"}</strong>
              </div>
              <div>
                <span>Under review</span>
                <strong>{dashboardAvailable ? Number(readiness.under_review) || 0 : "—"}</strong>
              </div>
              <div>
                <span>Matters missing evidence</span>
                <strong>{dashboardAvailable ? Number(readiness.missing_evidence_matters) || 0 : "—"}</strong>
              </div>
              <div>
                <span>Not started</span>
                <strong>{dashboardAvailable ? Number(readiness.not_started) || 0 : "—"}</strong>
              </div>
            </div>
          </div>
        </section>
        <section className="panel owner-districts">
          <div className="panel-head">
            <div>
              <h3>Portfolio distribution</h3>
            <p>Workspace matters grouped by recorded location</p>
            </div>
            <MapIcon size={18} className="panel-head-icon" />
          </div>
          <div className="owner-district-list">
            {districtDistribution.length ? (
              districtDistribution.slice(0, 6).map((item:any) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <div>
                    <i
                      style={{
                        width: `${Math.max(3, (Number(item.value) / Math.max(...districtDistribution.map((value:any)=>Number(value.value)||0), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <strong>{Number(item.value)||0}</strong>
                </div>
              ))
            ) : (
              <p>No property locations recorded.</p>
            )}
          </div>
          <div className="owner-distribution-subhead"><strong>Properties by taluk</strong><select value={portfolioTaluk} onChange={(event) => setPortfolioTaluk(event.target.value)} aria-label="Filter portfolio by taluk"><option value="all">All taluks</option>{talukDistribution.map((item:any) => <option key={item.label} value={item.label}>{item.label}</option>)}</select></div>
          <div className="owner-district-list">
            {talukDistribution.filter((item:any) => portfolioTaluk === "all" || portfolioTaluk === item.label).slice(0, 5).map((item:any) => <button key={item.label} type="button" onClick={() => onNavigate("properties")}><span>{item.label}</span><div><i style={{ width: `${Math.max(3, (Number(item.value) / Math.max(...talukDistribution.map((value:any)=>Number(value.value)||0), 1)) * 100)}%` }} /></div><strong>{Number(item.value)||0}</strong></button>)}
          </div>
          <div className="owner-distribution-subhead"><strong>Properties by village</strong></div>
          <div className="owner-district-list">
            {(Array.isArray(distributions.villages) ? distributions.villages : []).slice(0, 5).map((item:any) => <div key={item.label}><span>{item.label}</span><div><i style={{ width: `${Math.max(3, (Number(item.value) / Math.max(...(distributions.villages||[]).map((value:any)=>Number(value.value)||0), 1)) * 100)}%` }} /></div><strong>{Number(item.value)||0}</strong></div>)}
          </div>
          <p className="owner-distribution-caption">Matter status distribution is available in Operational analytics.</p>
        </section>
        <section className="panel owner-governance" id="owner-pending-actions">
          <div className="panel-head">
            <div>
              <h3>Pending actions</h3>
              <p>Operational work requiring the next owner or team action</p>
            </div>
            <ClipboardCheck size={18} className="panel-head-icon" />
          </div>
          <div className="owner-governance-list">
            {pendingActions.length ? pendingActions.map((action: any) => <button key={action.id} className={Number(action.count)>0?'attention':''} onClick={()=>onPendingAction(action)}>
              {Number(action.count)>0?<AlertTriangle size={14}/>:<Check size={14}/>}<span><strong>{action.label}</strong><small>{action.status} · {action.priority} priority · {action.nextAction}</small></span><b>{action.count}</b><ArrowUpRight size={13}/>
            </button>) : dashboardAvailable ? <div className="owner-empty-inline"><Check size={14}/><span><strong>No pending actions</strong><small>The workspace action queue is clear.</small></span></div> : <div className="owner-empty-inline"><AlertTriangle size={14}/><span><strong>Action counts unavailable</strong><small>Retry dashboard loading to verify workspace actions.</small></span></div>}
          </div>
        </section>
      </div>
      <div className="owner-detail-grid">
        <section className="panel owner-detail-card">
          <div className="panel-head"><div><h3>Risk overview</h3><p>Properties grouped by their highest recorded finding severity.</p></div><ShieldAlert size={18} className="panel-head-icon"/></div>
          <div className="owner-risk-list">{riskOverview.length?[
            {label:'High risk',value:riskOverview.filter((item:any)=>['critical','high'].includes(item.label)).reduce((sum:number,item:any)=>sum+Number(item.value||0),0),tone:'high'},
            {label:'Medium risk',value:riskOverview.filter((item:any)=>item.label==='medium').reduce((sum:number,item:any)=>sum+Number(item.value||0),0),tone:'medium'},
            {label:'Low risk',value:riskOverview.filter((item:any)=>item.label==='low').reduce((sum:number,item:any)=>sum+Number(item.value||0),0),tone:'low'},
            {label:'Not assessed',value:riskOverview.filter((item:any)=>item.label==='not_assessed').reduce((sum:number,item:any)=>sum+Number(item.value||0),0),tone:'unknown'}
          ].map((item:any)=><div key={item.label}><span className={`owner-risk-indicator ${item.tone}`}/><span>{item.label}</span><strong>{item.value}</strong></div>):<OwnerEmpty message="No risk assessment data is available."/>}</div>
          <p className="owner-detail-footnote">Severity comes from recorded risk findings. “Not assessed” means no finding is recorded for the matter.</p>
        </section>
        <section className="panel owner-detail-card">
          <div className="panel-head"><div><h3>Documents by category</h3><p>Active workspace documents from database records.</p></div><FolderOpen size={18} className="panel-head-icon"/></div>
          <div className="owner-document-categories"><button onClick={()=>onNavigate("all-documents")}><span>Total documents</span><strong>{Number(documentCategories.total_documents)||0}</strong></button><button onClick={()=>onNavigate("all-documents")}><span>Title deeds</span><strong>{Number(documentCategories.title_deeds)||0}</strong></button><button onClick={()=>onNavigate("all-documents")}><span>Encumbrance certificates</span><strong>{Number(documentCategories.encumbrance_certificates)||0}</strong></button><button onClick={()=>onNavigate("all-documents")}><span>Survey and revenue records</span><strong>{Number(documentCategories.survey_revenue_records)||0}</strong></button><button onClick={()=>onNavigate("all-documents")}><span>Other categories</span><strong>{Number(documentCategories.other_documents)||0}</strong></button></div>
        </section>
        <section className="panel owner-detail-card">
          <div className="panel-head"><div><h3>Evidence source status</h3><p>Latest recorded verification state; portal reachability is not verification.</p></div><Activity size={18} className="panel-head-icon"/></div>
          <div className="owner-source-checks">{sourceStatus.length?sourceStatus.map((item:any)=><div key={item.source}><span className={`owner-source-dot ${/matched|verified_data_available/i.test(item.status)?'verified':/mismatch|failed/i.test(item.status)?'failed':'unknown'}`}/><span><strong>{item.source}</strong><small>{item.status==='not_verified'?'No verified result recorded':pretty(item.status)}{item.lastChecked?` · ${dateLabel(item.lastChecked)}`:item.latestSourceDate?` · source date ${dateLabel(item.latestSourceDate)}`:''}</small></span>{item.verifiedLayers!==undefined&&<b>{Number(item.verifiedLayers)||0} layers</b>}</div>):<OwnerEmpty message="No source status is available."/>}</div>
        </section>
      </div>
      {analyticsError && <div className="owner-dashboard-error" role="alert"><AlertTriangle size={16}/><span>{analyticsError}</span></div>}
      <OwnerAnalytics data={analyticsData || {}} team={teamWorkload} onRangeChange={updateAnalyticsRange} loading={analyticsLoading}/>
      <OwnerPortfolioMap properties={dashboardWorkflow} onOpen={onOpen}/>
      <section className="panel owner-workflow-register" id="owner-workflow-register">
        <div className="panel-head">
          <div>
            <h3>Application workflow register</h3>
            <p>
              Team ownership, deadlines and evidence attention across the
              portfolio.
            </p>
          </div>
          <div className="owner-register-summary">
            <span className={overdueCount ? "has-overdue" : ""}>
              {overdueCount} overdue
            </span>
            <button
              className="text-btn"
              onClick={() => onNavigate("properties")}
            >
              All applications <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
        <div className="owner-workflow-tools">
          <label><Search size={14}/><input value={workflowSearch} onChange={(event)=>{setWorkflowSearch(event.target.value);setWorkflowPage(1);}} placeholder="Search matter, location or next action" aria-label="Search workflow register"/></label>
          <select value={workflowFilter} onChange={(event)=>{setWorkflowFilter(event.target.value);setWorkflowPage(1);}} aria-label="Filter workflow register"><option value="all">All stages</option><option value="overdue">Overdue</option><option value="missing_evidence">Missing evidence</option><option value="document_review">Pending document review</option><option value="documents_pending">Documents pending</option><option value="in_review">Evidence review</option><option value="clarification_required">Clarification required</option><option value="ready_for_review">Ready for legal review</option><option value="approved">Approved</option><option value="complete">Completed</option></select>
          <select value={workflowPriorityFilter} onChange={(event)=>{setWorkflowPriorityFilter(event.target.value);setWorkflowPage(1);}} aria-label="Filter by priority"><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select>
          <select value={workflowSort} onChange={(event)=>{setWorkflowSort(event.target.value);setWorkflowPage(1);}} aria-label="Sort workflow register"><option value="priority">Sort: priority</option><option value="due">Sort: due date</option><option value="name">Sort: property</option><option value="status">Sort: status</option></select>
        </div>
        {loading ? (
          <div className="loading-state">
            <LoaderCircle className="spin" /> Loading workflow…
          </div>
        ) : filteredWorkflowRows.length ? (
          <div className="owner-workflow-table-wrap">
            <table className="owner-workflow-table">
              <thead>
                <tr>
                  <th>APPLICATION</th>
                  <th>PROPERTY / LOCATION</th>
                  <th>CURRENT STAGE</th>
                  <th>REVIEW STAGE</th>
                  <th>MISSING EVIDENCE</th>
                  <th>NEXT ACTION</th>
                  <th>ASSIGNED TO</th>
                  <th>DUE DATE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {visibleWorkflowRows.map((property: any) => (
                  <tr
                    key={property.id}
                    className={isOverdue(property) ? "overdue" : ""}
                  >
                    <td className="owner-matter-cell" onClick={()=>onOpen(property)}>
                      <strong>{property.application_number || "Application pending"}</strong>
                      <small className="mono">
                        {property.application_number}
                      </small>
                    </td>
                    <td className="owner-matter-cell" onClick={()=>onOpen(property)}><strong>{property.name}</strong><small>{[property.village, property.taluk, property.district].filter(Boolean).join(" · ") || propertyIdentityLabel(property)}</small></td>
                    <td>
                      <span className={`owner-priority ${property.workflow_priority || "normal"}`}>{pretty(property.status)}</span>
                    </td>
                    <td>
                      <strong>{property.review_stage || pretty(property.status)}</strong>
                    </td>
                    <td>
                      <span className={`review-signal ${Number(property.missing_evidence||0)>0?'attention':'ready'}`}>{Number(property.missing_evidence||0)>0?`${property.missing_evidence} missing`:'Complete'}</span>
                    </td>
                    <td>
                      <strong>{property.next_action || 'Continue review'}</strong>
                    </td>
                    <td>
                      <strong>{memberName(property.assigned_lawyer_uid)}</strong>
                      <small>{[memberName(property.assigned_analyst_uid),memberName(property.assigned_operations_uid)].filter(name=>name!=='Unassigned').join(' · ')||'No supporting assignment'}</small>
                    </td>
                    <td>
                      {property.due_date ? (
                        <>
                          <strong>{dateLabel(property.due_date)}</strong>
                          {isOverdue(property) && (
                            <small className="overdue-label">
                              <AlertTriangle size={11} /> Overdue
                            </small>
                          )}
                        </>
                      ) : (
                        <span className="muted">Not set</span>
                      )}
                    </td>
                    <td>
                      <div className="owner-workflow-actions">
                        <StatusPill status={property.status}/>
                        <button className="application-view assign-team" onClick={() => setWorkflowProperty(property)}>
                          <UserCheck size={13}/> Assign team
                        </button>
                        <button className="application-view" onClick={() => onOpen(property)}>
                          Open <ArrowUpRight size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="analyst-ready">
            <BadgeCheck size={20} />
            <span>No property applications are currently recorded.</span>
          </div>
        )}
        {!loading && filteredWorkflowRows.length > 0 && <div className="owner-workflow-pagination"><span>Showing {Math.min(filteredWorkflowRows.length, (workflowPage - 1) * workflowPageSize + 1)}–{Math.min(filteredWorkflowRows.length, workflowPage * workflowPageSize)} of {filteredWorkflowRows.length}</span><button disabled={workflowPage <= 1} onClick={() => setWorkflowPage((page) => Math.max(1, page - 1))}>Previous</button><span>Page {Math.min(workflowPage, workflowPageCount)} of {workflowPageCount}</span><button disabled={workflowPage >= workflowPageCount} onClick={() => setWorkflowPage((page) => Math.min(workflowPageCount, page + 1))}>Next</button></div>}
      </section>
      {workflowProperty && <PropertyWorkflowModal
        property={workflowProperty}
        onClose={() => setWorkflowProperty(null)}
        onSaved={(item) => {
          onPropertyUpdated(item);
          setWorkflowProperty(null);
        }}
      />}
      <div className="owner-insight-grid">
        <section className="panel owner-insight-card">
          <div className="panel-head">
            <div><h3>Recent findings</h3><p>Latest evidence-backed property intelligence findings</p></div><ShieldAlert size={18} className="panel-head-icon"/>
          </div>
          <div className="owner-insight-list">{recentFindings.length?recentFindings.map((finding:any)=><button key={finding.id} onClick={()=>openPropertyById(finding.property_id)}><span className={`owner-severity ${finding.severity}`}>{pretty(finding.severity)}</span><span><strong>{String(finding.id).slice(0,8)} · {finding.title}</strong><small>{finding.property_name} · {finding.district||'District not recorded'} · {pretty(finding.code)} · {pretty(finding.reviewer_state)} · {finding.evidence_available?'Evidence available':'No linked approved evidence'} · {dateLabel(finding.created_at)}</small></span><ArrowUpRight size={13}/></button>):<OwnerEmpty message="No findings have been recorded."/>}</div>
          {Number(findingsPagination.total)>Number(findingsPagination.pageSize)&&<div className="owner-feed-pagination"><span>{findingsPagination.total} findings · page {findingsPage} of {findingsPagination.totalPages}</span><button disabled={findingsPage<=1} onClick={()=>setFindingsPage(page=>Math.max(1,page-1))}>Previous</button><button disabled={findingsPage>=findingsPagination.totalPages} onClick={()=>setFindingsPage(page=>Math.min(findingsPagination.totalPages,page+1))}>Next</button></div>}
        </section>
        <section className="panel owner-insight-card">
          <div className="panel-head">
            <div><h3>Team workload</h3><p>Assignments and review load by active team member</p></div><UserCheck size={18} className="panel-head-icon"/>
          </div>
          <div className="owner-workload-filters"><select value={workloadRole} onChange={event=>setWorkloadRole(event.target.value)} aria-label="Filter workload by role"><option value="all">All roles</option>{[...new Set(teamWorkload.map((m:any)=>m.role))].map((role:any)=><option key={role} value={role}>{pretty(role)}</option>)}</select><select value={workloadStatus} onChange={event=>setWorkloadStatus(event.target.value)} aria-label="Filter workload by status"><option value="all">All workload</option><option value="overdue">Has overdue tasks</option><option value="tasks">Has open tasks</option><option value="review">Awaiting review</option></select></div>
          <div className="owner-workload-list">{teamWorkload.filter((m:any)=>(workloadRole==='all'||m.role===workloadRole)&&(workloadStatus==='all'||(workloadStatus==='overdue'?Number(m.overdue_task_count)>0:workloadStatus==='tasks'?Number(m.open_tasks)>0:Number(m.tasks_awaiting_review)>0))).length?teamWorkload.filter((m:any)=>(workloadRole==='all'||m.role===workloadRole)&&(workloadStatus==='all'||(workloadStatus==='overdue'?Number(m.overdue_task_count)>0:workloadStatus==='tasks'?Number(m.open_tasks)>0:Number(m.tasks_awaiting_review)>0))).map((member:any)=>{const assigned=Number(member.assigned_matters||0);const open=Number(member.open_tasks||0);const overdue=Number(member.overdue_task_count||0);const awaiting=Number(member.tasks_awaiting_review||0);const completed=Number(member.completed_task_count||0);const completion=Number(member.completion_pct||0);return <div key={member.user_uid}><span className="owner-workload-avatar">{String(member.name||member.email).slice(0,1).toUpperCase()}</span><span><strong>{member.name||member.email}</strong><small>{pretty(member.role)} · {assigned} assigned · {completed} completed · {open} pending · {overdue} overdue · {awaiting} awaiting review · {completion}% task completion</small><i><b style={{width:`${completion}%`}}/></i></span></div>}):<OwnerEmpty message="No team members match these workload filters."/>}</div>
        </section>
        <section className="panel owner-insight-card">
          <div className="panel-head"><div><h3>Reports awaiting action</h3><p>Review and submission queue</p></div><FileText size={18} className="panel-head-icon"/></div>
          <div className="owner-insight-list">{reports.length?reports.map((report:any)=><button key={report.property_id} onClick={()=>openPropertyById(report.property_id)}><span className="owner-report-icon"><FileCheck2 size={14}/></span><span><strong>{report.property_name}</strong><small>{report.action} · {memberName(report.assigned_owner)} · {report.due_date?dateLabel(report.due_date):'No due date'}</small></span><ArrowUpRight size={13}/></button>):<OwnerEmpty message="No reports are awaiting action."/>}</div>
        </section>
        <section className="panel owner-insight-card owner-document-review-card">
          <div className="panel-head"><div><h3>Documents requiring review</h3><p>Uploaded evidence awaiting processing or human review</p></div><FileSearch size={18} className="panel-head-icon"/></div>
          <button className="owner-review-total" onClick={()=>onNavigate("all-documents")}><span>Pending review</span><strong>{Number(documentCategories.pending_review)||0}</strong><ArrowUpRight size={15}/></button>
          <div className="owner-review-category-list"><button onClick={()=>onNavigate("all-documents")}><span>Title deeds</span><strong>{Number(documentCategories.pending_title_deeds)||0}</strong></button><button onClick={()=>onNavigate("all-documents")}><span>Encumbrance certificates</span><strong>{Number(documentCategories.pending_encumbrance_certificates)||0}</strong></button><button onClick={()=>onNavigate("all-documents")}><span>Survey / revenue records</span><strong>{Number(documentCategories.pending_survey_revenue_records)||0}</strong></button><button onClick={()=>onNavigate("all-documents")}><span>Other documents</span><strong>{Number(documentCategories.pending_other_documents)||0}</strong></button></div>
        </section>
      </div>
      <section className="panel owner-activity-panel">
        <div className="panel-head"><div><h3>Recent workspace activity</h3><p>Matter, evidence, review and report events</p></div><Activity size={18} className="panel-head-icon"/></div>
        <div className="owner-activity-list">{recentActivity.length?recentActivity.map((event:any)=><button key={event.id} onClick={()=>event.property_id&&openPropertyById(event.property_id)}><span className="owner-activity-dot"/><time>{dateLabel(event.created_at)}</time><span><strong>{pretty(event.action)}</strong><small>{event.actor_name||event.actor_uid}{event.property_name?` · ${event.property_name}`:''}{event.district?` · ${event.district}`:''}</small></span>{event.property_id&&<ArrowUpRight size={13}/>}</button>):<OwnerEmpty message="No recent workspace activity is available."/>}</div>
        {Number(activityPagination.total)>Number(activityPagination.pageSize)&&<div className="owner-feed-pagination"><span>{activityPagination.total} events · page {activityPage} of {activityPagination.totalPages}</span><button disabled={activityPage<=1} onClick={()=>setActivityPage(page=>Math.max(1,page-1))}>Previous</button><button disabled={activityPage>=activityPagination.totalPages} onClick={()=>setActivityPage(page=>Math.min(activityPagination.totalPages,page+1))}>Next</button></div>}
      </section>
      <div className="owner-boundary"><Scale size={17}/><div><strong>Operational oversight and legal responsibility remain separate</strong><p>The Workspace Owner coordinates delivery. Final legal conclusions remain the responsibility of the assigned qualified Legal Reviewer.</p></div></div>
    </div>
  );
}

function OwnerEmpty({message}:{message:string}) { return <div className="owner-empty-state"><ClipboardCheck size={16}/><span>{message}</span></div>; }

function ClientDashboard({
  properties,
  loading,
  currentUser,
  onOpen,
}: {
  properties: Property[];
  loading: boolean;
  currentUser: UserAccount;
  onOpen: (property: Property) => void;
}) {
  return (
    <div className="client-dashboard">
      <section className="client-welcome">
        <div>
          <div className="eyebrow">CLIENT / READ-ONLY REVIEWER</div>
          <h1>Your approved property reports</h1>
          <p>
            Welcome, {currentUser.name}. This secure view contains only matters
            released for client access.
          </p>
        </div>
        <div className="client-lock">
          <ShieldCheck size={19} />
          <span>Read-only access</span>
        </div>
      </section>
      <div className="client-notice">
        <ShieldCheck size={18} />
        <div>
          <strong>Approved information only</strong>
          <p>
            Draft findings, internal reviewer notes, source configuration and
            unapproved reports are not visible in this account.
          </p>
        </div>
      </div>
      {loading ? (
        <div className="panel loading-state">
          <LoaderCircle className="spin" /> Loading approved matters…
        </div>
      ) : properties.length === 0 ? (
        <section className="panel client-empty">
          <div className="empty-icon">
            <FileCheck2 size={24} />
          </div>
          <h2>No reports have been released yet</h2>
          <p>
            Your legal-review team is still preparing or approving the available
            property dossiers. Completed matters will appear here automatically.
          </p>
          <div>
            <Clock3 size={15} /> No action is required from you.
          </div>
        </section>
      ) : (
        <div className="client-matter-grid">
          {properties.map((property) => (
            <article className="panel" key={property.id}>
              <div className="client-matter-head">
                <div className="property-thumb large">
                  <Building2 size={20} />
                </div>
                <span className="status-pill green">
                  <Check size={11} /> Released
                </span>
              </div>
              <span className="client-application mono">
                {property.application_number}
              </span>
              <h2>{property.name}</h2>
              <p>
                <MapPin size={13} />
                {[property.village, property.taluk, property.district]
                  .filter(Boolean)
                  .join(" · ") || "Location recorded in report"}
              </p>
              <div className="client-matter-facts">
                <div>
                  <span>
                    {property.property_type === "non_agricultural"
                      ? property.property_identifier_type || "PROPERTY NUMBER"
                      : "SURVEY / HISSA"}
                  </span>
                  <strong>{propertyIdentityLabel(property)}</strong>
                </div>
                <div>
                  <span>Extent</span>
                  <strong>{property.extent || "See report"}</strong>
                </div>
                <div>
                  <span>Documents</span>
                  <strong>{property.document_count || 0}</strong>
                </div>
                <div>
                  <span>Last updated</span>
                  <strong>{dateLabel(property.updated_at)}</strong>
                </div>
              </div>
              <button
                className="primary-btn full-btn"
                onClick={() => onOpen(property)}
              >
                <Eye size={15} /> View approved matter
              </button>
            </article>
          ))}
        </div>
      )}
      <section className="client-help panel">
        <div>
          <CircleHelp size={19} />
          <span>
            <strong>Need clarification?</strong>
            <p>
              Contact your assigned legal reviewer about a finding or report
              statement. OJIX does not independently certify title or ownership.
            </p>
          </span>
        </div>
        <div className="client-access-list">
          <span>
            <Check size={13} /> Approved report
          </span>
          <span>
            <Check size={13} /> Released findings
          </span>
          <span>
            <Check size={13} /> Shared property context
          </span>
          <span className="blocked">
            <X size={13} /> Editing and internal drafts
          </span>
        </div>
      </section>
    </div>
  );
}

function AdminDashboard({
  overview,
  properties,
  accounts,
  loading,
  currentUser,
  onNavigate,
}: {
  overview: any;
  properties: Property[];
  accounts: UserAccount[];
  loading: boolean;
  currentUser: UserAccount;
  onNavigate: (
    page: "properties" | "settings" | "source-registry" | "all-documents",
  ) => void;
}) {
  const roleCounts = accounts.reduce<Record<string, number>>(
    (counts, account) => {
      counts[account.role] = (counts[account.role] || 0) + 1;
      return counts;
    },
    {},
  );
  const incompleteProperties = properties.filter(
    (property) =>
      (property.document_count || 0) === 0 ||
      property.latitude === null ||
      property.longitude === null,
  ).length;
  const integrations = [
    {
      label: "MariaDB workspace",
      status: overview.sourceHealth?.database || "Connected",
      tone: "green",
    },
    {
      label: "Government connectors",
      status: overview.sourceHealth?.governmentConnectors || "Not connected",
      tone: "grey",
    },
    {
      label: "Document storage",
      status: overview.sourceHealth?.documentStorage || "Local development",
      tone: "amber",
    },
    {
      label: "Document OCR",
      status: overview.sourceHealth?.ocr || "Not enabled",
      tone: "grey",
    },
    {
      label: "GIS layers",
      status: overview.sourceHealth?.gisLayers || "Demo only",
      tone: "amber",
    },
  ];
  return (
    <div className="admin-dashboard">
      <div className="admin-welcome">
        <div>
          <div className="eyebrow">ORGANISATION ADMINISTRATION</div>
          <h1>Workspace governance</h1>
          <p>
            Welcome, {currentUser.name}. Manage access, configuration, source
            health and operational controls for this tenant.
          </p>
        </div>
        <button className="primary-btn" onClick={() => onNavigate("settings")}>
          <Settings2 size={16} /> Open workspace settings
        </button>
      </div>
      <div className="admin-kpis">
        <div>
          <span>
            <UserCheck />
          </span>
          <small>Workspace members</small>
          <strong>{accounts.length || "—"}</strong>
          <p>Active demonstration identities</p>
        </div>
        <div>
          <span>
            <Building2 />
          </span>
          <small>Property applications</small>
          <strong>{loading ? "—" : overview.total || 0}</strong>
          <p>Within this tenant only</p>
        </div>
        <div>
          <span>
            <AlertTriangle />
          </span>
          <small>Incomplete dossiers</small>
          <strong>{loading ? "—" : incompleteProperties}</strong>
          <p>Missing documents or coordinates</p>
        </div>
        <div>
          <span>
            <Activity />
          </span>
          <small>Connected systems</small>
          <strong>1</strong>
          <p>Database connected; others pending</p>
        </div>
      </div>
      <div className="admin-main-grid">
        <section className="panel admin-members">
          <div className="panel-head">
            <div>
              <h3>Members and role assignments</h3>
              <p>
                Role access must follow least privilege and remain auditable.
              </p>
            </div>
            <button className="text-btn" onClick={() => onNavigate("settings")}>
              Manage access <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="admin-member-list">
            {accounts.map((account) => (
              <div key={account.uid}>
                <div
                  className="avatar"
                  style={{ backgroundColor: getAdminRoleColor(account.role) }}
                >
                  {account.avatar || initials(account.name)}
                </div>
                <div>
                  <strong>{account.name}</strong>
                  <span>
                    {account.designation} · {account.email}
                  </span>
                </div>
                <span className={`admin-role ${account.role}`}>
                  {pretty(account.role)}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel admin-roles">
          <div className="panel-head">
            <div>
              <h3>Role coverage</h3>
              <p>Current workspace responsibility distribution</p>
            </div>
            <ShieldCheck size={18} className="panel-head-icon" />
          </div>
          <div className="admin-role-list">
            {Object.entries(roleCounts).map(([role, count]) => (
              <div key={role}>
                <span className={`role-dot ${role}`} />
                <strong>{pretty(role)}</strong>
                <span>
                  {count} member{count === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
          <div className="admin-policy">
            <Key size={16} />
            <p>
              <strong>Privileged actions</strong>Settings and tenant
              administration are limited to Owner and Admin accounts.
            </p>
          </div>
        </section>
      </div>
      <div className="admin-lower-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Source and integration health</h3>
              <p>Connection state must never imply government verification.</p>
            </div>
            <button
              className="text-btn"
              onClick={() => onNavigate("source-registry")}
            >
              Open registry <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="admin-integration-list">
            {integrations.map((item) => (
              <SourceStatus
                key={item.label}
                label={item.label}
                status={pretty(item.status)}
                tone={item.tone}
              />
            ))}
          </div>
        </section>
        <section className="panel admin-controls">
          <div className="panel-head">
            <div>
              <h3>Governance controls</h3>
              <p>Required administrative safeguards</p>
            </div>
            <ShieldCheck size={18} className="panel-head-icon" />
          </div>
          <div>
            <button onClick={() => onNavigate("settings")}>
              <Settings2 />
              <span>
                <strong>Organisation settings</strong>
                <small>Branding, retention and report defaults</small>
              </span>
              <ArrowUpRight />
            </button>
            <button onClick={() => onNavigate("source-registry")}>
              <Activity />
              <span>
                <strong>Sources and connectors</strong>
                <small>Authority, health and refresh status</small>
              </span>
              <ArrowUpRight />
            </button>
            <button onClick={() => onNavigate("all-documents")}>
              <FolderOpen />
              <span>
                <strong>Document governance</strong>
                <small>Storage, processing and evidence register</small>
              </span>
              <ArrowUpRight />
            </button>
            <button onClick={() => onNavigate("properties")}>
              <BriefcaseBusiness />
              <span>
                <strong>Application oversight</strong>
                <small>Tenant property workload and completeness</small>
              </span>
              <ArrowUpRight />
            </button>
          </div>
        </section>
      </div>
      <div className="admin-boundary">
        <ShieldAlert size={17} />
        <div>
          <strong>Administrative authority is not legal approval</strong>
          <p>
            Admins govern the workspace and its controls. A qualified Lead
            Advocate remains responsible for final due-diligence conclusions and
            report sign-off.
          </p>
        </div>
      </div>
    </div>
  );
}
function getAdminRoleColor(role: UserRole) {
  return role === "owner"
    ? "#4338ca"
    : role === "admin"
      ? "#0369a1"
      : role === "lawyer"
        ? "#1d4ed8"
        : role === "analyst"
          ? "#047857"
          : role === "operations"
            ? "#c2410c"
            : role === "consultant"
              ? "#0f766e"
              : role === "support"
                ? "#7c3aed"
                : role === "data_steward"
                  ? "#0e7490"
                  : "#64748b";
}

type AnalystDocument = Doc & {
  property_id: string;
  property_name: string;
  survey_number: string;
  village: string;
};
function AnalystDashboard({
  overview,
  properties,
  loading,
  onOpen,
  currentUser,
}: {
  overview: any;
  properties: Property[];
  loading: boolean;
  onOpen: (p: Property) => void;
  currentUser: UserAccount;
}) {
  const [documents, setDocuments] = useState<AnalystDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState<"review" | "all">("review");
  useEffect(() => {
    let active = true;
    setDocsLoading(true);
    api<{ items: AnalystDocument[] }>("/api/documents/all")
      .then((data) => {
        if (active) setDocuments(data.items || []);
      })
      .catch(() => {
        if (active) setDocuments([]);
      })
      .finally(() => {
        if (active) setDocsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const reviewDocs = documents.filter(
    (doc) => doc.processing_status !== "completed",
  );
  const visibleDocs = (queueFilter === "review" ? reviewDocs : documents).slice(
    0,
    8,
  );
  const evidenceGaps = properties.filter(
    (property) =>
      (property.document_count || 0) === 0 ||
      property.latitude === null ||
      property.longitude === null,
  );
  const openDocument = (doc: AnalystDocument) => {
    const property = properties.find((item) => item.id === doc.property_id);
    if (property) onOpen(property);
  };
  return (
    <div className="analyst-dashboard">
      <div className="analyst-welcome">
        <div>
          <div className="eyebrow">ASSOCIATE / ANALYST</div>
          <h1>Evidence analysis workspace</h1>
          <p>
            Welcome, {currentUser.name}. Validate extracted facts, compare
            survey evidence and prepare assigned dossiers for Lawyer review.
          </p>
        </div>
        <div className="analyst-assignment-badge">
          <BriefcaseBusiness size={16} />
          <span>
            {properties.length} assigned application
            {properties.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <div className="analyst-kpis">
        <div>
          <span>
            <FileSearch />
          </span>
          <small>Extraction review</small>
          <strong>{docsLoading ? "—" : reviewDocs.length}</strong>
          <p>Documents requiring attention</p>
        </div>
        <div>
          <span>
            <FileCheck2 />
          </span>
          <small>Processed documents</small>
          <strong>
            {docsLoading
              ? "—"
              : documents.filter((doc) => doc.processing_status === "completed")
                  .length}
          </strong>
          <p>Available for evidence review</p>
        </div>
        <div>
          <span>
            <AlertTriangle />
          </span>
          <small>Evidence gaps</small>
          <strong>{loading ? "—" : evidenceGaps.length}</strong>
          <p>Missing files or coordinates</p>
        </div>
        <div>
          <span>
            <ShieldAlert />
          </span>
          <small>Open findings</small>
          <strong>{loading ? "—" : overview.findings || 0}</strong>
          <p>Require evidence and rationale</p>
        </div>
      </div>
      <div className="analyst-main-grid">
        <section className="panel analyst-queue">
          <div className="panel-head">
            <div>
              <div className="eyebrow">PRIMARY QUEUE</div>
              <h3>Document extraction review</h3>
              <p>
                Review low-confidence or incomplete extraction before using
                facts in findings.
              </p>
            </div>
            <div className="queue-toggle">
              <button
                className={queueFilter === "review" ? "active" : ""}
                onClick={() => setQueueFilter("review")}
              >
                Needs review
              </button>
              <button
                className={queueFilter === "all" ? "active" : ""}
                onClick={() => setQueueFilter("all")}
              >
                All documents
              </button>
            </div>
          </div>
          {docsLoading ? (
            <div className="loading-state">
              <LoaderCircle className="spin" /> Loading document queue…
            </div>
          ) : visibleDocs.length === 0 ? (
            <EmptyState
              title={
                queueFilter === "review"
                  ? "No documents need extraction review"
                  : "No documents uploaded"
              }
              text={
                queueFilter === "review"
                  ? "Operations uploads requiring manual review will appear here."
                  : "Upload evidence through the Operations workflow."
              }
            />
          ) : (
            <div className="analyst-doc-list">
              {visibleDocs.map((doc) => (
                <button key={doc.id} onClick={() => openDocument(doc)}>
                  <div className="doc-icon">
                    <FileText size={17} />
                  </div>
                  <div>
                    <strong>{doc.original_filename}</strong>
                    <span>
                      {doc.property_name} · Survey {doc.survey_number || "—"}
                    </span>
                    <small>
                      {pretty(doc.doc_type)} · {formatBytes(doc.size_bytes)}
                    </small>
                  </div>
                  <span
                    className={`status-pill ${doc.processing_status === "completed" ? "green" : "amber"}`}
                  >
                    {pretty(doc.processing_status)}
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          )}
        </section>
        <aside className="panel analyst-workflow">
          <div className="panel-head">
            <div>
              <h3>Analyst workflow</h3>
              <p>Required sequence for evidence preparation</p>
            </div>
            <ClipboardCheck size={18} className="panel-head-icon" />
          </div>
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>Review extraction</strong>
                <p>Compare extracted fields with the source page.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Correct with rationale</strong>
                <p>Record why any extracted value was changed.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Tag evidence</strong>
                <p>Connect facts to property, title event or finding.</p>
              </div>
            </li>
            <li>
              <span>4</span>
              <div>
                <strong>Run preliminary review</strong>
                <p>Generate evidence-readiness findings.</p>
              </div>
            </li>
            <li>
              <span>5</span>
              <div>
                <strong>Send to Lead Advocate</strong>
                <p>Legal conclusions remain reviewer-controlled.</p>
              </div>
            </li>
          </ol>
        </aside>
      </div>
      <section className="panel evidence-gap-panel">
        <div className="panel-head">
          <div>
            <h3>Property evidence gaps</h3>
            <p>
              Operational gaps to resolve before the dossier is ready for legal
              review.
            </p>
          </div>
          <span className="result-count">{evidenceGaps.length} properties</span>
        </div>
        {evidenceGaps.length ? (
          <div className="evidence-gap-grid">
            {evidenceGaps.slice(0, 6).map((property) => (
              <button key={property.id} onClick={() => onOpen(property)}>
                <div>
                  <strong>{property.name}</strong>
                  <span className="mono">{property.application_number}</span>
                </div>
                <div>
                  {(property.document_count || 0) === 0 && (
                    <small>Documents missing</small>
                  )}
                  {(property.latitude === null ||
                    property.longitude === null) && (
                    <small>Map point missing</small>
                  )}
                </div>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        ) : (
          <div className="analyst-ready">
            <BadgeCheck size={20} />
            <span>
              All current properties have documents and a recorded map point.
            </span>
          </div>
        )}
      </section>
      <div className="analyst-boundary">
        <ShieldCheck size={17} />
        <div>
          <strong>Analyst authority boundary</strong>
          <p>
            You can prepare evidence and run preliminary checks. Final findings,
            title decisions and client-facing approval belong to the Lead
            Advocate.
          </p>
        </div>
      </div>
    </div>
  );
}

function DocumentIntakeDashboard({
  properties,
  loading,
  onOpen,
  onRefresh,
  currentUser,
}: {
  properties: Property[];
  loading: boolean;
  onOpen: (p: Property) => void;
  onRefresh: () => Promise<void>;
  currentUser: UserAccount;
}) {
  const [step, setStep] = useState(1);
  const [propertyId, setPropertyId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileMetadata, setFileMetadata] = useState<
    Record<
      string,
      {
        documentType: string;
        customDocumentType: string;
        classificationConfidence: string;
        manualReview: boolean;
      }
    >
  >({});
  const [uploaded, setUploaded] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const selectedProperty = properties.find((p) => p.id === propertyId);
  const fileKey = (file: File) =>
    `${file.name}:${file.size}:${file.lastModified}`;
  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const allowedTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/tiff",
    ]);
    const valid = incoming.filter(
      (file) =>
        allowedTypes.has(file.type) ||
        /\.(pdf|jpe?g|png|tiff?)$/i.test(file.name),
    );
    const tooLarge = valid.filter((file) => file.size > 25 * 1024 * 1024);
    if (valid.length !== incoming.length) {
      setUploadError("Only PDF, JPEG, PNG and TIFF files are accepted.");
      return;
    }
    if (tooLarge.length) {
      setUploadError(`${tooLarge[0].name} exceeds the 25 MB file limit.`);
      return;
    }
    setFiles((current) => {
      const keys = new Set(current.map((file) => fileKey(file)));
      const unique = valid.filter((file) => !keys.has(fileKey(file)));
      const combined = [...current, ...unique];
      setFileMetadata((meta) => {
        const next = { ...meta };
        unique.forEach((file) => {
          next[fileKey(file)] = {
            documentType,
            customDocumentType: "",
            classificationConfidence: "100",
            manualReview: false,
          };
        });
        return next;
      });
      if (combined.length > 10)
        setUploadError("A maximum of 10 files can be uploaded in one batch.");
      else setUploadError("");
      return combined.slice(0, 10);
    });
  };
  const dropFiles = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };
  const submitUpload = async () => {
    if (!selectedProperty || !documentType || !files.length) return;
    const entries = files.map(
      (file) =>
        fileMetadata[fileKey(file)] || {
          documentType,
          customDocumentType: "",
          classificationConfidence: "100",
          manualReview: false,
        },
    );
    if (
      entries.some(
        (entry) =>
          !entry.documentType ||
          (entry.documentType === "other" && !entry.customDocumentType.trim()),
      )
    ) {
      setUploadError("Classify every file and name every Other document type.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      body.append(
        "metadata",
        JSON.stringify(
          entries.map((entry) => ({
            ...entry,
            classificationConfidence:
              Number(entry.classificationConfidence) / 100,
          })),
        ),
      );
      const result = await api<{ items: Doc[]; note: string }>(
        `/api/properties/${selectedProperty.id}/documents`,
        { method: "POST", body },
      );
      setUploaded(result.items);
      setStep(4);
      await onRefresh();
    } catch (error) {
      setUploadError((error as Error).message);
    } finally {
      setUploading(false);
    }
  };
  const reset = () => {
    setStep(1);
    setPropertyId("");
    setDocumentType("");
    setFiles([]);
    setFileMetadata({});
    setUploaded([]);
    setUploadError("");
  };
  return (
    <div className="intake-dashboard">
      <div className="intake-welcome">
        <div>
          <div className="eyebrow">PARALEGAL / OPERATIONS</div>
          <h1>Document intake</h1>
          <p>
            Welcome, {currentUser.name}. Assign every source file to the correct
            property before extraction and legal review.
          </p>
        </div>
        <div className="intake-stat">
          <FileText />
          <span>Workspace documents</span>
          <strong>
            {properties.reduce(
              (sum, p) => sum + (Number(p.document_count) || 0),
              0,
            )}
          </strong>
        </div>
      </div>
      <div className="intake-stepper">
        {[
          "Select property",
          "Document type",
          "Choose files",
          "Confirmation",
        ].map((label, index) => (
          <div
            className={`${step === index + 1 ? "active" : ""} ${step > index + 1 ? "complete" : ""}`}
            key={label}
          >
            <span>{step > index + 1 ? <Check size={14} /> : index + 1}</span>
            <strong>{label}</strong>
          </div>
        ))}
      </div>
      <section className="panel intake-workspace">
        {step === 1 && (
          <>
            <div className="panel-head">
              <div>
                <h3>1. Select the destination property</h3>
                <p>
                  The application number and survey details help prevent
                  incorrect document assignment.
                </p>
              </div>
            </div>
            <div className="intake-property-grid">
              {loading ? (
                <div className="loading-state">
                  <LoaderCircle className="spin" /> Loading properties…
                </div>
              ) : (
                properties.map((property) => (
                  <button
                    key={property.id}
                    className={propertyId === property.id ? "selected" : ""}
                    onClick={() => setPropertyId(property.id)}
                  >
                    <span className="mono">
                      {property.application_number || property.id.slice(0, 8)}
                    </span>
                    <strong>{property.name}</strong>
                    <small>
                      Survey {property.survey_number || "—"} ·{" "}
                      {[property.village, property.district]
                        .filter(Boolean)
                        .join(" · ") || "Location pending"}
                    </small>
                    <em>{property.document_count || 0} existing documents</em>
                    {propertyId === property.id && <Check size={16} />}
                  </button>
                ))
              )}
            </div>
            <div className="intake-actions">
              <span>
                {selectedProperty
                  ? `Selected: ${selectedProperty.name}`
                  : "Select one property to continue"}
              </span>
              <button
                className="primary-btn"
                disabled={!propertyId}
                onClick={() => setStep(2)}
              >
                Continue <ArrowUpRight size={14} />
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="panel-head">
              <div>
                <h3>2. Choose the default document type</h3>
                <p>
                  This default is applied to new files. You can classify every
                  file independently before upload.
                </p>
              </div>
            </div>
            <div className="document-type-grid">
              {DOCUMENT_TYPE_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  className={documentType === value ? "selected" : ""}
                  onClick={() => setDocumentType(value)}
                >
                  <FileText size={17} />
                  <span>{label}</span>
                  {documentType === value && <Check size={14} />}
                </button>
              ))}
            </div>
            <div className="intake-actions">
              <button className="secondary-btn" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="primary-btn"
                disabled={!documentType}
                onClick={() => setStep(3)}
              >
                Continue <ArrowUpRight size={14} />
              </button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="panel-head">
              <div>
                <h3>3. Choose, classify and verify files</h3>
                <p>
                  Classify each file, record confidence and route uncertain
                  evidence to manual review.
                </p>
              </div>
              <span className="status-pill grey">Up to 10 files</span>
            </div>
            <label
              className="intake-dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={dropFiles}
            >
              <CloudUpload size={31} />
              <strong>Click to choose or drag files here</strong>
              <span>PDF, JPG, PNG or TIFF · maximum 25 MB each</span>
              <input
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/tiff,.pdf,.jpg,.jpeg,.png,.tif,.tiff"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            {files.length > 0 && (
              <div className="intake-file-list classified">
                {files.map((file, index) => {
                  const key = fileKey(file);
                  const meta = fileMetadata[key] || {
                    documentType,
                    customDocumentType: "",
                    classificationConfidence: "100",
                    manualReview: false,
                  };
                  const update = (next: Partial<typeof meta>) =>
                    setFileMetadata((current) => ({
                      ...current,
                      [key]: { ...meta, ...next },
                    }));
                  return (
                    <div key={key}>
                      <FileText size={16} />
                      <span>
                        <strong>{file.name}</strong>
                        <small>
                          {file.type || "Document"} · {formatBytes(file.size)}
                        </small>
                      </span>
                      <select
                        aria-label={`Document type for ${file.name}`}
                        value={meta.documentType}
                        onChange={(e) =>
                          update({
                            documentType: e.target.value,
                            customDocumentType:
                              e.target.value === "other"
                                ? meta.customDocumentType
                                : "",
                          })
                        }
                      >
                        {DOCUMENT_TYPE_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {meta.documentType === "other" && (
                        <input
                          aria-label={`Custom document type for ${file.name}`}
                          required
                          value={meta.customDocumentType}
                          onChange={(e) =>
                            update({ customDocumentType: e.target.value })
                          }
                          placeholder="Custom type"
                        />
                      )}
                      <label className="confidence-field">
                        Confidence{" "}
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={meta.classificationConfidence}
                          onChange={(e) =>
                            update({ classificationConfidence: e.target.value })
                          }
                        />
                        <span>%</span>
                      </label>
                      <label className="manual-review-check">
                        <input
                          type="checkbox"
                          checked={meta.manualReview}
                          onChange={(e) =>
                            update({ manualReview: e.target.checked })
                          }
                        />{" "}
                        Manual review
                      </label>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => {
                          setFiles((current) =>
                            current.filter((_, i) => i !== index),
                          );
                          setFileMetadata((current) => {
                            const next = { ...current };
                            delete next[key];
                            return next;
                          });
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {uploadError && (
              <p className="data-warning intake-upload-error">
                <AlertTriangle size={15} />
                {uploadError}
              </p>
            )}
            <div className="intake-confirmation">
              <p>
                <ShieldCheck size={15} /> Confirm these files belong to{" "}
                <strong>{selectedProperty?.name}</strong>, application{" "}
                <strong className="mono">
                  {selectedProperty?.application_number}
                </strong>
                .
              </p>
            </div>
            <div className="intake-actions">
              <button className="secondary-btn" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="primary-btn"
                disabled={!files.length || uploading}
                onClick={submitUpload}
              >
                {uploading ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Upload size={15} />
                )}{" "}
                {uploading
                  ? "Uploading…"
                  : files.length
                    ? `Upload ${files.length} file${files.length === 1 ? "" : "s"}`
                    : "Select files first"}
              </button>
            </div>
          </>
        )}
        {step === 4 && (
          <div className="intake-success">
            <div className="success-mark">
              <Check size={26} />
            </div>
            <h3>
              {uploaded.length} document{uploaded.length === 1 ? "" : "s"}{" "}
              uploaded
            </h3>
            <p>
              The files are assigned to{" "}
              <strong>{selectedProperty?.name}</strong>. Review any item marked
              for manual review.
            </p>
            <div className="intake-results">
              {uploaded.map((doc) => (
                <div key={doc.id}>
                  <FileText size={16} />
                  <span>
                    <strong>{doc.original_filename}</strong>
                    <small>
                      {pretty(doc.doc_type)} · {formatBytes(doc.size_bytes)}
                    </small>
                  </span>
                  <span
                    className={`status-pill ${doc.processing_status === "completed" ? "green" : "amber"}`}
                  >
                    {pretty(doc.processing_status)}
                  </span>
                </div>
              ))}
            </div>
            <div className="intake-success-actions">
              <button className="secondary-btn" onClick={reset}>
                <Plus size={15} /> Upload another batch
              </button>
              {selectedProperty && (
                <button
                  className="primary-btn"
                  onClick={() => onOpen(selectedProperty)}
                >
                  Open property documents <ArrowUpRight size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </section>
      <div className="intake-guidance">
        <ShieldAlert size={17} />
        <div>
          <strong>Evidence handling requirement</strong>
          <p>
            Verify the destination property and document type before upload. Do
            not treat successful extraction as legal verification.
          </p>
        </div>
      </div>
    </div>
  );
}

function ReviewerOverview({
  overview,
  properties,
  loading,
  onOpen,
  onProperties,
  currentUser,
}: {
  overview: any;
  properties: Property[];
  loading: boolean;
  onOpen: (p: Property) => void;
  onProperties: () => void;
  currentUser: UserAccount;
}) {
  const reviewQueue = [...properties].sort((a, b) => {
    const aAttention = (a.document_count || 0) === 0 ? 1 : 0;
    const bAttention = (b.document_count || 0) === 0 ? 1 : 0;
    return (
      bAttention - aAttention ||
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  });
  const evidenceReady = properties.filter(
    (p) =>
      (p.document_count || 0) > 0 &&
      p.latitude !== null &&
      p.longitude !== null,
  ).length;
  const openReviews = properties.filter(
    (p) => !["complete", "closed", "archived"].includes(p.status),
  ).length;
  const readyForApproval = properties.filter(
    (p) => p.status === "ready_for_review",
  ).length;
  const assignedFindings = (overview.recentFindings || []).filter(
    (finding: any) =>
      properties.some((property) => property.id === finding.property_id),
  );
  return (
    <div className="reviewer-dashboard">
      <div className="reviewer-welcome">
        <div>
          <div className="eyebrow">LEAD ADVOCATE / REVIEWER</div>
          <h1>Good day, {currentUser.name.split(" ")[0]}</h1>
          <p>
            Review evidence, resolve material issues and approve only dossiers
            supported by traceable sources.
          </p>
        </div>
        <button className="primary-btn" onClick={onProperties}>
          <BriefcaseBusiness size={17} /> Open review queue
        </button>
      </div>
      <div className="reviewer-kpis">
        <div>
          <span>
            <BriefcaseBusiness />
          </span>
          <small>Assigned open reviews</small>
          <strong>{loading ? "—" : openReviews}</strong>
          <p>Your property dossiers in progress</p>
        </div>
        <div>
          <span>
            <FileCheck2 />
          </span>
          <small>Evidence ready</small>
          <strong>{loading ? "—" : evidenceReady}</strong>
          <p>Documents and map point recorded</p>
        </div>
        <div>
          <span>
            <ShieldAlert />
          </span>
          <small>Assigned findings</small>
          <strong>{loading ? "—" : assignedFindings.length}</strong>
          <p>Require reviewer assessment</p>
        </div>
        <div>
          <span>
            <BadgeCheck />
          </span>
          <small>Ready for approval</small>
          <strong>{loading ? "—" : readyForApproval}</strong>
          <p>Awaiting professional decision</p>
        </div>
      </div>
      <section className="panel reviewer-priority">
        <div className="panel-head">
          <div>
            <div className="eyebrow">PRIORITY WORK</div>
            <h3>Due-diligence review queue</h3>
            <p>
              Applications with missing evidence are shown first. Queue order is
              operational, not a legal-risk score.
            </p>
          </div>
          <button className="text-btn" onClick={onProperties}>
            View all <ArrowUpRight size={14} />
          </button>
        </div>
        {loading ? (
          <div className="loading-state">
            <LoaderCircle className="spin" /> Loading review queue…
          </div>
        ) : reviewQueue.length === 0 ? (
          <EmptyState
            title="No dossiers in the queue"
            text="New property applications will appear here for review."
          />
        ) : (
          <div className="reviewer-table-wrap">
            <table className="reviewer-table">
              <thead>
                <tr>
                  <th>APPLICATION</th>
                  <th>PROPERTY</th>
                  <th>EVIDENCE</th>
                  <th>MAP</th>
                  <th>STATUS</th>
                  <th>NEXT REVIEW ACTION</th>
                </tr>
              </thead>
              <tbody>
                {reviewQueue.slice(0, 8).map((p) => {
                  const missingDocs = (p.document_count || 0) === 0;
                  const missingMap =
                    p.latitude === null || p.longitude === null;
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong className="mono">
                          {p.application_number ||
                            p.id.slice(0, 8).toUpperCase()}
                        </strong>
                        <small>Updated {dateLabel(p.updated_at)}</small>
                      </td>
                      <td>
                        <strong>{p.name}</strong>
                        <small>
                          {propertyIdentityLabel(p)} ·{" "}
                          {p.village || "Location pending"}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`review-signal ${missingDocs ? "attention" : "ready"}`}
                        >
                          {missingDocs
                            ? "Missing"
                            : `${p.document_count} file${p.document_count === 1 ? "" : "s"}`}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`review-signal ${missingMap ? "attention" : "ready"}`}
                        >
                          {missingMap ? "Missing" : "Recorded"}
                        </span>
                      </td>
                      <td>
                        <StatusPill status={p.status} />
                      </td>
                      <td>
                        <button
                          className="application-view"
                          onClick={() => onOpen(p)}
                        >
                          {missingDocs
                            ? "Request evidence"
                            : missingMap
                              ? "Verify location"
                              : "Review dossier"}{" "}
                          <ArrowUpRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="reviewer-lower-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Latest assigned findings requiring attention</h3>
              <p>
                Open the dossier to inspect evidence and record a reviewer
                decision.
              </p>
            </div>
            <ShieldAlert size={18} className="panel-head-icon" />
          </div>
          {assignedFindings.length ? (
            <div className="reviewer-finding-list">
              {assignedFindings.slice(0, 5).map((finding: any) => (
                <button
                  key={finding.id}
                  onClick={() => {
                    const property = properties.find(
                      (p) => p.id === finding.property_id,
                    );
                    if (property) onOpen(property);
                  }}
                >
                  <span className={`severity ${finding.severity}`}>
                    {pretty(finding.severity)}
                  </span>
                  <div>
                    <strong>{finding.title}</strong>
                    <small>
                      {finding.property_name} ·{" "}
                      {pretty(finding.evidence_status)} evidence
                    </small>
                  </div>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No assigned findings"
              text="Findings for your assigned matters will appear here."
            />
          )}
        </section>
        <section className="panel reviewer-standard">
          <div className="panel-head">
            <div>
              <h3>Reviewer standard</h3>
              <p>Required before final sign-off</p>
            </div>
            <Scale size={18} className="panel-head-icon" />
          </div>
          <div className="reviewer-checks">
            <p>
              <Check size={15} /> Identity facts checked against primary
              evidence
            </p>
            <p>
              <Check size={15} /> Title events and contradictions reviewed
            </p>
            <p>
              <Check size={15} /> Map layers and limitations acknowledged
            </p>
            <p>
              <Check size={15} /> Findings include rationale and evidence
            </p>
            <p>
              <Check size={15} /> Client report generated from approved findings
            </p>
          </div>
          <div className="reviewer-warning">
            <AlertTriangle size={16} />
            <span>
              AI output remains an internal aid. Final conclusions require a
              named qualified reviewer.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

function Overview({
  overview,
  properties,
  loading,
  onCreate,
  onOpen,
  onProperties,
  currentUser,
}: {
  overview: any;
  properties: Property[];
  loading: boolean;
  onCreate: () => void;
  onOpen: (p: Property) => void;
  onProperties: () => void;
  currentUser: UserAccount;
}) {
  const isViewer = currentUser.role === "viewer";
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            PROPERTY DUE DILIGENCE <span>•</span> BENGALURU FIRST
          </div>
          <h1>Good morning, {currentUser.name}</h1>
          <p>
            Active Session:{" "}
            <strong>
              {currentUser.designation} ({currentUser.role.toUpperCase()})
            </strong>
            . See what is known, what needs review, and which evidence is still
            missing.
          </p>
        </div>
        <button
          className="primary-btn"
          onClick={onCreate}
          disabled={isViewer}
          title={
            isViewer
              ? "Read-only role: Property creation disabled"
              : "Create new property workspace"
          }
          style={isViewer ? { opacity: 0.6, cursor: "not-allowed" } : {}}
        >
          <Plus size={17} /> New property review {isViewer && "(Locked)"}
        </button>
      </div>
      <div className="notice-banner">
        <div className="notice-icon">
          <ShieldCheck size={21} />
        </div>
        <div>
          <strong>Evidence before conclusions</strong>
          <p>
            OJIX organizes documents, map context and review tasks. It does not
            certify ownership or replace professional legal review.
          </p>
        </div>
        <span className="banner-tag">MVP WORKSPACE</span>
      </div>
      <section className="review-flow-panel">
        <div className="review-flow-heading">
          <div>
            <span className="eyebrow">PROPERTY REVIEW WORKFLOW</span>
            <h2>From intake to professional approval</h2>
            <p>
              Complete each stage using evidence. A later stage does not
              automatically verify an earlier one.
            </p>
          </div>
          <button className="secondary-btn" onClick={onProperties}>
            Open workspaces <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="review-flow">
          <WorkflowStep
            number="1"
            icon={<Building2 size={18} />}
            title="Create property"
            detail="Identity and location"
            state={Number(overview.total) > 0 ? "active" : "next"}
          />
          <WorkflowStep
            number="2"
            icon={<MapPin size={18} />}
            title="Add parcels"
            detail="Survey and Hissa"
            state={Number(overview.total) > 0 ? "active" : "locked"}
          />
          <WorkflowStep
            number="3"
            icon={<FileText size={18} />}
            title="Add evidence"
            detail="Deeds, RTC, EC and khata"
            state={
              Number(overview.documents) > 0
                ? "active"
                : Number(overview.total) > 0
                  ? "next"
                  : "locked"
            }
          />
          <WorkflowStep
            number="4"
            icon={<GitMerge size={18} />}
            title="Review title and map"
            detail="Timeline and spatial context"
            state={Number(overview.documents) > 0 ? "next" : "locked"}
          />
          <WorkflowStep
            number="5"
            icon={<ShieldAlert size={18} />}
            title="Resolve findings"
            detail="Evidence and rationale"
            state={Number(overview.findings) > 0 ? "active" : "locked"}
          />
          <WorkflowStep
            number="6"
            icon={<BadgeCheck size={18} />}
            title="Approve report"
            detail="Senior legal review"
            state={Number(overview.ready_for_review) > 0 ? "next" : "locked"}
          />
        </div>
      </section>
      <div className="overview-visual-grid">
        <ReviewStatusChart overview={overview} />
      </div>
      <PortfolioCommandCenter
        overview={overview}
        properties={properties}
        onOpen={onOpen}
      />
      <div className="section-header">
        <div>
          <h2>Workspace overview</h2>
          <p>Live counts from your local development database</p>
        </div>
        <button className="text-btn" onClick={onProperties}>
          View all properties <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="metric-grid">
        <Metric
          icon={<Building2 size={18} />}
          label="Property workspaces"
          value={loading ? "—" : overview.total}
          change="All tenant workspaces"
          tone="blue"
        />
        <Metric
          icon={<Clock3 size={18} />}
          label="In review"
          value={loading ? "—" : overview.in_review}
          change="Active due-diligence work"
          tone="amber"
        />
        <Metric
          icon={<FileSearch size={18} />}
          label="Missing evidence"
          value={loading ? "—" : overview.missing_documents}
          change="Properties without documents"
          tone="violet"
        />
        <Metric
          icon={<ShieldAlert size={18} />}
          label="High-attention findings"
          value={loading ? "—" : overview.high_attention_findings}
          change="High or critical findings"
          tone="amber"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel recent-panel">
          <div className="panel-head">
            <div>
              <h3>Recent property workspaces</h3>
              <p>Continue where you left off</p>
            </div>
            <button
              className="icon-btn"
              onClick={onProperties}
              aria-label="View all"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
          {properties.length === 0 && !loading ? (
            <EmptyState
              title="No property workspaces yet"
              text="Create your first workspace to start organizing property evidence."
              action="Create property"
              onAction={onCreate}
            />
          ) : (
            <div className="property-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PROPERTY</th>
                    <th>SURVEY / LOCATION</th>
                    <th>STATUS</th>
                    <th>UPDATED</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {properties.slice(0, 5).map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => onOpen(p)}
                      className="click-row"
                    >
                      <td>
                        <div className="property-cell">
                          <div className="property-thumb">
                            <Building2 size={17} />
                          </div>
                          <div>
                            <strong>{p.name}</strong>
                            <small>
                              {p.district || "District not recorded"}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong className="mono">
                          {p.survey_number || "Not recorded"}
                        </strong>
                        <small>{p.village || "Village not recorded"}</small>
                      </td>
                      <td>
                        <StatusPill status={p.status} />
                      </td>
                      <td className="muted">{dateLabel(p.updated_at)}</td>
                      <td>
                        <ChevronDown className="row-arrow" size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel checklist-panel">
          <div className="panel-head">
            <div>
              <h3>Review readiness</h3>
              <p>Average evidence completeness across workspaces</p>
            </div>
            <div className="panel-icon">
              <ClipboardCheck size={18} />
            </div>
          </div>
          <div className="readiness-intro">
            <div className="readiness-ring">
              <span>{Number(overview.readiness_pct || 0)}%</span>
            </div>
            <div>
              <strong>Workspace completeness</strong>
              <p>Completion indicator only; not a legal risk score.</p>
            </div>
          </div>
          <div className="checklist">
            <ChecklistItem
              icon={<Check size={14} />}
              label="Property identity"
              note="Survey, village and extent"
            />
            <ChecklistItem
              icon={<FileCheck2 size={14} />}
              label="Document evidence"
              note={`${overview.missing_documents || 0} properties still missing files`}
              pending={Number(overview.missing_documents) > 0}
            />
            <ChecklistItem
              icon={<MapPin size={14} />}
              label="Coordinates"
              note={`${overview.missing_coordinates || 0} properties missing a map point`}
              pending={Number(overview.missing_coordinates) > 0}
            />
            <ChecklistItem
              icon={<Scale size={14} />}
              label="Four-side boundaries"
              note="Required for complete schedule review"
              pending
            />
            <ChecklistItem
              icon={<BadgeCheck size={14} />}
              label="Professional verification"
              note="Required before transaction decisions"
              pending
            />
          </div>
          <button className="secondary-btn full-btn" onClick={onProperties}>
            Review properties <ArrowDownRight size={15} />
          </button>
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="panel recent-panel">
          <div className="panel-head">
            <div>
              <h3>Recent findings</h3>
              <p>Latest evidence and review issues requiring attention</p>
            </div>
            <ShieldAlert size={18} className="panel-head-icon" />
          </div>
          {overview.recentFindings?.length ? (
            <div className="property-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PROPERTY</th>
                    <th>FINDING</th>
                    <th>SEVERITY</th>
                    <th>EVIDENCE</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentFindings.map((finding: any) => (
                    <tr
                      key={finding.id}
                      className="click-row"
                      onClick={() => {
                        const property = properties.find(
                          (item) => item.id === finding.property_id,
                        );
                        if (property) onOpen(property);
                      }}
                    >
                      <td>
                        <strong>{finding.property_name}</strong>
                      </td>
                      <td>{finding.title}</td>
                      <td>
                        <span className={`severity ${finding.severity}`}>
                          {pretty(finding.severity)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`evidence-status ${finding.evidence_status}`}
                        >
                          {pretty(finding.evidence_status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No findings recorded"
              text="Run property screening to create evidence-readiness findings."
            />
          )}
        </section>
        <section className="panel source-panel">
          <div className="panel-head">
            <div>
              <h3>Source and system health</h3>
              <p>Current integration status without implied verification</p>
            </div>
            <Activity size={18} className="panel-head-icon" />
          </div>
          <SourceStatus
            label="MariaDB workspace"
            status="Connected"
            tone="green"
          />
          <SourceStatus
            label="Government connectors"
            status="Not connected"
            tone="grey"
          />
          <SourceStatus
            label="Document storage"
            status="Local development"
            tone="amber"
          />
          <SourceStatus label="Document OCR" status="Not enabled" tone="grey" />
          <SourceStatus label="GIS layers" status="Demo only" tone="amber" />
        </section>
      </div>
    </>
  );
}
function Metric({
  icon,
  label,
  value,
  change,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: any;
  change: string;
  tone: string;
}) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-change">{change}</div>
    </div>
  );
}
function WorkflowStep({
  number,
  icon,
  title,
  detail,
  state,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  detail: string;
  state: "active" | "next" | "locked";
}) {
  return (
    <div className={`review-flow-step ${state}`}>
      <div className="review-flow-number">
        {state === "active" ? <Check size={14} /> : number}
      </div>
      <div className="review-flow-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <small>
        {state === "active" ? "Started" : state === "next" ? "Next" : "Pending"}
      </small>
    </div>
  );
}
function ReviewStatusChart({ overview }: { overview: any }) {
  const total = Math.max(Number(overview.total) || 0, 1);
  const rows = [
    {
      label: "In review",
      value: Number(overview.in_review) || 0,
      tone: "amber",
    },
    {
      label: "Ready for review",
      value: Number(overview.ready_for_review) || 0,
      tone: "green",
    },
    {
      label: "Missing evidence",
      value: Number(overview.missing_documents) || 0,
      tone: "violet",
    },
    {
      label: "Missing coordinates",
      value: Number(overview.missing_coordinates) || 0,
      tone: "blue",
    },
  ];
  const readiness = Math.max(
    0,
    Math.min(100, Number(overview.readiness_pct) || 0),
  );
  return (
    <section className="panel overview-chart-panel">
      <div className="panel-head">
        <div>
          <h3>Review progress</h3>
          <p>Operational view inspired by public-service dashboards</p>
        </div>
        <Activity size={18} className="panel-head-icon" />
      </div>
      <div className="overview-chart-body">
        <div
          className="readiness-donut"
          style={
            { "--readiness": `${readiness * 3.6}deg` } as React.CSSProperties
          }
        >
          <div>
            <strong>{readiness}%</strong>
            <span>complete</span>
          </div>
        </div>
        <div className="status-bars">
          {rows.map((row) => (
            <div className="status-bar-row" key={row.label}>
              <div>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
              <div className="status-bar-track">
                <i
                  className={row.tone}
                  style={{
                    width: `${Math.min(100, (row.value / total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="chart-disclaimer">
        Completion shows evidence readiness, not legal safety or government
        verification.
      </p>
    </section>
  );
}
function PortfolioCommandCenter({
  overview,
  properties,
  onOpen,
}: {
  overview: any;
  properties: Property[];
  onOpen: (property: Property) => void;
}) {
  const total = Math.max(Number(overview.total) || 0, 1);
  const coverage = overview.portfolioCoverage || {};
  const districts = overview.districtDistribution || [];
  const maxDistrict = Math.max(
    ...districts.map((item: any) => Number(item.total) || 0),
    1,
  );
  const queue = overview.attentionQueue || [];
  const coverageItems = [
    {
      label: "Mapped properties",
      value: Number(coverage.mapped) || 0,
      isDocument: false,
    },
    {
      label: "Verified identity",
      value: Number(coverage.verified_identity) || 0,
      isDocument: false,
    },
    {
      label: "Complete boundaries",
      value: Number(coverage.complete_boundaries) || 0,
      isDocument: false,
    },
    {
      label: "Properties with evidence",
      value: Math.max(
        0,
        (Number(overview.total) || 0) -
          (Number(overview.missing_documents) || 0),
      ),
      isDocument: false,
    },
  ];
  return (
    <section className="portfolio-command">
      <div className="section-header">
        <div>
          <h2>Portfolio command center</h2>
          <p>
            Coverage, geographic distribution and the next records needing work
          </p>
        </div>
        <span className="result-count">
          {Number(overview.total) || 0} properties ·{" "}
          {Number(overview.documents) || 0} documents ·{" "}
          {Number(overview.findings) || 0} findings
        </span>
      </div>
      <div className="portfolio-command-grid">
        <div className="panel coverage-panel">
          <div className="panel-head">
            <div>
              <h3>Portfolio coverage</h3>
              <p>How much of the property register is review-ready</p>
            </div>
            <Gauge size={18} className="panel-head-icon" />
          </div>
          <div className="coverage-list">
            {coverageItems.map((item) => {
              const denominator = item.isDocument
                ? Math.max(Number(overview.total) || 0, 1)
                : total;
              const percentage = Math.min(
                100,
                Math.round((item.value / denominator) * 100),
              );
              return (
                <div className="coverage-row" key={item.label}>
                  <div>
                    <span>{item.label}</span>
                    <strong>
                      {item.value}
                      {item.isDocument
                        ? " files"
                        : ` / ${Number(overview.total) || 0}`}
                    </strong>
                  </div>
                  <div className="coverage-meter">
                    <i style={{ width: `${percentage}%` }} />
                  </div>
                  <small>{percentage}%</small>
                </div>
              );
            })}
          </div>
        </div>
        <div className="panel district-panel">
          <div className="panel-head">
            <div>
              <h3>Properties by district</h3>
              <p>Largest recorded geographic groups</p>
            </div>
            <MapIcon size={18} className="panel-head-icon" />
          </div>
          <div className="district-bars">
            {districts.length ? (
              districts.map((item: any) => (
                <div className="district-row" key={item.district}>
                  <span>{item.district}</span>
                  <div>
                    <i
                      style={{
                        width: `${Math.max(5, (Number(item.total) / maxDistrict) * 100)}%`,
                      }}
                    />
                  </div>
                  <strong>{item.total}</strong>
                </div>
              ))
            ) : (
              <p className="empty-inline">No district data recorded.</p>
            )}
          </div>
        </div>
        <div className="panel attention-panel">
          <div className="panel-head">
            <div>
              <h3>Attention queue</h3>
              <p>Properties with the most important evidence gaps</p>
            </div>
            <ShieldAlert size={18} className="panel-head-icon" />
          </div>
          {queue.length ? (
            <div className="attention-list">
              {queue.map((item: any) => {
                const property = properties.find(
                  (entry) => entry.id === item.id,
                );
                const issues = [
                  Number(item.disputed_identity) && "Disputed identity",
                  Number(item.missing_documents) && "No documents",
                  Number(item.missing_coordinates) && "No coordinates",
                  Number(item.missing_extent) && "Extent missing",
                ].filter(Boolean);
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (property) onOpen(property);
                    }}
                  >
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.village ||
                          item.district ||
                          "Location not recorded"}{" "}
                        · {propertyIdentityLabel(item)}
                      </span>
                    </div>
                    <div className="attention-tags">
                      {issues.map((issue) => (
                        <small key={String(issue)}>{issue}</small>
                      ))}
                    </div>
                    <ArrowUpRight size={15} />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No immediate evidence gaps"
              text="All current properties have the basic evidence fields checked by this overview."
            />
          )}
        </div>
      </div>
    </section>
  );
}
function ChecklistItem({
  icon,
  label,
  note,
  pending = false,
}: {
  icon: ReactNode;
  label: string;
  note: string;
  pending?: boolean;
}) {
  return (
    <div className="check-item">
      <div className={`check-icon ${pending ? "pending" : ""}`}>{icon}</div>
      <div>
        <strong>{label}</strong>
        <span>{note}</span>
      </div>
      {pending && <span className="pending-tag">REQUIRED</span>}
    </div>
  );
}
function StatusPill({ status }: { status: string }) {
  const tone =
    status === "ready_for_review"
      ? "green"
      : status === "archived"
        ? "grey"
        : "amber";
  return (
    <span className={`status-pill ${tone}`}>
      <i />
      {pretty(status)}
    </span>
  );
}
function EmptyState({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <FolderOpen size={24} />
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
      {action && onAction && (
        <button className="secondary-btn" onClick={onAction}>
          <Plus size={15} />
          {action}
        </button>
      )}
    </div>
  );
}

function PropertiesPage({
  properties,
  query,
  setQuery,
  loading,
  onCreate,
  onOpen,
  currentUser,
}: {
  properties: Property[];
  query: string;
  setQuery: (q: string) => void;
  loading: boolean;
  onCreate: () => void;
  onOpen: (p: Property) => void;
  currentUser: UserAccount;
}) {
  const isViewer = currentUser.role === "viewer";
  const canCreate = ![
    "lawyer",
    "analyst",
    "viewer",
    "operations",
    "consultant",
    "data_steward",
    "support",
  ].includes(currentUser.role);
  const [statusFilter, setStatusFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [sort, setSort] = useState("updated_desc");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const districts = Array.from(
    new Set(properties.map((p) => p.district).filter(Boolean)),
  ).sort();
  const filteredProperties = properties
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) => districtFilter === "all" || p.district === districtFilter)
    .sort((a, b) =>
      sort === "name_asc"
        ? a.name.localeCompare(b.name)
        : sort === "survey_asc"
          ? (a.survey_number || "").localeCompare(
              b.survey_number || "",
              undefined,
              { numeric: true },
            )
          : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredProperties.length / pageSize),
  );
  const safePage = Math.min(pageNumber, totalPages);
  const pageItems = filteredProperties.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setDistrictFilter("all");
    setSort("updated_desc");
    setPageNumber(1);
  };
  return (
    <>
      <section className="application-hero">
        <div className="application-hero-art">
          <div className="hero-building">
            <Building2 size={42} />
          </div>
          <div className="hero-pin">
            <MapPin size={20} />
          </div>
          <span>OJIX</span>
        </div>
        <div className="application-hero-copy">
          <div className="eyebrow">PROPERTY REVIEW SERVICES</div>
          <h1>Hello, {currentUser.name.split(" ")[0]}</h1>
          <h2>Welcome to Property Intelligence</h2>
          <p>
            Start a property review application and track its identity,
            documents, map context and legal findings.
          </p>
        </div>
        <button
          className="primary-btn application-start"
          onClick={onCreate}
          disabled={!canCreate}
          title={
            !canCreate
              ? "This role cannot create property applications"
              : "Start a new property application"
          }
        >
          <Plus size={17} />{" "}
          {canCreate ? "Start a new application" : "Creation restricted"}
        </button>
      </section>
      <nav
        className="application-tabs"
        aria-label="Property application filters"
      >
        <button
          className={statusFilter === "all" ? "active" : ""}
          onClick={() => {
            setStatusFilter("all");
            setPageNumber(1);
          }}
        >
          All applications <span>{properties.length}</span>
        </button>
        <button
          className={statusFilter === "in_review" ? "active" : ""}
          onClick={() => {
            setStatusFilter("in_review");
            setPageNumber(1);
          }}
        >
          In review{" "}
          <span>
            {properties.filter((p) => p.status === "in_review").length}
          </span>
        </button>
        <button
          className={statusFilter === "ready_for_review" ? "active" : ""}
          onClick={() => {
            setStatusFilter("ready_for_review");
            setPageNumber(1);
          }}
        >
          Ready for review{" "}
          <span>
            {properties.filter((p) => p.status === "ready_for_review").length}
          </span>
        </button>
        <button
          className={statusFilter === "complete" ? "active" : ""}
          onClick={() => {
            setStatusFilter("complete");
            setPageNumber(1);
          }}
        >
          Completed{" "}
          <span>
            {properties.filter((p) => p.status === "complete").length}
          </span>
        </button>
      </nav>
      <div className="panel application-register">
        <div className="application-register-head">
          <div>
            <span className="eyebrow">APPLICATION REGISTER</span>
            <h3>Previous applications</h3>
          </div>
          <div className="application-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPageNumber(1);
              }}
              placeholder="Search application number, property or survey"
              aria-label="Search applications"
            />
          </div>
        </div>
        <div className="application-filter-row">
          <label className="toolbar-select">
            <span>District</span>
            <select
              value={districtFilter}
              onChange={(e) => {
                setDistrictFilter(e.target.value);
                setPageNumber(1);
              }}
            >
              <option value="all">All districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="toolbar-select">
            <span>Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="updated_desc">Recently updated</option>
              <option value="name_asc">Property name</option>
              <option value="survey_asc">Survey number</option>
            </select>
          </label>
          <button className="secondary-btn" onClick={clearFilters}>
            <Filter size={15} /> Reset filters
          </button>
          <span className="application-result-count">
            {filteredProperties.length} application
            {filteredProperties.length === 1 ? "" : "s"}
          </span>
        </div>
        {loading ? (
          <div className="loading-state">
            <LoaderCircle className="spin" /> Loading property applications…
          </div>
        ) : filteredProperties.length === 0 ? (
          <EmptyState
            title="No matching applications"
            text={
              canCreate
                ? "Adjust the filters or start a new property review."
                : "No applications are currently assigned to this role. Adjust the filters or contact the workspace administrator."
            }
            action={canCreate ? "Start application" : undefined}
            onAction={canCreate ? onCreate : undefined}
          />
        ) : (
          <div className="application-table-wrap">
            <table className="application-table">
              <thead>
                <tr>
                  <th>SL. NO.</th>
                  <th>APPLICATION NUMBER</th>
                  <th>PROPERTY / LOCATION</th>
                  <th>DATE</th>
                  <th>APPLICATION TYPE</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p, index) => (
                  <tr key={p.id}>
                    <td>{(safePage - 1) * pageSize + index + 1}</td>
                    <td>
                      <strong className="application-number-cell">
                        {p.application_number || p.id.slice(0, 8).toUpperCase()}
                      </strong>
                      <small>{propertyIdentityLabel(p)}</small>
                    </td>
                    <td>
                      <strong>{p.name}</strong>
                      <small>
                        {[p.village, p.district].filter(Boolean).join(" · ") ||
                          "Location not recorded"}
                      </small>
                    </td>
                    <td>{dateLabel(p.updated_at)}</td>
                    <td>
                      <span className="application-type">
                        {p.property_type === "non_agricultural"
                          ? "Non-Agricultural"
                          : "Agricultural"}{" "}
                        property
                      </span>
                      <small>
                        {p.document_count || 0} document
                        {p.document_count === 1 ? "" : "s"}
                      </small>
                    </td>
                    <td>
                      <StatusPill status={p.status} />
                    </td>
                    <td>
                      <button
                        className="application-view"
                        onClick={() => onOpen(p)}
                      >
                        View application <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="application-table-footer">
          <span>
            Showing {pageItems.length ? (safePage - 1) * pageSize + 1 : 0}–
            {Math.min(safePage * pageSize, filteredProperties.length)} of{" "}
            {filteredProperties.length}
          </span>
          <div className="table-page-controls">
            <label>
              Items per page{" "}
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPageNumber(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            {filteredProperties.length > pageSize && (
              <div className="pagination compact">
                <button
                  className="secondary-btn"
                  disabled={safePage === 1}
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <div>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (n) => (
                      <button
                        key={n}
                        className={n === safePage ? "active" : ""}
                        onClick={() => setPageNumber(n)}
                      >
                        {n}
                      </button>
                    ),
                  )}
                </div>
                <button
                  className="secondary-btn"
                  disabled={safePage === totalPages}
                  onClick={() =>
                    setPageNumber((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function PropertyPage({
  property,
  docs,
  findings,
  riskSummary,
  busy,
  onAnalyze,
  onUpload,
  onReport,
  onPrint,
  onEdit,
  onWorkflowUpdated,
  onBack,
  onDocUpdated,
  currentUser,
}: {
  property: Property;
  docs: Doc[];
  findings: Finding[];
  riskSummary: any;
  busy: boolean;
  onAnalyze: () => Promise<boolean>;
  onUpload: (
    files: File[],
    metadata: Array<{
      documentType: string;
      customDocumentType: string;
      classificationConfidence: number;
      manualReview: boolean;
    }>,
  ) => Promise<Doc[]>;
  onReport: () => void;
  onPrint: () => void;
  onEdit: () => void;
  onWorkflowUpdated: (property: Property) => void;
  onBack: () => void;
  onDocUpdated?: (d: Doc) => void;
  currentUser: UserAccount;
}) {
  const isViewer = currentUser.role === "viewer";
  const isOperations = currentUser.role === "operations";
  const isConsultant = currentUser.role === "consultant";
  const isDataSteward = currentUser.role === "data_steward";
  const canEditProperty = ["owner", "admin", "lawyer", "analyst"].includes(
    currentUser.role,
  );
  const canUploadDocuments = [
    "owner",
    "admin",
    "lawyer",
    "analyst",
    "operations",
  ].includes(currentUser.role);
  const [tab, setTab] = useState<
    | "summary"
    | "parcels"
    | "documents"
    | "title-chain"
    | "map"
    | "discrepancies"
    | "report"
    | "findings"
  >("summary");
  const [reviewingDoc, setReviewingDoc] = useState<Doc | null>(null);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyFinding[]>([]);
  const [discRiskSummary, setDiscRiskSummary] = useState<any>(null);

  const loadDiscrepancies = useCallback(async () => {
    try {
      const data = await api<{
        discrepancies: DiscrepancyFinding[];
        riskSummary: any;
      }>(`/api/properties/${property.id}/discrepancies`);
      setDiscrepancies(data.discrepancies || []);
      setDiscRiskSummary(data.riskSummary || null);
    } catch {
      /* graceful fallback */
    }
  }, [property.id]);

  useEffect(() => {
    loadDiscrepancies();
  }, [loadDiscrepancies]);

  const runAutomaticReview = async () => {
    const completed = await onAnalyze();
    if (completed) {
      await loadDiscrepancies();
      setTab("findings");
    }
  };

  const handleReviewDiscrepancy = async (
    discId: string,
    status: "accepted" | "rejected" | "deferred",
    rationale: string,
  ) => {
    setDiscrepancies((prev) =>
      prev.map((d) =>
        d.id === discId ? { ...d, status, reviewRationale: rationale } : d,
      ),
    );
  };
  const requiredDetails = isOperations
    ? [
        {
          label: "Source documents",
          complete: docs.length > 0,
          target: "documents" as const,
        },
      ]
    : [
        {
          label:
            property.property_type === "agricultural"
              ? "Survey number"
              : "Property number",
          complete: Boolean(
            property.property_type === "agricultural"
              ? property.survey_number
              : property.property_identifier,
          ),
          target: "summary" as const,
        },
        {
          label: "Normalized extent",
          complete:
            property.extent_value !== null && Boolean(property.extent_unit),
          target: "summary" as const,
        },
        {
          label: "Map coordinates",
          complete: property.latitude !== null && property.longitude !== null,
          target: "map" as const,
        },
        {
          label: "Four-side boundaries",
          complete: Boolean(
            property.boundary_north &&
              property.boundary_south &&
              property.boundary_east &&
              property.boundary_west,
          ),
          target: "summary" as const,
        },
        {
          label: "Source documents",
          complete: docs.length > 0,
          target: "documents" as const,
        },
      ];
  const completedDetails = requiredDetails.filter(
    (item) => item.complete,
  ).length;
  const completeness = Math.round(
    (completedDetails / requiredDetails.length) * 100,
  );
  const nextRequired = requiredDetails.find((item) => !item.complete);

  if (isViewer)
    return (
      <>
        <div className="detail-back">
          <button className="text-btn" onClick={onBack}>
            <ArrowDownRight size={15} className="back-icon" /> Approved matters
          </button>
          <span>/</span>
          <span>Released report</span>
        </div>
        <div className="property-title-row">
          <div>
            <div className="eyebrow">CLIENT / RELEASED MATTER</div>
            <h1>{property.name}</h1>
            <p>
              <MapPin size={16} />
              {[property.village, property.taluk, property.district]
                .filter(Boolean)
                .join(" · ") || "Karnataka"}
            </p>
          </div>
          <span className="status-pill green">
            <Check size={12} /> Released
          </span>
        </div>
        <div className="property-summary-strip">
          <div className="summary-avatar">{initials(property.name)}</div>
          <div className="summary-meta application-number">
            <span>APPLICATION NUMBER</span>
            <strong className="mono">{property.application_number}</strong>
          </div>
          <div className="summary-meta">
            <span>PROPERTY TYPE</span>
            <strong>{pretty(property.property_type)}</strong>
          </div>
          <div className="summary-meta">
            <span>SURVEY / PROPERTY NUMBER</span>
            <strong>
              {property.property_type === "agricultural"
                ? [property.survey_number, property.subdivision]
                    .filter(Boolean)
                    .join(" / ") || "Not recorded"
                : property.property_identifier || "Not recorded"}
            </strong>
          </div>
          <div className="summary-meta">
            <span>EXTENT</span>
            <strong>{property.extent || "See approved report"}</strong>
          </div>
          <div className="summary-status">
            <StatusPill status={property.status} />
          </div>
        </div>
        <div className="tabs">
          <button
            className={tab === "summary" ? "selected" : ""}
            onClick={() => setTab("summary")}
          >
            <Gauge size={17} /> Shared Context
          </button>
          <button
            className={tab === "report" ? "selected" : ""}
            onClick={() => setTab("report")}
          >
            <FileText size={17} /> Approved Report
          </button>
        </div>
        {tab === "summary" && (
          <>
            <div className="client-notice">
              <ShieldCheck size={18} />
              <div>
                <strong>Released information only</strong>
                <p>
                  Internal evidence, reviewer notes, draft findings, source
                  configuration and working calculations are excluded from this
                  view.
                </p>
              </div>
            </div>
            <section className="panel recorded-facts">
              <div className="panel-head">
                <div>
                  <h3>Shared property context</h3>
                  <p>
                    Read-only identity information accompanying the released
                    professional report.
                  </p>
                </div>
                <span className="status-pill green">Approved output</span>
              </div>
              <div className="compact-facts">
                <InfoField
                  label="Application number"
                  value={property.application_number}
                />
                <InfoField
                  label="Property type"
                  value={pretty(property.property_type)}
                />
                <InfoField
                  label={
                    property.property_type === "agricultural"
                      ? "Survey / Hissa"
                      : property.property_identifier_type || "Property number"
                  }
                  value={
                    property.property_type === "agricultural"
                      ? [property.survey_number, property.subdivision]
                          .filter(Boolean)
                          .join(" / ")
                      : property.property_identifier
                  }
                />
                <InfoField
                  label="Location"
                  value={[
                    property.village,
                    property.hobli,
                    property.taluk,
                    property.district,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
                <InfoField label="Extent" value={property.extent} />
                <InfoField label="Address" value={property.address} />
              </div>
            </section>
            <div className="report-notice">
              <ShieldCheck size={17} />
              <span>
                This released report supports professional review but does not
                independently certify title, ownership, legality, encroachment
                status or transaction safety.
              </span>
            </div>
          </>
        )}
        {tab === "report" && (
          <ReportViewer property={property} apiUrl={API} readOnly />
        )}
      </>
    );

  if (isOperations)
    return (
      <>
        <div className="detail-back">
          <button className="text-btn" onClick={onBack}>
            <ArrowDownRight size={15} className="back-icon" /> Assigned
            applications
          </button>
          <span>/</span>
          <span>Document intake</span>
        </div>
        <div className="property-title-row">
          <div>
            <div className="eyebrow">OPERATIONS / DOCUMENT INTAKE</div>
            <h1>{property.name}</h1>
            <p>
              <MapPin size={16} />
              {[property.village, property.taluk, property.district]
                .filter(Boolean)
                .join(" · ") || "Karnataka"}
            </p>
          </div>
          <button
            className="primary-btn"
            onClick={() => setShowDocumentUpload(true)}
            disabled={busy}
          >
            <Upload size={16} /> Add documents
          </button>
        </div>
        <div className="property-summary-strip">
          <div className="summary-avatar">{initials(property.name)}</div>
          <div className="summary-meta application-number">
            <span>APPLICATION NUMBER</span>
            <strong className="mono">
              {property.application_number ||
                property.id.slice(0, 8).toUpperCase()}
            </strong>
          </div>
          <div className="summary-meta">
            <span>PROPERTY IDENTITY</span>
            <strong>
              {property.property_type === "agricultural"
                ? [property.survey_number, property.subdivision]
                    .filter(Boolean)
                    .join(" / ") || "Not recorded"
                : property.property_identifier || "Not recorded"}
            </strong>
          </div>
          <div className="summary-meta">
            <span>LOCATION</span>
            <strong>
              {[property.village, property.taluk, property.district]
                .filter(Boolean)
                .join(" · ") || "Not recorded"}
            </strong>
          </div>
          <div className="summary-meta">
            <span>UPLOADED FILES</span>
            <strong>{docs.length}</strong>
          </div>
          <div className="summary-status">
            <StatusPill status={property.status} />
          </div>
        </div>
        <div className="tabs">
          <button
            className={tab === "summary" ? "selected" : ""}
            onClick={() => setTab("summary")}
          >
            <Gauge size={17} /> Intake Summary
          </button>
          <button
            className={tab === "documents" ? "selected" : ""}
            onClick={() => setTab("documents")}
          >
            <FileText size={17} /> Documents <span>{docs.length}</span>
          </button>
        </div>
        {tab === "summary" && (
          <div className="overview-work-grid">
            <section className="panel recorded-facts">
              <div className="panel-head">
                <div>
                  <h3>Upload destination</h3>
                  <p>
                    Confirm this identity before attaching evidence. Operations
                    cannot change legal or property facts.
                  </p>
                </div>
                <span className="status-pill amber">Intake only</span>
              </div>
              <div className="compact-facts">
                <InfoField
                  label="Application number"
                  value={property.application_number}
                />
                <InfoField
                  label="Property type"
                  value={pretty(property.property_type)}
                />
                <InfoField
                  label={
                    property.property_type === "agricultural"
                      ? "Survey / Hissa"
                      : property.property_identifier_type || "Property number"
                  }
                  value={
                    property.property_type === "agricultural"
                      ? [property.survey_number, property.subdivision]
                          .filter(Boolean)
                          .join(" / ")
                      : property.property_identifier
                  }
                />
                <InfoField
                  label="Location"
                  value={[
                    property.village,
                    property.hobli,
                    property.taluk,
                    property.district,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              </div>
            </section>
            <aside className="panel missing-information">
              <div className="panel-head">
                <div>
                  <h3>Intake status</h3>
                  <p>Classify each file independently.</p>
                </div>
                <span className="completion-badge">{docs.length}</span>
              </div>
              <div className="required-list">
                <div className={docs.length ? "complete" : ""}>
                  <span>
                    {docs.length ? (
                      <Check size={14} />
                    ) : (
                      <AlertTriangle size={14} />
                    )}
                  </span>
                  <strong>Source documents</strong>
                  <small>{docs.length ? "Uploaded" : "Required"}</small>
                </div>
              </div>
              <button
                className="primary-btn full-btn"
                onClick={() => setTab("documents")}
              >
                {docs.length ? "Review documents" : "Add documents"}{" "}
                <ArrowUpRight size={14} />
              </button>
            </aside>
          </div>
        )}
        {tab === "documents" && (
          <div className="panel documents-panel">
            <div className="panel-head">
              <div>
                <h3>Source document intake</h3>
                <p>
                  Upload files to this assigned application and classify every
                  document separately.
                </p>
              </div>
              <button
                className="primary-btn"
                onClick={() => setShowDocumentUpload(true)}
              >
                <Upload size={15} /> Add documents
              </button>
            </div>
            {docs.length ? (
              <div className="document-list">
                {docs.map((d) => (
                  <div className="document-row" key={d.id}>
                    <div className="doc-icon">
                      <FileText size={18} />
                    </div>
                    <div className="doc-main">
                      <strong>{d.original_filename}</strong>
                      <span>
                        {d.mime_type} · {formatBytes(d.size_bytes)} · Added{" "}
                        {dateLabel(d.created_at)}
                      </span>
                    </div>
                    {d.doc_type && (
                      <span className={`doc-type-pill ${d.doc_type}`}>
                        {d.doc_type === "other" && d.doc_type_custom
                          ? d.doc_type_custom
                          : pretty(d.doc_type)}
                      </span>
                    )}
                    <span
                      className={`status-pill ${d.manual_review_status === "required" || d.processing_status === "manual_review" ? "amber" : "green"}`}
                    >
                      <i />
                      {d.manual_review_status === "required"
                        ? "Manual review"
                        : pretty(d.processing_status)}
                    </span>
                    <button
                      className="secondary-btn review-doc-btn"
                      onClick={() => setReviewingDoc(d)}
                    >
                      <Eye size={14} /> View
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No documents uploaded"
                text="Add the assigned source files and classify each document before handoff."
                action="Add documents"
                onAction={() => setShowDocumentUpload(true)}
              />
            )}
          </div>
        )}
        {reviewingDoc && (
          <SideBySideReview
            propertyId={property.id}
            propertyIdentity={property}
            doc={reviewingDoc as PropertyDoc}
            readOnly
          currentRole={currentUser.role}
            onClose={() => setReviewingDoc(null)}
            onDocumentUpdated={(updated) => {
              setReviewingDoc(updated as Doc);
              if (onDocUpdated) onDocUpdated(updated as Doc);
            }}
          />
        )}
        {showDocumentUpload && (
          <PropertyDocumentUpload
            property={property}
            busy={busy}
            onClose={() => setShowDocumentUpload(false)}
            onUpload={async (files, metadata) => {
              await onUpload(files, metadata);
              setShowDocumentUpload(false);
            }}
          />
        )}
      </>
    );

  return (
    <>
      <div className="detail-back">
        <button className="text-btn" onClick={onBack}>
          <ArrowDownRight size={15} className="back-icon" /> All properties
        </button>
        <span>/</span>
        <span>Property workspace</span>
      </div>
      <div className="property-title-row">
        <div>
          <div className="eyebrow">PROPERTY INTELLIGENCE / CASE FILE</div>
          <h1>{property.name}</h1>
          <p>
            <MapPin size={16} />
            {[property.village, property.taluk, property.district]
              .filter(Boolean)
              .join(" · ") || "Karnataka"}{" "}
            <span className="dot-sep">•</span>
            <span className="survey-badge-highlight">
              {propertyIdentityLabel(property)}
            </span>
          </p>
        </div>
        <div className="title-actions">
          {["owner", "admin"].includes(currentUser.role) && (
            <button
              className="secondary-btn workflow-btn"
              onClick={() => setShowWorkflow(true)}
              disabled={busy}
            >
              <UserCheck size={16} /> Assign review team
            </button>
          )}
          {canEditProperty && (
            <button
              className="secondary-btn edit-property-btn"
              onClick={onEdit}
              disabled={busy}
            >
              <Building2 size={16} /> Edit details
            </button>
          )}
          {!isOperations && !isConsultant && !isDataSteward && (
            <>
              <button
                className="secondary-btn"
                onClick={onReport}
                disabled={busy}
              >
                <Download size={16} /> Case data
              </button>
              <button
                className="secondary-btn"
                onClick={onPrint}
                disabled={busy}
              >
                <FileText size={16} /> Download report
              </button>
              <button
                className="primary-btn"
                onClick={runAutomaticReview}
                disabled={busy || isViewer}
                title={
                  isViewer
                    ? "Read-only role: Preliminary review disabled"
                    : "Run automatic review"
                }
              >
                <Sparkles size={17} />{" "}
                {isViewer ? "Review locked" : "Run automatic review"}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="property-summary-strip">
        <div className="summary-avatar">{initials(property.name)}</div>
        <div className="summary-meta application-number">
          <span>APPLICATION NUMBER</span>
          <strong className="mono">
            {property.application_number ||
              property.id.slice(0, 8).toUpperCase()}
          </strong>
        </div>
        <div className="summary-meta">
          <span>
            {property.property_type === "non_agricultural"
              ? property.property_identifier_type || "PROPERTY NUMBER"
              : "SURVEY / HISSA"}
          </span>
          <strong className="mono">{propertyIdentityLabel(property)}</strong>
        </div>
        <div className="summary-meta">
          <span>EXTENT</span>
          <strong>{property.extent || "Not recorded"}</strong>
        </div>
        <div className="summary-meta">
          <span>SOURCE DOCUMENTS</span>
          <strong>
            {docs.length} file{docs.length === 1 ? "" : "s"}
          </strong>
        </div>
        <div className="summary-status">
          <StatusPill status={property.status} />
        </div>
      </div>
      <div className="tabs">
        <button
          className={tab === "summary" ? "selected" : ""}
          onClick={() => setTab("summary")}
        >
          <Gauge size={17} /> Overview
        </button>
        {!isViewer && !isOperations && (
          <button
            className={tab === "parcels" ? "selected" : ""}
            onClick={() => setTab("parcels")}
          >
            <MapPin size={17} /> Parcels
          </button>
        )}
        {!isViewer && (
          <button
            className={tab === "documents" ? "selected" : ""}
            onClick={() => setTab("documents")}
          >
            <FileText size={17} /> Documents <span>{docs.length}</span>
          </button>
        )}
        {!isOperations && !isViewer && !isConsultant && !isDataSteward && (
          <>
            <button
              className={tab === "title-chain" ? "selected" : ""}
              onClick={() => setTab("title-chain")}
            >
              <GitMerge size={17} /> Title Chain
            </button>
            <button
              className={tab === "discrepancies" ? "selected" : ""}
              onClick={() => setTab("discrepancies")}
            >
              <Scale size={17} /> Issues{" "}
              {discrepancies.length > 0 && <span>{discrepancies.length}</span>}
            </button>
          </>
        )}
        {!isOperations && !isViewer && (
          <button
            className={tab === "map" ? "selected" : ""}
            onClick={() => setTab("map")}
          >
            <Layers3 size={17} /> Maps
          </button>
        )}
        {!isOperations && !isDataSteward && (
          <button
            className={tab === "findings" ? "selected" : ""}
            onClick={() => setTab("findings")}
          >
            <ShieldAlert size={17} /> Findings <span>{findings.length}</span>
          </button>
        )}
        {!isOperations && !isConsultant && !isDataSteward && (
          <button
            className={tab === "report" ? "selected" : ""}
            onClick={() => setTab("report")}
          >
            <FileText size={17} /> Report
          </button>
        )}
      </div>
      {tab === "parcels" && (
        <ParcelReferences
          property={property}
          readOnly={isViewer || isOperations || isConsultant || isDataSteward}
        />
      )}
      {tab === "summary" && (
        <div className="property-overview-v2">
          <div className="property-kpis">
            <div>
              <Gauge size={18} />
              <span>Evidence completeness</span>
              <strong>{completeness}%</strong>
            </div>
            <div>
              <FileText size={18} />
              <span>Documents</span>
              <strong>{docs.length}</strong>
            </div>
            <div>
              <ShieldAlert size={18} />
              <span>Open issues</span>
              <strong>{findings.length + discrepancies.length}</strong>
            </div>
            <div>
              <MapPin size={18} />
              <span>Map status</span>
              <strong>
                {property.latitude !== null && property.longitude !== null
                  ? "Recorded"
                  : "Missing"}
              </strong>
            </div>
          </div>
          <div className="overview-work-grid">
            <section className="panel recorded-facts">
              <div className="panel-head">
                <div>
                  <h3>Recorded property information</h3>
                  <p>
                    Only entered facts are shown. Verify them against primary
                    evidence.
                  </p>
                </div>
                <span
                  className={`status-pill ${property.identity_state === "verified" ? "green" : property.identity_state === "disputed" ? "red" : "amber"}`}
                >
                  {property.identity_state === "verified"
                    ? "Verified"
                    : property.identity_state === "disputed"
                      ? "Disputed"
                      : "Entered — not verified"}
                </span>
              </div>
              <div className="compact-facts">
                <InfoField
                  label="Application number"
                  value={property.application_number}
                />
                <InfoField
                  label="Property type"
                  value={pretty(property.property_type)}
                />
                {property.property_type === "agricultural" ? (
                  <InfoField
                    label="Survey / Hissa"
                    value={[property.survey_number, property.subdivision]
                      .filter(Boolean)
                      .join(" / ")}
                  />
                ) : (
                  <InfoField
                    label={
                      property.property_identifier_type || "Property number"
                    }
                    value={property.property_identifier}
                  />
                )}
                <InfoField
                  label="Location"
                  value={[
                    property.village,
                    property.hobli,
                    property.taluk,
                    property.district,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
                {property.extent && (
                  <InfoField label="Extent as stated" value={property.extent} />
                )}{" "}
                {property.address && (
                  <InfoField
                    label="Address / directions"
                    value={property.address}
                  />
                )}
              </div>
              {property.notes && (
                <div className="notes-block">
                  <span>WORKSPACE NOTES</span>
                  <p>{property.notes}</p>
                </div>
              )}
            </section>
            <aside className="panel missing-information">
              <div className="panel-head">
                <div>
                  <h3>Information required</h3>
                  <p>
                    {requiredDetails.length - completedDetails} items still need
                    attention
                  </p>
                </div>
                <span className="completion-badge">
                  {completedDetails}/{requiredDetails.length}
                </span>
              </div>
              <div className="required-list">
                {requiredDetails.map((item) => (
                  <div
                    className={item.complete ? "complete" : ""}
                    key={item.label}
                  >
                    <span>
                      {item.complete ? (
                        <Check size={14} />
                      ) : (
                        <AlertTriangle size={14} />
                      )}
                    </span>
                    <strong>{item.label}</strong>
                    <small>{item.complete ? "Recorded" : "Required"}</small>
                  </div>
                ))}
              </div>
              {nextRequired && (
                <button
                  className="primary-btn full-btn"
                  onClick={() => setTab(nextRequired.target)}
                >
                  {nextRequired.target === "documents"
                    ? "Add documents"
                    : nextRequired.target === "map"
                      ? "Add map location"
                      : "Complete property details"}{" "}
                  <ArrowUpRight size={14} />
                </button>
              )}
            </aside>
          </div>
          <section className="next-action-panel">
            <div>
              <Sparkles size={20} />
              <span>NEXT RECOMMENDED ACTION</span>
              <strong>
                {nextRequired
                  ? `${nextRequired.label} is still required`
                  : isOperations
                    ? "Document intake is complete"
                    : isConsultant
                      ? "Dossier evidence is available"
                      : isDataSteward
                        ? "Reference-data review is complete"
                        : "Core property information is complete"}
              </strong>
              <p>
                {nextRequired
                  ? "Complete the missing information before relying on the review output."
                  : isOperations
                    ? "Confirm the uploaded files and classification before handing the matter to the review team."
                    : isConsultant
                      ? "Review the recorded evidence and issues without changing reviewer-controlled conclusions."
                      : isDataSteward
                        ? "Review source provenance and ingestion metadata without making legal conclusions."
                        : "Run the preliminary review and resolve any evidence findings."}
              </p>
            </div>
            <button
              className="secondary-btn"
              onClick={
                nextRequired || isOperations || isConsultant || isDataSteward
                  ? () => setTab("documents")
                  : runAutomaticReview
              }
            >
              {nextRequired
                ? "Continue review"
                : isOperations
                  ? "Review documents"
                  : isConsultant
                    ? "View evidence"
                    : isDataSteward
                      ? "View ingestion metadata"
                      : "Run automatic review"}{" "}
              <ArrowUpRight size={14} />
            </button>
          </section>
          <section className="panel review-progress-panel">
            <div className="panel-head">
              <div>
                <h3>Review progress</h3>
                <p>Evidence workflow from intake to professional approval.</p>
              </div>
            </div>
            <div className="review-progress-steps">
              <span className="complete">
                <Check />
                Identity
              </span>
              <span className={docs.length ? "complete" : ""}>
                <FileText />
                Documents
              </span>
              <span className={property.latitude !== null ? "complete" : ""}>
                <MapPin />
                Map
              </span>
              <span className={findings.length ? "complete" : ""}>
                <ShieldAlert />
                Findings
              </span>
              <span>
                <BadgeCheck />
                Approval
              </span>
            </div>
          </section>
        </div>
      )}
      {tab === "summary" && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Complete property record</h3>
              <p>
                Identity facts as entered; evidence status is shown separately.
              </p>
            </div>
            <span
              className={`status-pill ${property.identity_state === "verified" ? "green" : property.identity_state === "disputed" ? "red" : "amber"}`}
            >
              {pretty(property.identity_state || "known")}
            </span>
          </div>
          <div className="identity-grid">
            <InfoField
              label="Application number"
              value={property.application_number}
            />
            {property.property_type === "agricultural" ? (
              <InfoField
                label="Survey / Hissa"
                value={[property.survey_number, property.subdivision]
                  .filter(Boolean)
                  .join(" / ")}
              />
            ) : (
              <InfoField
                label={property.property_identifier_type || "Property number"}
                value={property.property_identifier}
              />
            )}
            <InfoField
              label="Property type"
              value={pretty(property.property_type)}
            />
            <InfoField
              label="Normalized extent"
              value={
                property.extent_value
                  ? `${property.extent_value} ${pretty(property.extent_unit)}`
                  : ""
              }
            />
            <InfoField
              label="Coordinate source"
              value={property.coordinate_source}
            />
            <InfoField
              label="Coordinate confidence"
              value={
                property.coordinate_confidence !== null
                  ? `${property.coordinate_confidence}%`
                  : ""
              }
            />
            <InfoField
              label="Coordinate captured"
              value={
                property.coordinate_captured_at
                  ? dateLabel(property.coordinate_captured_at)
                  : ""
              }
            />
            <InfoField label="North boundary" value={property.boundary_north} />
            <InfoField label="South boundary" value={property.boundary_south} />
            <InfoField label="East boundary" value={property.boundary_east} />
            <InfoField label="West boundary" value={property.boundary_west} />
          </div>
        </section>
      )}
      {tab === "summary" && (
        <div className="detail-grid">
          <div className="detail-main-col">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Property identity</h3>
                  <p>
                    Entered property details. Verify against primary documents.
                  </p>
                </div>
                <Building2 size={18} className="panel-head-icon" />
              </div>
              <div className="identity-grid">
                <InfoField
                  label="Property / project name"
                  value={property.name}
                />
                <InfoField
                  label="Survey number / subdivision"
                  value={[property.survey_number, property.subdivision]
                    .filter(Boolean)
                    .join(" / ")}
                />
                <InfoField label="Village" value={property.village} />
                <InfoField label="Hobli" value={property.hobli} />
                <InfoField label="Taluk" value={property.taluk} />
                <InfoField label="District" value={property.district} />
                <InfoField label="Extent" value={property.extent} />
                <InfoField
                  label="Address / directions"
                  value={property.address}
                />
              </div>
              {property.notes && (
                <div className="notes-block">
                  <span>WORKSPACE NOTES</span>
                  <p>{property.notes}</p>
                </div>
              )}
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Evidence readiness</h3>
                  <p>
                    Missing evidence is a workflow task, not proof of a defect.
                  </p>
                </div>
                <button
                  className="text-btn"
                  onClick={() => setTab("documents")}
                >
                  Manage documents <ArrowUpRight size={14} />
                </button>
              </div>
              <div className="evidence-rows">
                <EvidenceRow
                  icon={<FileCheck2 size={17} />}
                  label="Source documents"
                  detail={
                    docs.length
                      ? `${docs.length} file(s) uploaded`
                      : "No documents uploaded"
                  }
                  complete={docs.length > 0}
                />
                <EvidenceRow
                  icon={<MapPin size={17} />}
                  label="Map location"
                  detail={
                    property.latitude !== null && property.longitude !== null
                      ? `${property.latitude}, ${property.longitude}`
                      : "Coordinates not recorded"
                  }
                  complete={
                    property.latitude !== null && property.longitude !== null
                  }
                />
                <EvidenceRow
                  icon={<ShieldCheck size={17} />}
                  label="Professional review"
                  detail="Required before relying on conclusions"
                  complete={false}
                />
              </div>
            </section>
          </div>
          <div className="detail-side-col">
            <section className="panel risk-card">
              <div className="panel-head">
                <div>
                  <h3>Preliminary screening</h3>
                  <p>Completeness and imported-layer checks</p>
                </div>
                <div className="metric-icon amber">
                  <Gauge size={18} />
                </div>
              </div>
              {riskSummary ? (
                <>
                  <div className="risk-score">
                    <div
                      className={`score-circle ${riskSummary.score >= 70 ? "high" : riskSummary.score >= 35 ? "medium" : "low"}`}
                    >
                      <strong>{riskSummary.score}</strong>
                      <span>/ 100</span>
                    </div>
                    <div>
                      <span className="risk-label">SCREENING BAND</span>
                      <strong className="risk-band">
                        {pretty(riskSummary.band)}
                      </strong>
                      <p>{riskSummary.findingCount} findings generated</p>
                    </div>
                  </div>
                  <div className="risk-legend">
                    <span>
                      <i className="legend-red" /> High attention
                    </span>
                    <span>
                      <i className="legend-amber" /> Review required
                    </span>
                    <span>
                      <i className="legend-green" /> Preliminary
                    </span>
                  </div>
                  <p className="small-disclaimer">{riskSummary.disclaimer}</p>
                </>
              ) : (
                <div className="screening-empty">
                  <div className="screening-art">
                    <ShieldCheck size={27} />
                    <Sparkles size={14} />
                  </div>
                  <strong>No screening run yet</strong>
                  <p>
                    Run the initial checks to identify missing identity fields,
                    source documents and map coordinates.
                  </p>
                  <button
                    className="primary-btn full-btn"
                    onClick={onAnalyze}
                    disabled={busy || isViewer}
                    style={
                      isViewer ? { opacity: 0.6, cursor: "not-allowed" } : {}
                    }
                  >
                    <Sparkles size={15} />{" "}
                    {isViewer
                      ? "Screening (Locked)"
                      : "Run preliminary screening"}
                  </button>
                </div>
              )}
            </section>
            <section className="panel source-panel">
              <div className="panel-head">
                <div>
                  <h3>Data source status</h3>
                  <p>Integration readiness</p>
                </div>
                <ExternalLink size={16} className="panel-head-icon" />
              </div>
              <SourceStatus
                label="Government record lookups"
                status="Not connected"
                tone="grey"
              />
              <SourceStatus
                label="Imported spatial datasets"
                status="Demo only"
                tone="amber"
              />
              <SourceStatus
                label="Document OCR"
                status="Kannada + English active"
                tone="green"
              />
              <SourceStatus
                label="AI extraction"
                status="Rule-based extraction active"
                tone="green"
              />
            </section>
          </div>
        </div>
      )}
      {tab === "documents" && (
        <>
          {property.property_type === "agricultural" &&
            ["owner", "admin"].includes(currentUser.role) && (
              <RtcAssistedImport
                property={property}
                docs={docs}
                busy={busy}
                onUpload={onUpload}
                onReview={setReviewingDoc}
              />
            )}
          <div className="panel documents-panel">
            <div className="panel-head">
              <div>
                <h3>Source documents</h3>
                <p>
                  Original files, classifications, checksums and processing
                  status with side-by-side verification review.
                </p>
              </div>
              {canUploadDocuments ? (
                <button
                  className="primary-btn"
                  onClick={() => setShowDocumentUpload(true)}
                >
                  <Upload size={15} /> Add documents
                </button>
              ) : (
                <span className="status-pill grey">
                  Uploads locked for this role
                </span>
              )}
            </div>
            {docs.length > 0 ? (
              <div className="document-list">
                {docs.map((d) => (
                  <div className="document-row" key={d.id}>
                    <div className="doc-icon">
                      <FileText size={18} />
                    </div>
                    <div className="doc-main">
                      <strong>{d.original_filename}</strong>
                      <span>
                        {d.mime_type} · {formatBytes(d.size_bytes)} · Added{" "}
                        {dateLabel(d.created_at)}
                      </span>
                      {d.classification_confidence != null && (
                        <small>
                          Classification confidence:{" "}
                          {Math.round(
                            Number(d.classification_confidence) * 100,
                          )}
                          % ·{" "}
                          {d.classification_source === "manual"
                            ? "Manually classified"
                            : "Automatically classified"}
                        </small>
                      )}
                    </div>
                    {d.doc_type && (
                      <span className={`doc-type-pill ${d.doc_type}`}>
                        {d.doc_type === "other" && d.doc_type_custom
                          ? d.doc_type_custom
                          : pretty(d.doc_type)}
                      </span>
                    )}
                    <span
                      className={`status-pill ${d.manual_review_status === "required" || d.processing_status === "manual_review" ? "amber" : "green"}`}
                    >
                      <i />
                      {d.manual_review_status === "required"
                        ? "Manual review"
                        : pretty(d.processing_status)}
                    </span>
                    <span
                      className="checksum"
                      title={d.sha256 || "SHA-256 checksum"}
                    >
                      SHA-256 recorded
                    </span>
                    <button
                      className="secondary-btn review-doc-btn"
                      onClick={() => setReviewingDoc(d)}
                    >
                      <Eye size={14} /> Review Document
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No documents uploaded"
                text={
                  canUploadDocuments
                    ? "Upload and independently classify sale deeds, RTC, EC, khata, survey sketches or other evidence."
                    : "No source documents have been added to this application."
                }
                action={canUploadDocuments ? "Add documents" : undefined}
                onAction={
                  canUploadDocuments
                    ? () => setShowDocumentUpload(true)
                    : undefined
                }
              />
            )}
            <p className="data-warning">
              <AlertTriangle size={15} /> Demo environment: documents and OCR
              results remain on this computer. Use sample files only. Configure
              encrypted private storage before production use.
            </p>
          </div>
        </>
      )}

      {tab === "title-chain" && <TitleChainTimeline propertyId={property.id} />}
      {tab === "map" && (
        <MapViewer
          property={property}
          readOnly={isConsultant || isDataSteward}
          onGeometryUpdated={() => onAnalyze()}
        />
      )}
      {tab === "discrepancies" && (
        <DiscrepancyMatrix
          propertyId={property.id}
          discrepancies={discrepancies}
          riskSummary={discRiskSummary}
          onRefresh={loadDiscrepancies}
          onReview={handleReviewDiscrepancy}
        />
      )}
      {tab === "report" && (
        <ReportViewer
          property={property}
          apiUrl={API}
          onSnapshotCreated={() => {
            loadDiscrepancies();
            onAnalyze();
          }}
        />
      )}
      {tab === "findings" && (
        <div className="panel findings-panel">
          <div className="panel-head">
            <div>
              <h3>Review findings</h3>
              <p>
                Each finding includes its evidence status and recommended next
                action.
              </p>
            </div>
            <button className="primary-btn" onClick={onAnalyze} disabled={busy}>
              <Sparkles size={15} /> Re-run screening
            </button>
          </div>
          {findings.length === 0 ? (
            <EmptyState
              title="No findings yet"
              text="Run preliminary screening to check missing identity fields, documents and map location."
              action="Run screening"
              onAction={onAnalyze}
            />
          ) : (
            <div className="finding-list">
              {findings.map((f, i) => (
                <div className="finding-row" key={`${f.code}-${i}`}>
                  <div className={`finding-icon ${f.severity}`}>
                    <AlertTriangle size={17} />
                  </div>
                  <div className="finding-body">
                    <div className="finding-title-row">
                      <strong>{f.title}</strong>
                      <span className={`severity ${f.severity}`}>
                        {pretty(f.severity)}
                      </span>
                      <span className={`evidence-status ${f.evidence_status}`}>
                        {pretty(f.evidence_status)} evidence
                      </span>
                    </div>
                    <p>{f.explanation}</p>
                    <div className="next-action">
                      <span>NEXT ACTION</span>
                      {f.next_action}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="report-notice">
            <ShieldCheck size={17} />
            <span>
              Findings are preliminary prompts for investigation, not
              determinations of ownership, illegality, encroachment, or
              transaction safety.
            </span>
          </div>
        </div>
      )}
      {reviewingDoc && (
        <SideBySideReview
          propertyId={property.id}
          propertyIdentity={property}
          doc={reviewingDoc as PropertyDoc}
          readOnly={!['analyst','operations'].includes(currentUser.role)}
          currentRole={currentUser.role}
          onClose={() => setReviewingDoc(null)}
          onDocumentUpdated={(updated) => {
            setReviewingDoc(updated as Doc);
            if (onDocUpdated) onDocUpdated(updated as Doc);
          }}
        />
      )}
      {showDocumentUpload && (
        <PropertyDocumentUpload
          property={property}
          busy={busy}
          onClose={() => setShowDocumentUpload(false)}
          onUpload={async (files, metadata) => {
            await onUpload(files, metadata);
            setShowDocumentUpload(false);
          }}
        />
      )}
      {showWorkflow && (
        <PropertyWorkflowModal
          property={property}
          onClose={() => setShowWorkflow(false)}
          onSaved={(item) => {
            onWorkflowUpdated(item);
            setShowWorkflow(false);
          }}
        />
      )}
    </>
  );
}

function PropertyWorkflowModal({
  property,
  onClose,
  onSaved,
}: {
  property: Property;
  onClose: () => void;
  onSaved: (property: Property) => void;
}) {
  type Member = { uid: string; email: string; role: string; name: string };
  type History = {
    id: string;
    previous_status: string;
    new_status: string;
    reason: string;
    changed_by_uid: string;
    created_at: string;
  };
  const [members, setMembers] = useState<Member[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [form, setForm] = useState({
    status: property.status || "in_review",
    priority: property.workflow_priority || "normal",
    dueDate: property.due_date ? String(property.due_date).slice(0, 10) : "",
    assignedLawyerUid: property.assigned_lawyer_uid || "",
    assignedAnalystUid: property.assigned_analyst_uid || "",
    assignedOperationsUid: property.assigned_operations_uid || "",
    reason: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<{ item: any; members: Member[]; history: History[] }>(
      `/api/properties/${property.id}/workflow`,
    )
      .then((result) => {
        if (!active) return;
        setMembers(result.members);
        setHistory(result.history);
      })
      .catch((err) => active && setError((err as Error).message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [property.id]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await api<{ item: Property }>(
        `/api/properties/${property.id}/workflow`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      onSaved(result.item);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const options = (role: string) =>
    members.filter((member) => member.role === role);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="modal workflow-modal">
        <div className="modal-header">
          <div>
            <div className="eyebrow">OWNER WORKFLOW CONTROL</div>
            <h2>Status and team assignment</h2>
            <p>
              {property.application_number} · Changes require a reason and are
              written to the audit history.
            </p>
          </div>
          <button className="icon-btn" disabled={saving} onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {loading ? (
          <div className="loading-state">
            <LoaderCircle className="spin" /> Loading workflow…
          </div>
        ) : (
          <form onSubmit={save}>
            <div className="workflow-current">
              <StatusPill status={property.status} />
              <span>
                Priority:{" "}
                <strong>
                  {pretty(property.workflow_priority || "normal")}
                </strong>
              </span>
              {property.due_date && (
                <span>
                  Due: <strong>{dateLabel(property.due_date)}</strong>
                </span>
              )}
            </div>
            <div className="form-grid">
              <div className="form-section-heading">
                <span>Application workflow</span>
                <small>
                  Move the matter through intake, review, approval and closure.
                </small>
              </div>
              <label className="form-field">
                <span>
                  Status <b>*</b>
                </span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="documents_pending">Documents Pending</option>
                  <option value="in_review">Under Review</option>
                  <option value="clarification_required">
                    Clarification Required
                  </option>
                  <option value="ready_for_review">Ready for Approval</option>
                  <option value="approved">Approved</option>
                  <option value="complete">Released / Complete</option>
                  <option value="closed">Closed</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="form-field">
                <span>
                  Priority <b>*</b>
                </span>
                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="form-field">
                <span>Due date</span>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dueDate: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="form-section-heading">
                <span>Assigned team</span>
                <small>
                  Only members with the matching workspace role can be selected.
                </small>
              </div>
              <label className="form-field">
                <span>Lead lawyer</span>
                <select
                  value={form.assignedLawyerUid}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      assignedLawyerUid: event.target.value,
                    }))
                  }
                >
                  <option value="">Unassigned</option>
                  {options("lawyer").map((member) => (
                    <option value={member.uid} key={member.uid}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Analyst</span>
                <select
                  value={form.assignedAnalystUid}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      assignedAnalystUid: event.target.value,
                    }))
                  }
                >
                  <option value="">Unassigned</option>
                  {options("analyst").map((member) => (
                    <option value={member.uid} key={member.uid}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Operations</span>
                <select
                  value={form.assignedOperationsUid}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      assignedOperationsUid: event.target.value,
                    }))
                  }
                >
                  <option value="">Unassigned</option>
                  {options("operations").map((member) => (
                    <option value={member.uid} key={member.uid}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field span-2">
                <span>
                  Reason for change <b>*</b>
                </span>
                <textarea
                  required
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  value={form.reason}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="Explain the status, priority, due-date or assignment change."
                />
              </label>
            </div>
            {error && (
              <p className="data-warning">
                <AlertTriangle size={15} />
                {error}
              </p>
            )}
            {history.length > 0 && (
              <div className="workflow-history">
                <strong>Recent workflow history</strong>
                {history.slice(0, 5).map((item) => (
                  <div key={item.id}>
                    <span>
                      <b>{pretty(item.previous_status)}</b> →{" "}
                      <b>{pretty(item.new_status)}</b>
                    </span>
                    <small>
                      {item.reason} · {dateLabel(item.created_at)}
                    </small>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                disabled={saving}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="primary-btn"
                disabled={saving || form.reason.trim().length < 3}
              >
                {saving ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Check size={15} />
                )}{" "}
                {saving ? "Saving…" : "Save workflow"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function RtcAssistedImport({
  property,
  docs,
  busy,
  onUpload,
  onReview,
}: {
  property: Property;
  docs: Doc[];
  busy: boolean;
  onUpload: (
    files: File[],
    metadata: Array<{
      documentType: string;
      customDocumentType: string;
      classificationConfidence: number;
      manualReview: boolean;
    }>,
  ) => Promise<Doc[]>;
  onReview: (doc: Doc) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const rtcDocument = docs.find((doc) => doc.doc_type === "rtc_pahani");
  const schedule = rtcDocument?.extracted_fields?.propertySchedule;
  const clean = (value: unknown) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/\b(hobli|taluk|district)\b/g, "")
      .replace(/[^a-z0-9\u0C80-\u0CFF]/g, "");
  const comparison = (label: string, recorded: unknown, rtc: unknown) => {
    const rtcValue = String(rtc ?? "").trim();
    const unavailable = !rtcValue || /^not recorded$/i.test(rtcValue);
    const matches = !unavailable && clean(recorded) === clean(rtcValue);
    return (
      <div className="rtc-comparison-row">
        <span>{label}</span>
        <div>
          <small>OJIX record</small>
          <strong>{String(recorded || "Not recorded")}</strong>
        </div>
        <div>
          <small>Imported RTC</small>
          <strong>{unavailable ? "Needs manual review" : rtcValue}</strong>
        </div>
        <em className={unavailable ? "review" : matches ? "match" : "mismatch"}>
          {unavailable ? "Review" : matches ? "Match" : "Mismatch"}
        </em>
      </div>
    );
  };
  const uploadRtc = async (file: File) => {
    setError("");
    const supported =
      ["application/pdf", "image/jpeg", "image/png", "image/tiff"].includes(
        file.type,
      ) || /\.(pdf|jpe?g|png|tiff?)$/i.test(file.name);
    if (!supported) {
      setError("Upload the downloaded RTC as PDF, JPEG, PNG or TIFF.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("The RTC file must be 25 MB or smaller.");
      return;
    }
    const uploaded = await onUpload(
      [file],
      [
        {
          documentType: "rtc_pahani",
          customDocumentType: "",
          classificationConfidence: 1,
          manualReview: true,
        },
      ],
    );
    if (uploaded[0]) onReview(uploaded[0]);
  };
  return (
    <section className="panel rtc-assisted-import">
      <div className="panel-head">
        <div>
          <div className="eyebrow">ASSISTED GOVERNMENT RECORD IMPORT</div>
          <h3>RTC / Pahani verification</h3>
          <p>
            Retrieve the record yourself from Bhoomi, then import it as
            evidence. OJIX does not bypass CAPTCHA, login or payment controls.
          </p>
        </div>
        <span className="status-pill amber">Verification required</span>
      </div>
      <div className="rtc-identity-strip">
        <div>
          <small>District</small>
          <strong>{property.district || "—"}</strong>
        </div>
        <div>
          <small>Taluk</small>
          <strong>{property.taluk || "—"}</strong>
        </div>
        <div>
          <small>Hobli</small>
          <strong>{property.hobli || "—"}</strong>
        </div>
        <div>
          <small>Village</small>
          <strong>{property.village || "—"}</strong>
        </div>
        <div>
          <small>Survey / Hissa</small>
          <strong>
            {[property.survey_number, property.subdivision]
              .filter(Boolean)
              .join(" / ") || "—"}
          </strong>
        </div>
      </div>
      <div className="rtc-import-actions">
        <a
          className="secondary-btn"
          href="https://landrecords.karnataka.gov.in/Service2/"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={15} /> Open official View RTC & MR
        </a>
        <button
          className="primary-btn"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={15} />{" "}
          {rtcDocument ? "Upload newer RTC" : "Upload downloaded RTC"}
        </button>
        <input
          ref={inputRef}
          className="rtc-file-input"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/tiff,.pdf,.jpg,.jpeg,.png,.tif,.tiff"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadRtc(file);
            event.currentTarget.value = "";
          }}
        />
      </div>
      {error && (
        <p className="data-warning">
          <AlertTriangle size={15} />
          {error}
        </p>
      )}
      {rtcDocument && (
        <div className="rtc-import-result">
          <div className="rtc-result-head">
            <div>
              <Check size={16} />
              <span>
                <strong>RTC stored as source evidence</strong>
                <small>
                  {rtcDocument.original_filename} · SHA-256 recorded · imported{" "}
                  {dateLabel(rtcDocument.created_at)}
                </small>
              </span>
            </div>
            <button className="text-btn" onClick={() => onReview(rtcDocument)}>
              Open side-by-side review <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="rtc-comparison-table">
            {comparison(
              "Survey number",
              property.survey_number,
              schedule?.surveyNumber,
            )}
            {comparison(
              "Hissa / subdivision",
              property.subdivision,
              schedule?.subdivisionHissa,
            )}
            {comparison("Village", property.village, schedule?.village)}
            {comparison("Hobli", property.hobli, schedule?.hobli)}
            {comparison("Taluk", property.taluk, schedule?.taluk)}
            {comparison("District", property.district, schedule?.district)}
            {comparison("Extent", property.extent, schedule?.extent?.rawText)}
          </div>
          <p className="rtc-review-note">
            <ShieldCheck size={15} /> Imported and extracted values remain
            unverified until a reviewer checks the original RTC and confirms any
            differences.
          </p>
        </div>
      )}
    </section>
  );
}

function PropertyDocumentUpload({
  property,
  busy,
  onClose,
  onUpload,
}: {
  property: Property;
  busy: boolean;
  onClose: () => void;
  onUpload: (
    files: File[],
    metadata: Array<{
      documentType: string;
      customDocumentType: string;
      classificationConfidence: number;
      manualReview: boolean;
    }>,
  ) => Promise<void>;
}) {
  type FileMeta = {
    documentType: string;
    customDocumentType: string;
    classificationConfidence: string;
    manualReview: boolean;
  };
  const defaultType = property.primary_document_type || "";
  const [files, setFiles] = useState<File[]>([]);
  const [metadata, setMetadata] = useState<Record<string, FileMeta>>({});
  const [error, setError] = useState("");
  const key = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;
  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const supported = incoming.filter(
      (file) =>
        ["application/pdf", "image/jpeg", "image/png", "image/tiff"].includes(
          file.type,
        ) || /\.(pdf|jpe?g|png|tiff?)$/i.test(file.name),
    );
    if (supported.length !== incoming.length) {
      setError("Only PDF, JPEG, PNG and TIFF files are accepted.");
      return;
    }
    if (supported.some((file) => file.size > 25 * 1024 * 1024)) {
      setError("Each document must be 25 MB or smaller.");
      return;
    }
    setFiles((current) => {
      const known = new Set(current.map(key));
      const unique = supported.filter((file) => !known.has(key(file)));
      const combined = [...current, ...unique];
      if (combined.length > 10) {
        setError("A maximum of 10 documents can be uploaded in one batch.");
        return combined.slice(0, 10);
      }
      setMetadata((currentMeta) => {
        const next = { ...currentMeta };
        unique.forEach((file) => {
          next[key(file)] = {
            documentType: defaultType,
            customDocumentType: "",
            classificationConfidence: defaultType ? "100" : "",
            manualReview: false,
          };
        });
        return next;
      });
      setError("");
      return combined;
    });
  };
  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const entries = files.map((file) => metadata[key(file)]);
    if (!files.length) {
      setError("Choose at least one document.");
      return;
    }
    if (entries.some((item) => !item?.documentType)) {
      setError("Select a document type for every file.");
      return;
    }
    if (
      entries.some(
        (item) =>
          item.documentType === "other" && !item.customDocumentType.trim(),
      )
    ) {
      setError("Enter a custom name for every Other document type.");
      return;
    }
    if (
      entries.some(
        (item) =>
          item.classificationConfidence === "" ||
          Number(item.classificationConfidence) < 0 ||
          Number(item.classificationConfidence) > 100,
      )
    ) {
      setError("Confidence must be between 0 and 100 for every file.");
      return;
    }
    await onUpload(
      files,
      entries.map((item) => ({
        ...item,
        classificationConfidence: Number(item.classificationConfidence) / 100,
      })),
    );
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal document-upload-modal">
        <div className="modal-header">
          <div>
            <div className="eyebrow">PROPERTY EVIDENCE</div>
            <h2>Add and classify documents</h2>
            <p>
              Application {property.application_number} · Classify every source
              independently before upload.
            </p>
          </div>
          <button className="icon-btn" disabled={busy} onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <form onSubmit={submit}>
          <label
            className="intake-dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
          >
            <CloudUpload size={31} />
            <strong>Choose or drag documents here</strong>
            <span>
              PDF, JPG, PNG or TIFF · maximum 25 MB each · up to 10 files
            </span>
            <input
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/tiff,.pdf,.jpg,.jpeg,.png,.tif,.tiff"
              onChange={(event) => {
                addFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {files.length > 0 && (
            <div className="intake-file-list classified property-document-staging">
              {files.map((file) => {
                const fileKey = key(file);
                const meta = metadata[fileKey] || {
                  documentType: defaultType,
                  customDocumentType: "",
                  classificationConfidence: "",
                  manualReview: false,
                };
                const update = (values: Partial<FileMeta>) =>
                  setMetadata((current) => ({
                    ...current,
                    [fileKey]: { ...meta, ...values },
                  }));
                return (
                  <div key={fileKey}>
                    <FileText size={16} />
                    <span>
                      <strong>{file.name}</strong>
                      <small>{formatBytes(file.size)}</small>
                    </span>
                    <select
                      required
                      aria-label={`Document type for ${file.name}`}
                      value={meta.documentType}
                      onChange={(event) =>
                        update({
                          documentType: event.target.value,
                          customDocumentType:
                            event.target.value === "other"
                              ? meta.customDocumentType
                              : "",
                        })
                      }
                    >
                      <option value="">Select document type</option>
                      {DOCUMENT_TYPE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {meta.documentType === "other" && (
                      <input
                        required
                        value={meta.customDocumentType}
                        onChange={(event) =>
                          update({ customDocumentType: event.target.value })
                        }
                        placeholder="Custom document type"
                      />
                    )}
                    <label className="confidence-field">
                      Confidence{" "}
                      <input
                        required
                        type="number"
                        min="0"
                        max="100"
                        value={meta.classificationConfidence}
                        onChange={(event) =>
                          update({
                            classificationConfidence: event.target.value,
                          })
                        }
                      />
                      <span>%</span>
                    </label>
                    <label className="manual-review-check">
                      <input
                        type="checkbox"
                        checked={meta.manualReview}
                        onChange={(event) =>
                          update({ manualReview: event.target.checked })
                        }
                      />{" "}
                      Manual review
                    </label>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        setFiles((current) =>
                          current.filter((item) => key(item) !== fileKey),
                        );
                        setMetadata((current) => {
                          const next = { ...current };
                          delete next[fileKey];
                          return next;
                        });
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {error && (
            <p className="data-warning">
              <AlertTriangle size={15} />
              {error}
            </p>
          )}
          <div className="form-note">
            <ShieldCheck size={16} />
            <span>
              Classification describes the supplied evidence; it does not verify
              ownership, authenticity or legal effect.
            </span>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-btn"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="primary-btn" disabled={busy || !files.length}>
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Upload size={15} />
              )}{" "}
              {busy
                ? "Uploading…"
                : `Upload ${files.length || ""} document${files.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ParcelReferences({
  property,
  readOnly,
}: {
  property: Property;
  readOnly: boolean;
}) {
  const emptyForm = () => ({
    district: property.district || "",
    taluk: property.taluk || "",
    hobli: property.hobli || "",
    village: property.village || "",
    surveyNumber: "",
    subdivision: "",
    extentRaw: "",
    extentValue: "",
    extentUnit: "",
    sourceDescription: "",
    factState: "known",
    notes: "",
  });
  const [items, setItems] = useState<ParcelReference[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ items: ParcelReference[] }>(
        `/api/properties/${property.id}/parcels`,
      );
      setItems(data.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [property.id]);
  useEffect(() => {
    load();
  }, [load]);
  const change = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (Boolean(form.extentValue.trim()) !== Boolean(form.extentUnit)) {
      setError("Enter both parcel extent value and extent unit.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api(`/api/properties/${property.id}/parcels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          extentValue: form.extentValue.trim()
            ? Number(form.extentValue)
            : null,
        }),
      });
      setForm(emptyForm());
      setShowForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (item: ParcelReference) => {
    if (
      !window.confirm(
        `Remove survey ${item.survey_number}${item.subdivision ? `/${item.subdivision}` : ""} from this dossier?`,
      )
    )
      return;
    setError("");
    try {
      await api(`/api/properties/${property.id}/parcels/${item.id}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>Parcel and survey references</h3>
          <p>
            One property dossier may contain several linked surveys or
            subdivisions. Each remains separately traceable.
          </p>
        </div>
        <button
          className="primary-btn"
          disabled={readOnly}
          onClick={() => setShowForm((value) => !value)}
        >
          <Plus size={15} /> Add parcel
        </button>
      </div>
      {error && (
        <p className="data-warning">
          <AlertTriangle size={15} />
          {error}
        </p>
      )}
      {showForm && (
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="form-field">
              <span>
                Village <b>*</b>
              </span>
              <input
                required
                value={form.village}
                onChange={(e) => change("village", e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>
                Survey number <b>*</b>
              </span>
              <input
                required
                value={form.surveyNumber}
                onChange={(e) => change("surveyNumber", e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Hissa / subdivision</span>
              <input
                value={form.subdivision}
                onChange={(e) => change("subdivision", e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Extent as stated</span>
              <input
                value={form.extentRaw}
                onChange={(e) => change("extentRaw", e.target.value)}
                placeholder="e.g. 15 guntas"
              />
            </label>
            <label className="form-field">
              <span>Normalized extent</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.extentValue}
                onChange={(e) => change("extentValue", e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Extent unit</span>
              <select
                value={form.extentUnit}
                onChange={(e) => change("extentUnit", e.target.value)}
              >
                <option value="">Select unit</option>
                <option value="acre">Acre</option>
                <option value="gunta">Gunta</option>
                <option value="sq_ft">Sq ft</option>
                <option value="sq_m">Sq m</option>
                <option value="cent">Cent</option>
                <option value="hectare">Hectare</option>
              </select>
            </label>
            <label className="form-field">
              <span>Source description</span>
              <input
                value={form.sourceDescription}
                onChange={(e) => change("sourceDescription", e.target.value)}
                placeholder="Sale deed page, RTC, survey sketch…"
              />
            </label>
            <label className="form-field">
              <span>Fact state</span>
              <select
                value={form.factState}
                onChange={(e) => change("factState", e.target.value)}
              >
                <option value="known">Known - unverified</option>
                <option value="disputed">Disputed</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
            <label className="form-field span-2">
              <span>Notes</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => change("notes", e.target.value)}
              />
            </label>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
            <button className="primary-btn" disabled={saving}>
              <Plus size={15} />
              {saving ? "Saving…" : "Save parcel"}
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <div className="loading-state">
          <LoaderCircle className="spin" /> Loading parcels…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No parcel references"
          text="Apply migration 007, then add the surveys or subdivisions belonging to this property."
        />
      ) : (
        <div className="property-list">
          {items.map((item) => (
            <div className="property-list-item" key={item.id}>
              <div className="property-thumb large">
                <MapPin size={19} />
              </div>
              <div className="property-list-main">
                <strong>
                  Survey {item.survey_number}
                  {item.subdivision ? ` / ${item.subdivision}` : ""}
                </strong>
                <span>
                  {[item.village, item.hobli, item.taluk, item.district]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <div className="property-tags">
                  <span>{item.extent_raw || "Extent not recorded"}</span>
                  {item.extent_value && (
                    <span>
                      {item.extent_value} {pretty(item.extent_unit)}
                    </span>
                  )}
                  <span>
                    {item.source_description || "Source not recorded"}
                  </span>
                </div>
              </div>
              <div className="property-list-side">
                {Boolean(item.is_primary) && (
                  <span className="status-pill green">Primary</span>
                )}
                <span
                  className={`status-pill ${item.fact_state === "disputed" ? "red" : "amber"}`}
                >
                  {pretty(item.fact_state)}
                </span>
                {!Boolean(item.is_primary) && !readOnly && (
                  <button
                    className="icon-btn"
                    title="Remove parcel reference"
                    onClick={() => remove(item)}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="info-field">
      <span>{label}</span>
      <strong>{value || "Not recorded"}</strong>
    </div>
  );
}
function EvidenceRow({
  icon,
  label,
  detail,
  complete,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  complete: boolean;
}) {
  return (
    <div className="evidence-row">
      <div className={`evidence-icon ${complete ? "complete" : ""}`}>
        {icon}
      </div>
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <span className={`evidence-state ${complete ? "complete" : ""}`}>
        {complete ? "Added" : "Pending"}
      </span>
    </div>
  );
}
function SourceStatus({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: string;
}) {
  return (
    <div className="source-status">
      <span>{label}</span>
      <span className={`source-state ${tone}`}>
        <i />
        {status}
      </span>
    </div>
  );
}
function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function PropertyMap({ property }: { property: Property }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [mapError, setMapError] = useState("");
  useEffect(() => {
    if (!container.current || map.current) return;
    try {
      const center: [number, number] =
        property.longitude !== null && property.latitude !== null
          ? [property.longitude, property.latitude]
          : [77.5946, 12.9716];
      const m = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center,
        zoom: property.longitude !== null ? 14 : 10,
      });
      map.current = m;
      if (property.longitude !== null && property.latitude !== null) {
        new maplibregl.Marker({ color: "#d84b42" })
          .setLngLat([property.longitude, property.latitude])
          .setPopup(
            new maplibregl.Popup().setHTML(
              `<strong>${escapeHtml(property.name)}</strong><br/>Entered point · not a surveyed boundary`,
            ),
          )
          .addTo(m);
      }
      m.on("load", async () => {
        try {
          const geojson = await api<any>("/api/map/layers");
          m.addSource("ojix-imported-layers", {
            type: "geojson",
            data: geojson,
          });
          m.addLayer({
            id: "ojix-demo-polygons",
            type: "fill",
            source: "ojix-imported-layers",
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: { "fill-color": "#d6a44b", "fill-opacity": 0.16 },
          });
          m.addLayer({
            id: "ojix-demo-lines",
            type: "line",
            source: "ojix-imported-layers",
            filter: ["==", ["geometry-type"], "LineString"],
            paint: {
              "line-color": "#c19a4e",
              "line-width": 2,
              "line-dasharray": [2, 2],
            },
          });
          m.addLayer({
            id: "ojix-demo-points",
            type: "circle",
            source: "ojix-imported-layers",
            filter: ["==", ["geometry-type"], "Point"],
            paint: {
              "circle-radius": 5,
              "circle-color": "#c19a4e",
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1.5,
            },
          });
        } catch {
          /* The entered map point remains usable when the layer endpoint is unavailable. */
        }
      });
      m.on("error", () =>
        setMapError(
          "Map tiles could not be loaded. Check internet access or configure a permitted tile provider.",
        ),
      );
      return () => {
        m.remove();
        map.current = null;
      };
    } catch {
      setMapError("Map could not be initialised.");
    }
  }, [property.id]);
  return (
    <div className="map-container">
      <div ref={container} className="map-canvas" />
      {property.longitude === null && (
        <div className="map-empty-overlay">
          <MapPin size={23} />
          <strong>No property coordinates</strong>
          <span>Showing Bengaluru as a general reference only.</span>
        </div>
      )}
      {mapError && <div className="map-error">{mapError}</div>}
      <div className="map-credit">Map data © OpenStreetMap contributors</div>
    </div>
  );
}
function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] || c,
  );
}

type LocationOption = { id: string; name: string; code: string };
function LocationField({
  label,
  required,
  selectedId,
  options,
  loading,
  error,
  validationError,
  disabled,
  placeholder,
  onChange,
}: {
  label: string;
  required?: boolean;
  selectedId: string;
  options: LocationOption[];
  loading: boolean;
  error: string;
  validationError?: string;
  disabled?: boolean;
  placeholder: string;
  onChange: (value: string, option?: LocationOption) => void;
}) {
  const unavailable = disabled || loading;
  const prompt = loading
    ? "Loading…"
    : error
      ? `Unable to load ${label}`
      : placeholder;
  return (
    <label className="form-field location-select-field">
      <span>
        {label} {required && <b>*</b>}
      </span>
      <select
        className="native-location-select"
        required={required}
        value={selectedId}
        disabled={unavailable}
        aria-label={label}
        aria-invalid={Boolean(validationError)}
        onChange={(event) => {
          const option = options.find((item) => item.id === event.target.value);
          onChange(option?.name || "", option);
        }}
      >
        <option value="">{prompt}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {validationError && (
        <small className="field-error">{validationError}</small>
      )}
      {!validationError &&
        (error || (!loading && !disabled && !options.length)) && (
          <small className="field-error">
            {error
              ? `Failed to load ${label.toLowerCase()}.`
              : "No results found."}
          </small>
        )}
    </label>
  );
}
const NON_AGRICULTURAL_IDENTIFIER_TYPES = [
  "Apartment No",
  "Assessment No",
  "BBMP PID",
  "BDA No",
  "BDA PID",
  "Block No",
  "CITB No",
  "CMC No",
  "Converted Survey No",
  "Corporation No",
  "CTS No",
  "Door No",
  "DRC Number",
  "e-Aasthi PID",
  "EWS No",
  "Flat No",
  "Gramathana House List No",
  "Khata No",
  "Municipal Property No",
  "Site No",
  "Ward Property No",
  "Other",
];
const REVIEW_PURPOSE_OPTIONS = [
  ["property_purchase_sale", "Property Purchase / Sale"],
  ["legal_due_diligence", "Legal Due Diligence"],
  ["land_survey_verification", "Land & Survey Verification"],
  ["revenue_municipal_verification", "Revenue / Municipal Verification"],
  ["land_risk_planning_assessment", "Land Risk & Planning Assessment"],
  ["loan_mortgage_assessment", "Loan / Mortgage Assessment"],
  [
    "inheritance_gift_partition_transfer",
    "Inheritance / Gift / Partition / Transfer",
  ],
  ["other", "Other"],
] as const;
const DOCUMENT_TYPE_OPTIONS = [
  ["sale_deed", "Sale Deed"],
  ["gift_deed", "Gift Deed"],
  ["partition_deed", "Partition Deed"],
  ["release_deed", "Release Deed"],
  ["power_of_attorney", "Power of Attorney"],
  ["encumbrance_certificate", "Encumbrance Certificate (EC)"],
  ["rtc_pahani", "RTC / Pahani"],
  ["mutation_record", "Mutation Record"],
  ["survey_sketch_tippan", "Survey Sketch / Tippan"],
  ["khata_e_khata", "Khata / e-Khata"],
  ["property_tax_receipt", "Property Tax Receipt"],
  ["layout_approval_conversion_order", "Layout Approval / Conversion Order"],
  ["master_plan_zoning_document", "Master Plan / Zoning Document"],
  ["court_order_legal_notice", "Court Order / Legal Notice"],
  ["other", "Other"],
] as const;

function RtcLookupResultPanel({
  lookup,
  form,
  onConfirm,
}: {
  lookup: any;
  form: Record<string, any>;
  onConfirm: (matches: boolean) => void;
}) {
  const record = lookup.retrievedData;
  const normalize = (value: unknown) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/\b(hobli|taluk|district)\b/g, "")
      .replace(/[^a-z0-9\u0C80-\u0CFF]/g, "");
  const row = (label: string, entered: unknown, retrieved: unknown) => {
    const value = String(retrieved ?? "").trim();
    const available = Boolean(value);
    const match = available && normalize(entered) === normalize(value);
    return (
      <div>
        <span>{label}</span>
        <strong>{String(entered || "Not entered")}</strong>
        <strong>{available ? value : "Unavailable"}</strong>
        <em className={!available ? "review" : match ? "match" : "mismatch"}>
          {!available ? "Review" : match ? "Match" : "Mismatch"}
        </em>
      </div>
    );
  };
  if (lookup.status !== "completed")
    return (
      <div className="rtc-inline-result restricted">
        <AlertTriangle size={18} />
        <div>
          <strong>
            {lookup.status === "manual_required"
              ? "Manual RTC retrieval required"
              : lookup.status === "empty"
                ? "No RTC record returned"
                : "RTC source unavailable"}
          </strong>
          <p>{lookup.errorMessage}</p>
          {lookup.sourceUrl && (
            <a
              className="secondary-btn rtc-portal-link"
              href={lookup.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Bhoomi and retrieve RTC <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    );
  return (
    <div className="rtc-inline-result completed">
      <div className="rtc-inline-heading">
        <div>
          <Check size={17} />
          <span>
            <strong>RTC data retrieved</strong>
            <small>
              {lookup.sourceName} · Source retrieved, not legally verified
            </small>
          </span>
        </div>
        <span className="status-pill amber">
          {pretty(lookup.verificationStatus)}
        </span>
      </div>
      <div className="rtc-inline-comparison">
        <div className="rtc-comparison-labels">
          <span>Field</span>
          <span>Entered</span>
          <span>RTC source</span>
          <span>Result</span>
        </div>
        {row("Survey number", form.surveyNumber, record?.surveyNumber)}
        {row("Hissa", form.subdivision, record?.subdivision)}
        {row("Village", form.village, record?.village)}
        {row("Hobli", form.hobli, record?.hobli)}
        {row("Taluk", form.taluk, record?.taluk)}
        {row("District", form.district, record?.district)}
        {row("Extent", form.extent, record?.extentRaw)}
      </div>
      {record?.landholders?.length > 0 && (
        <p className="rtc-sensitive-summary">
          <strong>Recorded landholder(s):</strong>{" "}
          {record.landholders.join(", ")}
        </p>
      )}
      <div className="rtc-confirm-actions">
        <span>
          Does this retrieved record match the property being reviewed?
        </span>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => onConfirm(false)}
        >
          No — mismatch
        </button>
        <button
          type="button"
          className="primary-btn"
          onClick={() => onConfirm(true)}
        >
          Yes — source match
        </button>
      </div>
      <p className="rtc-review-note">
        <ShieldCheck size={15} /> Confirming a source match does not establish
        ownership, authenticity or legal validity.
      </p>
    </div>
  );
}

function CreatePropertyModal({
  onClose,
  onSubmit,
  busy,
  initialProperty,
}: {
  onClose: () => void;
  onSubmit: (form: Record<string, any>) => void;
  busy: boolean;
  initialProperty?: Property;
}) {
  const editing = Boolean(initialProperty);
  const [typeChosen, setTypeChosen] = useState(Boolean(initialProperty));
  const [form, setForm] = useState(() => ({
    reviewPurpose: initialProperty?.review_purpose || "",
    reviewPurposeCustom: initialProperty?.review_purpose_custom || "",
    primaryDocumentType: initialProperty?.primary_document_type || "",
    primaryDocumentTypeCustom:
      initialProperty?.primary_document_type_custom || "",
    propertyIdentifier: initialProperty?.property_identifier || "",
    propertyIdentifierType: initialProperty?.property_identifier_type || "",
    propertyType: initialProperty?.property_type || "agricultural",
    village: initialProperty?.village || "",
    hobli: initialProperty?.hobli || "",
    taluk: initialProperty?.taluk || "",
    district: initialProperty?.district || "",
    districtId: initialProperty?.district_id || "",
    talukId: initialProperty?.taluk_id || "",
    hobliId: initialProperty?.hobli_id || "",
    villageId: initialProperty?.village_id || "",
    surveyNumber: initialProperty?.survey_number || "",
    subdivision: initialProperty?.subdivision || "",
    extent: initialProperty?.extent || "",
    extentValue: initialProperty?.extent_value?.toString() || "",
    extentUnit: initialProperty?.extent_unit || "",
    agriAcres: "",
    agriGuntas: "",
    agriCents: "",
    propertyMeasure: "",
    eastWestMeasure: "",
    northSouthMeasure: "",
    boundaryNorth: initialProperty?.boundary_north || "",
    boundarySouth: initialProperty?.boundary_south || "",
    boundaryEast: initialProperty?.boundary_east || "",
    boundaryWest: initialProperty?.boundary_west || "",
    address: initialProperty?.address || "",
    latitude: initialProperty?.latitude?.toString() || "",
    longitude: initialProperty?.longitude?.toString() || "",
    coordinateSource: initialProperty?.coordinate_source || "",
    coordinateConfidence:
      initialProperty?.coordinate_confidence?.toString() || "",
    identityState: initialProperty?.identity_state || "known",
    notes: initialProperty?.notes || "",
  }));
  const [locations, setLocations] = useState<{
    districts: LocationOption[];
    taluks: LocationOption[];
    hoblis: LocationOption[];
    villages: LocationOption[];
  }>({ districts: [], taluks: [], hoblis: [], villages: [] });
  const [loadingLocation, setLoadingLocation] = useState("districts");
  const [locationError, setLocationError] = useState<Record<string, string>>(
    {},
  );
  const [rtcLoading, setRtcLoading] = useState(false);
  const [rtcError, setRtcError] = useState("");
  const [rtcLookup, setRtcLookup] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const loadLocations = useCallback(
    async (
      kind: "districts" | "taluks" | "hoblis" | "villages",
      parent?: string,
    ) => {
      setLoadingLocation(kind);
      setLocationError((p) => ({ ...p, [kind]: "" }));
      try {
        const query =
          kind === "taluks"
            ? `?districtId=${parent}`
            : kind === "hoblis"
              ? `?talukId=${parent}`
              : kind === "villages"
                ? `?hobliId=${parent}`
                : "";
        const data = await api<{ items: LocationOption[] }>(
          `/api/locations/${kind}${query}`,
        );
        setLocations((p) => ({ ...p, [kind]: data.items }));
      } catch (e) {
        setLocations((p) => ({ ...p, [kind]: [] }));
        setLocationError((p) => ({ ...p, [kind]: (e as Error).message }));
      } finally {
        setLoadingLocation("");
      }
    },
    [],
  );
  useEffect(() => {
    loadLocations("districts");
    if (initialProperty?.district_id)
      loadLocations("taluks", initialProperty.district_id);
    if (initialProperty?.taluk_id)
      loadLocations("hoblis", initialProperty.taluk_id);
    if (initialProperty?.hobli_id)
      loadLocations("villages", initialProperty.hobli_id);
  }, [
    loadLocations,
    initialProperty?.district_id,
    initialProperty?.taluk_id,
    initialProperty?.hobli_id,
  ]);
  const change = (key: string, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));
  const changePropertyType = (
    propertyType: "agricultural" | "non_agricultural",
  ) =>
    setForm((p) =>
      propertyType === "agricultural"
        ? {
            ...p,
            propertyType,
            propertyIdentifier: "",
            propertyIdentifierType: "",
            extentUnit: ["acre", "gunta", "cent", "hectare"].includes(
              p.extentUnit,
            )
              ? p.extentUnit
              : "acre",
          }
        : {
            ...p,
            propertyType,
            surveyNumber: "",
            subdivision: "",
            extentUnit: ["sq_ft", "sq_m"].includes(p.extentUnit)
              ? p.extentUnit
              : "sq_ft",
          },
    );
  const selectDistrict = (value: string, option?: LocationOption) => {
    setRtcLookup(null);
    setForm((p) => ({
      ...p,
      district: value,
      districtId: option?.id || "",
      taluk: "",
      talukId: "",
      hobli: "",
      hobliId: "",
      village: "",
      villageId: "",
    }));
    setLocations((p) => ({ ...p, taluks: [], hoblis: [], villages: [] }));
    if (option) loadLocations("taluks", option.id);
  };
  const selectTaluk = (value: string, option?: LocationOption) => {
    setRtcLookup(null);
    setForm((p) => ({
      ...p,
      taluk: value,
      talukId: option?.id || "",
      hobli: "",
      hobliId: "",
      village: "",
      villageId: "",
    }));
    setLocations((p) => ({ ...p, hoblis: [], villages: [] }));
    if (option) loadLocations("hoblis", option.id);
  };
  const selectHobli = (value: string, option?: LocationOption) => {
    setRtcLookup(null);
    setForm((p) => ({
      ...p,
      hobli: value,
      hobliId: option?.id || "",
      village: "",
      villageId: "",
    }));
    setLocations((p) => ({ ...p, villages: [] }));
    if (option) loadLocations("villages", option.id);
  };
  const fetchRtc = async () => {
    setRtcLoading(true);
    setRtcError("");
    setRtcLookup(null);
    try {
      const result = await api<{ item: any }>("/api/rtc/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: initialProperty?.id,
          district: form.district,
          taluk: form.taluk,
          hobli: form.hobli,
          village: form.village,
          districtId: form.districtId,
          talukId: form.talukId,
          hobliId: form.hobliId,
          villageId: form.villageId,
          surveyNumber: form.surveyNumber,
          subdivision: form.subdivision,
        }),
      });
      setRtcLookup(result.item);
    } catch (error) {
      setRtcError((error as Error).message);
    } finally {
      setRtcLoading(false);
    }
  };
  const confirmRtc = async (matchesProperty: boolean) => {
    if (!rtcLookup?.id) return;
    try {
      const result = await api<{ verificationStatus: string }>(
        `/api/rtc/${rtcLookup.id}/confirmation`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchesProperty }),
        },
      );
      setRtcLookup((current: any) => ({
        ...current,
        verificationStatus: result.verificationStatus,
        confirmedMatch: matchesProperty,
      }));
    } catch (error) {
      setRtcError((error as Error).message);
    }
  };
  const validationErrors = validatePropertyForm(form);
  const visibleError = (key: string) =>
    submitted ? validationErrors[key] : "";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validationErrors).length) return;
    const agricultural = form.propertyType === "agricultural";
    let savedExtent = form.extent;
    let savedExtentValue = form.extentValue.trim()
      ? Number(form.extentValue)
      : null;
    let savedExtentUnit = form.extentUnit;
    if (!editing && agricultural) {
      const acres = Number(form.agriAcres || 0),
        guntas = Number(form.agriGuntas || 0),
        cents = Number(form.agriCents || 0),
        totalAcres = acres + guntas / 40 + cents / 100;
      if (totalAcres > 0) {
        const factors: Record<string, number> = {
          acre: 1,
          gunta: 40,
          cent: 100,
          hectare: 1 / 2.4710538147,
        };
        savedExtentValue = totalAcres * (factors[form.extentUnit] || 1);
        savedExtentUnit = form.extentUnit;
        savedExtent = [
          acres ? `${acres} Acre${acres === 1 ? "" : "s"}` : "",
          guntas ? `${guntas} Gunta${guntas === 1 ? "" : "s"}` : "",
          cents ? `${cents} Cent${cents === 1 ? "" : "s"}` : "",
        ]
          .filter(Boolean)
          .join(" ");
      } else {
        savedExtentValue = null;
        savedExtentUnit = "";
        savedExtent = "";
      }
    } else if (!editing && !agricultural) {
      const measure = form.propertyMeasure.trim()
        ? Number(form.propertyMeasure)
        : null;
      savedExtentValue = measure;
      savedExtentUnit = measure ? form.extentUnit : "";
      savedExtent = [
        measure
          ? `${measure} ${form.extentUnit === "sq_m" ? "sq m" : "sq ft"}`
          : "",
        form.eastWestMeasure
          ? `E-W ${form.eastWestMeasure} ${form.extentUnit === "sq_m" ? "m" : "ft"}`
          : "",
        form.northSouthMeasure
          ? `N-S ${form.northSouthMeasure} ${form.extentUnit === "sq_m" ? "m" : "ft"}`
          : "",
      ]
        .filter(Boolean)
        .join("; ");
    }
    const hasLatitude = Boolean(form.latitude.trim());
    const hasLongitude = Boolean(form.longitude.trim());
    const hasExtentValue = Boolean(savedExtentValue);
    const hasExtentUnit = Boolean(savedExtentUnit);
    const hasCoordinateSource = Boolean(form.coordinateSource.trim());
    const hasCoordinateConfidence = Boolean(form.coordinateConfidence.trim());
    if (hasLatitude !== hasLongitude) {
      window.alert("Enter both latitude and longitude.");
      return;
    }
    if (hasExtentValue !== hasExtentUnit) {
      window.alert("Enter both normalized extent value and extent unit.");
      return;
    }
    if ((hasLatitude || hasLongitude) && !hasCoordinateSource) {
      window.alert("Enter the coordinate source.");
      return;
    }
    if ((hasLatitude || hasLongitude) && !hasCoordinateConfidence) {
      window.alert("Enter coordinate confidence from 0 to 100.");
      return;
    }
    if (
      (hasCoordinateSource || hasCoordinateConfidence) &&
      !(hasLatitude && hasLongitude)
    ) {
      window.alert(
        "Enter latitude and longitude for the coordinate source and confidence.",
      );
      return;
    }
    const hasCoordinates = hasLatitude && hasLongitude;
    onSubmit({
      ...form,
      extent: savedExtent,
      extentValue: hasExtentValue ? savedExtentValue : null,
      extentUnit: hasExtentUnit ? savedExtentUnit : "",
      latitude: hasLatitude ? Number(form.latitude) : null,
      longitude: hasLongitude ? Number(form.longitude) : null,
      coordinateConfidence: hasCoordinateConfidence
        ? Number(form.coordinateConfidence)
        : null,
      coordinateCapturedAt: hasCoordinates ? new Date().toISOString() : null,
    });
  };
  const agricultural = form.propertyType === "agricultural";
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="eyebrow">
              {editing ? "EDIT CASE FILE" : "NEW CASE FILE"}
            </div>
            <h2>
              {editing
                ? "Edit property details"
                : typeChosen
                  ? "Create property workspace"
                  : "Choose property type"}
            </h2>
            <p>
              {editing
                ? "Update the recorded facts below. Changes are saved to the application audit trail."
                : typeChosen
                  ? "Complete the form for the selected property record type."
                  : "Choose the property record type to open its matching form."}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {!editing && !typeChosen ? (
          <div className="property-type-start">
            <button
              type="button"
              className="property-type-start-card"
              onClick={() => {
                changePropertyType("agricultural");
                setTypeChosen(true);
              }}
            >
              <span className="property-type-start-icon">
                <MapIcon size={22} />
              </span>
              <strong>Agricultural property</strong>
              <p>
                Survey number and Hissa, RTC lookup, and area in acres, guntas
                or cents.
              </p>
              <span className="primary-btn">
                Continue with Agricultural <ArrowUpRight size={14} />
              </span>
            </button>
            <button
              type="button"
              className="property-type-start-card"
              onClick={() => {
                changePropertyType("non_agricultural");
                setTypeChosen(true);
              }}
            >
              <span className="property-type-start-icon">
                <Building2 size={22} />
              </span>
              <strong>Non-Agricultural property</strong>
              <p>
                PID, Khata or municipal number, area, and side measurements.
              </p>
              <span className="primary-btn">
                Continue with Non-Agricultural <ArrowUpRight size={14} />
              </span>
            </button>
          </div>
        ) : (
          <form noValidate onBlur={() => setSubmitted(true)} onSubmit={submit}>
            <div className="form-grid">
              <div className="form-section-heading">
                <span>Review context</span>
                <small>
                  Keep the legal purpose separate from the evidence supplied.
                </small>
              </div>
              <label className="form-field half-field">
                <span>
                  Purpose of Property Review <b>*</b>
                </span>
                <select
                  required
                  aria-invalid={Boolean(visibleError("reviewPurpose"))}
                  value={form.reviewPurpose}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      reviewPurpose: e.target.value,
                      reviewPurposeCustom:
                        e.target.value === "other" ? p.reviewPurposeCustom : "",
                    }))
                  }
                >
                  <option value="">Select review purpose</option>
                  {REVIEW_PURPOSE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {visibleError("reviewPurpose") && (
                  <small className="field-error">
                    {visibleError("reviewPurpose")}
                  </small>
                )}
              </label>
              <label className="form-field half-field">
                <span>
                  Primary Document Type <b>*</b>
                </span>
                <select
                  required
                  aria-invalid={Boolean(visibleError("primaryDocumentType"))}
                  value={form.primaryDocumentType}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      primaryDocumentType: e.target.value,
                      primaryDocumentTypeCustom:
                        e.target.value === "other"
                          ? p.primaryDocumentTypeCustom
                          : "",
                    }))
                  }
                >
                  <option value="">Select primary document type</option>
                  {DOCUMENT_TYPE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {visibleError("primaryDocumentType") && (
                  <small className="field-error">
                    {visibleError("primaryDocumentType")}
                  </small>
                )}
              </label>
              {form.reviewPurpose === "other" && (
                <label className="form-field half-field conditional-field">
                  <span>
                    Custom review purpose <b>*</b>
                  </span>
                  <input
                    required
                    aria-invalid={Boolean(visibleError("reviewPurposeCustom"))}
                    maxLength={255}
                    value={form.reviewPurposeCustom}
                    onChange={(e) =>
                      change("reviewPurposeCustom", e.target.value)
                    }
                    placeholder="Describe the purpose of this review"
                  />
                  {visibleError("reviewPurposeCustom") && (
                    <small className="field-error">
                      {visibleError("reviewPurposeCustom")}
                    </small>
                  )}
                </label>
              )}
              {form.primaryDocumentType === "other" && (
                <label className="form-field half-field conditional-field">
                  <span>
                    Custom primary document type <b>*</b>
                  </span>
                  <input
                    required
                    aria-invalid={Boolean(
                      visibleError("primaryDocumentTypeCustom"),
                    )}
                    maxLength={255}
                    value={form.primaryDocumentTypeCustom}
                    onChange={(e) =>
                      change("primaryDocumentTypeCustom", e.target.value)
                    }
                    placeholder="Name the primary document"
                  />
                  {visibleError("primaryDocumentTypeCustom") && (
                    <small className="field-error">
                      {visibleError("primaryDocumentTypeCustom")}
                    </small>
                  )}
                </label>
              )}
              <div className="form-section-heading">
                <span>Administrative location</span>
                <small>
                  Select in order: District → Taluk → Hobli/Town → Index-II
                  Village.
                </small>
              </div>
              <LocationField
                label="District"
                required
                selectedId={form.districtId}
                options={locations.districts}
                loading={loadingLocation === "districts"}
                error={locationError.districts || ""}
                validationError={visibleError("districtId")}
                placeholder="Select district"
                onChange={selectDistrict}
              />
              <LocationField
                label="Taluk"
                required
                selectedId={form.talukId}
                options={locations.taluks}
                loading={loadingLocation === "taluks"}
                error={locationError.taluks || ""}
                validationError={visibleError("talukId")}
                disabled={!form.districtId}
                placeholder="Select district first"
                onChange={selectTaluk}
              />
              <LocationField
                label="Hobli / Town"
                required
                selectedId={form.hobliId}
                options={locations.hoblis}
                loading={loadingLocation === "hoblis"}
                error={locationError.hoblis || ""}
                validationError={visibleError("hobliId")}
                disabled={!form.talukId}
                placeholder="Select taluk first"
                onChange={selectHobli}
              />
              <LocationField
                label="Index-II Village"
                required
                selectedId={form.villageId}
                options={locations.villages}
                loading={loadingLocation === "villages"}
                error={locationError.villages || ""}
                validationError={visibleError("villageId")}
                disabled={!form.hobliId}
                placeholder="Select hobli / town first"
                onChange={(value, option) => {
                  setRtcLookup(null);
                  setForm((p) => ({
                    ...p,
                    village: value,
                    villageId: option?.id || "",
                  }));
                }}
              />
              {!editing && (
                <div className="selected-property-type">
                  <span>
                    {agricultural ? (
                      <MapIcon size={17} />
                    ) : (
                      <Building2 size={17} />
                    )}{" "}
                    {agricultural
                      ? "Agricultural property"
                      : "Non-Agricultural property"}
                  </span>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setTypeChosen(false)}
                  >
                    Change type
                  </button>
                </div>
              )}
              <div className="form-section-heading">
                <span>
                  {agricultural
                    ? "RTC / survey identity"
                    : "Municipal property identity"}
                </span>
                <small>
                  {agricultural
                    ? "Use the Survey number and Hissa shown in the RTC or revenue record."
                    : "Choose the authority-specific number type before entering the property number."}
                </small>
              </div>
              {agricultural ? (
                <>
                  <label className="form-field half-field">
                    <span>
                      Survey number <b>*</b>
                    </span>
                    <input
                      required
                      maxLength={80}
                      aria-invalid={Boolean(visibleError("surveyNumber"))}
                      value={form.surveyNumber}
                      onChange={(e) => {
                        change("surveyNumber", e.target.value);
                        setRtcLookup(null);
                      }}
                    />
                    {visibleError("surveyNumber") && (
                      <small className="field-error">
                        {visibleError("surveyNumber")}
                      </small>
                    )}
                  </label>
                  <label className="form-field half-field">
                    <span>Hissa / subdivision number</span>
                    <input
                      maxLength={80}
                      aria-invalid={Boolean(visibleError("subdivision"))}
                      value={form.subdivision}
                      onChange={(e) => {
                        change("subdivision", e.target.value);
                        setRtcLookup(null);
                      }}
                    />
                    {visibleError("subdivision") && (
                      <small className="field-error">
                        {visibleError("subdivision")}
                      </small>
                    )}
                  </label>
                  <div className="rtc-fetch-control">
                    <div>
                      <strong>Retrieve RTC details</strong>
                      <span>
                        Uses an authorised provider when configured. CAPTCHA or
                        restricted access will require manual retrieval.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="secondary-btn"
                      disabled={
                        rtcLoading ||
                        !form.districtId ||
                        !form.talukId ||
                        !form.hobliId ||
                        !form.villageId ||
                        !form.surveyNumber.trim()
                      }
                      onClick={fetchRtc}
                    >
                      {rtcLoading ? (
                        <LoaderCircle className="spin" size={15} />
                      ) : (
                        <FileSearch size={15} />
                      )}{" "}
                      {rtcLoading
                        ? "Checking official source…"
                        : "Fetch RTC Details"}
                    </button>
                  </div>
                  {rtcError && (
                    <p className="data-warning rtc-form-message">
                      <AlertTriangle size={15} />
                      {rtcError}
                    </p>
                  )}
                  {rtcLookup && (
                    <RtcLookupResultPanel
                      lookup={rtcLookup}
                      form={form}
                      onConfirm={confirmRtc}
                    />
                  )}
                </>
              ) : (
                <>
                  <label className="form-field half-field">
                    <span>
                      Property number type <b>*</b>
                    </span>
                    <select
                      required
                      aria-invalid={Boolean(
                        visibleError("propertyIdentifierType"),
                      )}
                      value={form.propertyIdentifierType}
                      onChange={(e) =>
                        change("propertyIdentifierType", e.target.value)
                      }
                    >
                      <option value="">Select property number type</option>
                      {NON_AGRICULTURAL_IDENTIFIER_TYPES.map((type) => (
                        <option value={type} key={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {visibleError("propertyIdentifierType") && (
                      <small className="field-error">
                        {visibleError("propertyIdentifierType")}
                      </small>
                    )}
                  </label>
                  <label className="form-field half-field">
                    <span>
                      Present property number details <b>*</b>
                    </span>
                    <input
                      required
                      maxLength={160}
                      aria-invalid={Boolean(visibleError("propertyIdentifier"))}
                      value={form.propertyIdentifier}
                      onChange={(e) =>
                        change("propertyIdentifier", e.target.value)
                      }
                      placeholder={
                        form.propertyIdentifierType
                          ? `Enter ${form.propertyIdentifierType}`
                          : "Select number type first"
                      }
                    />
                    {visibleError("propertyIdentifier") && (
                      <small className="field-error">
                        {visibleError("propertyIdentifier")}
                      </small>
                    )}
                  </label>
                </>
              )}
              <div className="form-section-heading">
                <span>
                  {editing
                    ? "Extent and schedule"
                    : agricultural
                      ? "Agricultural land measurement"
                      : "Non-agricultural measurement"}
                </span>
                <small>
                  {editing
                    ? "Enter facts exactly as stated in the available property record."
                    : agricultural
                      ? "Enter the land area in acres, guntas and/or cents, as shown in the revenue record."
                      : "Enter the measured property area and its east-to-west and north-to-south dimensions."}
                </small>
              </div>
              {editing ? (
                <>
                  <label className="form-field">
                    <span>Extent (as stated)</span>
                    <input
                      value={form.extent}
                      onChange={(e) => change("extent", e.target.value)}
                      placeholder="e.g. 1 acre 20 guntas"
                    />
                  </label>
                  <label className="form-field">
                    <span>Normalized extent</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={form.extentValue}
                        onChange={(e) => change("extentValue", e.target.value)}
                        placeholder="30"
                      />
                      <select
                        value={form.extentUnit}
                        onChange={(e) => change("extentUnit", e.target.value)}
                      >
                        <option value="">Unit</option>
                        <option value="acre">Acre</option>
                        <option value="gunta">Gunta</option>
                        <option value="sq_ft">Sq ft</option>
                        <option value="sq_m">Sq m</option>
                        <option value="cent">Cent</option>
                        <option value="hectare">Hectare</option>
                      </select>
                    </div>
                  </label>
                </>
              ) : agricultural ? (
                <>
                  <label className="form-field span-2">
                    <span>Unit of measurement</span>
                    <select
                      value={form.extentUnit}
                      onChange={(e) => change("extentUnit", e.target.value)}
                    >
                      <option value="acre">Acre</option>
                      <option value="gunta">Gunta</option>
                      <option value="cent">Cent</option>
                      <option value="hectare">Hectare</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Acres</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.agriAcres}
                      onChange={(e) => change("agriAcres", e.target.value)}
                      placeholder="e.g. 1"
                    />
                  </label>
                  <label className="form-field">
                    <span>Guntas</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.agriGuntas}
                      onChange={(e) => change("agriGuntas", e.target.value)}
                      placeholder="e.g. 20"
                    />
                  </label>
                  <label className="form-field">
                    <span>Cents</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.agriCents}
                      onChange={(e) => change("agriCents", e.target.value)}
                      placeholder="e.g. 0"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="form-field span-2">
                    <span>Unit of measurement</span>
                    <select
                      value={form.extentUnit}
                      onChange={(e) => change("extentUnit", e.target.value)}
                    >
                      <option value="sq_ft">Sq feet</option>
                      <option value="sq_m">Sq metres</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>
                      Property measuring (
                      {form.extentUnit === "sq_m" ? "sq m" : "sq ft"})
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.propertyMeasure}
                      onChange={(e) =>
                        change("propertyMeasure", e.target.value)
                      }
                      placeholder="Total area"
                    />
                  </label>
                  <label className="form-field">
                    <span>
                      East to west ({form.extentUnit === "sq_m" ? "m" : "ft"})
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.eastWestMeasure}
                      onChange={(e) =>
                        change("eastWestMeasure", e.target.value)
                      }
                      placeholder="Length"
                    />
                  </label>
                  <label className="form-field">
                    <span>
                      North to south ({form.extentUnit === "sq_m" ? "m" : "ft"})
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.northSouthMeasure}
                      onChange={(e) =>
                        change("northSouthMeasure", e.target.value)
                      }
                      placeholder="Length"
                    />
                  </label>
                </>
              )}
              <label className="form-field span-2">
                <span>
                  Address / directions <b>*</b>
                </span>
                <input
                  required
                  minLength={10}
                  maxLength={500}
                  aria-invalid={Boolean(visibleError("address"))}
                  pattern=".*\s+.*"
                  title="Enter at least two words with a road, landmark or locality; a taluk name alone is not a complete address."
                  value={form.address}
                  onChange={(e) => change("address", e.target.value)}
                  placeholder="e.g. Near Taluk Office, Pandavapura Main Road"
                />
                {visibleError("address") && (
                  <small className="field-error">
                    {visibleError("address")}
                  </small>
                )}
                <small className="field-guidance">
                  Use a road, landmark, site/door number or clear directions—not
                  only the village or taluk name.
                </small>
              </label>
              <label className="form-field">
                <span>
                  North boundary <b>*</b>
                </span>
                <input
                  required
                  minLength={4}
                  maxLength={500}
                  aria-invalid={Boolean(visibleError("boundaryNorth"))}
                  title="Describe the specific northern boundary."
                  value={form.boundaryNorth}
                  onChange={(e) => change("boundaryNorth", e.target.value)}
                  placeholder="e.g. 20-ft public road"
                />
                {visibleError("boundaryNorth") && (
                  <small className="field-error">
                    {visibleError("boundaryNorth")}
                  </small>
                )}
              </label>
              <label className="form-field">
                <span>
                  South boundary <b>*</b>
                </span>
                <input
                  required
                  minLength={4}
                  maxLength={500}
                  aria-invalid={Boolean(visibleError("boundarySouth"))}
                  title="Describe the specific southern boundary."
                  value={form.boundarySouth}
                  onChange={(e) => change("boundarySouth", e.target.value)}
                  placeholder="e.g. Land of Ramesh"
                />
                {visibleError("boundarySouth") && (
                  <small className="field-error">
                    {visibleError("boundarySouth")}
                  </small>
                )}
              </label>
              <label className="form-field">
                <span>
                  East boundary <b>*</b>
                </span>
                <input
                  required
                  minLength={4}
                  maxLength={500}
                  aria-invalid={Boolean(visibleError("boundaryEast"))}
                  title="Describe the specific eastern boundary."
                  value={form.boundaryEast}
                  onChange={(e) => change("boundaryEast", e.target.value)}
                  placeholder="e.g. Site No. 46"
                />
                {visibleError("boundaryEast") && (
                  <small className="field-error">
                    {visibleError("boundaryEast")}
                  </small>
                )}
              </label>
              <label className="form-field">
                <span>
                  West boundary <b>*</b>
                </span>
                <input
                  required
                  minLength={4}
                  maxLength={500}
                  aria-invalid={Boolean(visibleError("boundaryWest"))}
                  title="Describe the specific western boundary."
                  value={form.boundaryWest}
                  onChange={(e) => change("boundaryWest", e.target.value)}
                  placeholder="e.g. Irrigation canal"
                />
                {visibleError("boundaryWest") && (
                  <small className="field-error">
                    {visibleError("boundaryWest")}
                  </small>
                )}
              </label>
              {editing && (
                <>
                  <div className="form-section-heading">
                    <span>Coordinates and identity review</span>
                    <small>
                      Optional location metadata and verification state.
                    </small>
                  </div>
                  <label className="form-field">
                    <span>Latitude (optional)</span>
                    <input
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      value={form.latitude}
                      onChange={(e) => change("latitude", e.target.value)}
                      placeholder="12.9716"
                    />
                  </label>
                  <label className="form-field">
                    <span>Longitude (optional)</span>
                    <input
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      value={form.longitude}
                      onChange={(e) => change("longitude", e.target.value)}
                      placeholder="77.5946"
                    />
                  </label>
                  <label className="form-field">
                    <span>Coordinate source</span>
                    <input
                      value={form.coordinateSource}
                      onChange={(e) =>
                        change("coordinateSource", e.target.value)
                      }
                      placeholder="GPS, survey sketch, map pin…"
                    />
                  </label>
                  <label className="form-field">
                    <span>Coordinate confidence (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={form.coordinateConfidence}
                      onChange={(e) =>
                        change("coordinateConfidence", e.target.value)
                      }
                      placeholder="e.g. 70"
                    />
                  </label>
                  <label className="form-field">
                    <span>Identity state</span>
                    <select
                      value={form.identityState}
                      onChange={(e) => change("identityState", e.target.value)}
                    >
                      <option value="known">Known - not yet verified</option>
                      <option value="disputed">Disputed</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </label>
                  <label className="form-field span-2">
                    <span>Workspace notes</span>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) => change("notes", e.target.value)}
                      placeholder="Transaction context, documents expected, questions for reviewer…"
                    />
                  </label>
                </>
              )}
            </div>
            <div className="form-note">
              <ShieldCheck size={16} />
              <span>
                {agricultural
                  ? "Agricultural identity will be tracked through Survey/Hissa and RTC evidence."
                  : "Non-agricultural identity will be tracked through the selected PID, Khata, site or municipal number."}{" "}
                All entered facts remain unverified until supported by evidence.
              </span>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => (editing ? onClose() : setTypeChosen(false))}
              >
                {editing ? "Cancel" : "Back to property types"}
              </button>
              <button
                type="submit"
                className="primary-btn"
                disabled={busy || Object.keys(validationErrors).length > 0}
              >
                {editing ? <Check size={16} /> : <Plus size={16} />}{" "}
                {editing
                  ? busy
                    ? "Saving…"
                    : "Save changes"
                  : "Create workspace"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
