/**
 * API Import section with field mapping and preview.
 * Flow: Parse → Step 1 (Map fields) → Step 2 (Preview/Delete) → Save
 */
import { useState } from "react";
import {
  Globe,
  Send,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { db } from "@/integrations/api/db";

const DB_COLUMN_OPTIONS = [
  { value: "skip", label: "Skip this field" },
  { value: "combine_full_name", label: "Combine: first + last → full_name" },
  { value: "full_name", label: "full_name" },
  { value: "email", label: "email" },
  { value: "employee_code", label: "employee_code" },
  { value: "job_title", label: "job_title" },
  { value: "department", label: "department" },
  { value: "location", label: "location" },
  { value: "employment_type", label: "employment_type" },
  { value: "joining_date", label: "joining_date" },
  { value: "external_role", label: "external_role" },
  { value: "external_sub_role", label: "external_sub_role" },
  { value: "default_password", label: "password (hashed)" },
  { value: "reporting_manager_code", label: "reporting_manager_code (→ manager_id)" },
];

const DEFAULT_MAPPINGS: Record<string, string> = {
  id: "skip",
  employeeCode: "employee_code",
  employee_code: "employee_code",
  email: "email",
  designation: "job_title",
  job_title: "job_title",
  jobTitle: "job_title",
  departmentName: "department",
  department: "department",
  employmentType: "employment_type",
  employment_type: "employment_type",
  dateOfJoining: "joining_date",
  date_of_joining: "joining_date",
  externalRole: "external_role",
  external_role: "external_role",
  externalSubRole: "external_sub_role",
  external_sub_role: "external_sub_role",
  defaultPassword: "default_password",
  default_password: "default_password",
  reportingManagerId: "reporting_manager_code",
  reporting_manager_id: "reporting_manager_code",
  firstName: "combine_full_name",
  first_name: "combine_full_name",
  lastName: "combine_full_name",
  last_name: "combine_full_name",
  reportingManagerName: "skip",
  reporting_manager_name: "skip",
};

function getByPath(obj: unknown, path: string): unknown {
  if (!path.trim()) return obj;
  const keys = path.trim().split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function formatEmploymentType(raw: string | undefined): string {
  if (!raw || !String(raw).trim()) return "—";
  const v = String(raw).trim().toLowerCase();
  if (v === "full_time") return "Full Time";
  if (v === "part_time") return "Part Time";
  if (v === "contract") return "Contract";
  return raw;
}

type MappedEmployee = {
  _raw: Record<string, unknown>;
  full_name: string;
  email: string;
  employee_code?: string;
  job_title?: string;
  department?: string;
  employment_type?: string;
  reporting_manager_name?: string;
  reporting_manager_code?: string;
  external_role?: string;
  external_sub_role?: string;
  default_password?: string;
  joining_date?: string | null;
};

function applyMapping(
  raw: Record<string, unknown>,
  fieldMapping: Record<string, string>
): Partial<MappedEmployee> {
  const result: Record<string, unknown> = { _raw: raw };
  const combineParts: string[] = [];

  for (const [apiField, dbCol] of Object.entries(fieldMapping)) {
    if (dbCol === "skip") continue;
    const val = raw[apiField];
    const strVal = val != null ? String(val).trim() : "";

    if (dbCol === "combine_full_name") {
      if (strVal) combineParts.push(strVal);
    } else if (dbCol && dbCol !== "skip") {
      result[dbCol] = strVal || null;
    }
  }

  const fullName = combineParts.length ? combineParts.join(" ").trim() : "";
  if (fullName) result.full_name = fullName;

  const email = (result.email as string) || (raw.email ?? raw.Email ?? raw.mail ?? "") as string;
  result.email = typeof email === "string" ? email.trim() : "";

  if (!result.full_name && result.email) {
    result.full_name = String(result.email).split("@")[0] || "User";
  }

  // Display-only: reporting manager name from raw (often skipped for save)
  const mgrName = raw.reportingManagerName ?? raw.reporting_manager_name ?? raw.manager ?? raw.managerName;
  if (mgrName != null) result.reporting_manager_name = String(mgrName).trim();

  return result as Partial<MappedEmployee>;
}

type ApiImportSectionProps = {
  onFetchSuccess?: () => void;
};

export function ApiImportSection({ onFetchSuccess }: ApiImportSectionProps) {
  const [apiUrl, setApiUrl] = useState("");
  const [apiMethod, setApiMethod] = useState<"GET" | "POST">("GET");
  const [apiHeaders, setApiHeaders] = useState<{ key: string; value: string }[]>([
    { key: "", value: "" },
  ]);
  const [apiFetchLoading, setApiFetchLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<unknown>(null);
  const [apiResponseStatus, setApiResponseStatus] = useState<number | null>(null);
  const [dataPath, setDataPath] = useState("");

  const [apiImportStep, setApiImportStep] = useState<0 | 1 | 2>(0); // 0=none, 1=mapping, 2=preview
  const [apiFields, setApiFields] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [previewRows, setPreviewRows] = useState<MappedEmployee[]>([]);
  const [deletedIndices, setDeletedIndices] = useState<Set<number>>(new Set());
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [previewSearch, setPreviewSearch] = useState("");
  const [revealedPasswordIndex, setRevealedPasswordIndex] = useState<number | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importFailedDetails, setImportFailedDetails] = useState<{ email: string; error: string }[]>([]);
  const [conflictModal, setConflictModal] = useState<{
    existingEmails: string[];
    pendingEmployees: MappedEmployee[];
  } | null>(null);

  const handleApiFetch = async () => {
    if (!apiUrl.trim()) {
      toast.error("Enter an API URL");
      return;
    }
    setApiFetchLoading(true);
    setApiResponse(null);
    setApiResponseStatus(null);
    try {
      const headers: Record<string, string> = {};
      apiHeaders.forEach((h) => {
        if (h.key.trim()) headers[h.key.trim()] = h.value.trim();
      });
      const response = await db.functions.invoke("admin-api-fetch", {
        body: { url: apiUrl.trim(), method: apiMethod, headers },
      });
      if (response.error) throw response.error;
      const body = response.data?.body;
      const status = response.data?.status;
      setApiResponse(body);
      setApiResponseStatus(status ?? null);
      if (status && status >= 400) toast.error(`API returned ${status}`);
      else toast.success("Response received");
    } catch (err) {
      console.error("API fetch error:", err);
      toast.error("Failed to fetch URL");
      setApiResponse(null);
    } finally {
      setApiFetchLoading(false);
    }
  };

  const handleParseEmployees = () => {
    const raw = dataPath.trim() ? getByPath(apiResponse, dataPath) : apiResponse;
    const arr = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && "data" in (raw as object)
        ? (raw as { data: unknown[] }).data
        : null;
    const list = Array.isArray(arr) ? arr : raw && typeof raw === "object" ? [raw] : [];
    const rows = list
      .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
      .filter((item) => (item.email ?? item.Email ?? item.mail ?? "" as string));

    if (rows.length === 0) {
      toast.error("No rows with email found. Check data path or response shape.");
      return;
    }

    const fields = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => fields.add(k)));
    const fieldList = Array.from(fields).sort();

    const mapping: Record<string, string> = {};
    fieldList.forEach((f) => {
      const lower = f.toLowerCase();
      mapping[f] =
        DEFAULT_MAPPINGS[f] ??
        DEFAULT_MAPPINGS[lower] ??
        (lower === "firstname" ? "combine_full_name" : lower === "lastname" ? "combine_full_name" : "skip");
    });

    setApiFields(fieldList);
    setFieldMapping(mapping);
    setRawRows(rows);
    setApiImportStep(1);
    setDeletedIndices(new Set());
    setSelectedIndices(new Set());
    toast.success(`Parsed ${rows.length} employee(s). Map fields below.`);
  };

  const mappingErrors: Record<string, string> = {};
  const usedColumns = new Map<string, string>();
  for (const [apiField, dbCol] of Object.entries(fieldMapping)) {
    if (dbCol === "skip" || dbCol === "combine_full_name") continue;
    if (usedColumns.has(dbCol)) {
      mappingErrors[apiField] = `Column already mapped by "${usedColumns.get(dbCol)}"`;
    } else {
      usedColumns.set(dbCol, apiField);
    }
  }

  const validateMapping = (): string | null => {
    const firstErr = Object.entries(mappingErrors)[0];
    return firstErr ? `${firstErr[0]}: ${firstErr[1]}` : null;
  };

  const handleApplyMapping = () => {
    const err = validateMapping();
    if (err) {
      toast.error(err);
      return;
    }

    const mapped: MappedEmployee[] = rawRows.map((raw) => {
      const applied = applyMapping(raw, fieldMapping) as MappedEmployee;
      applied._raw = raw;
      return applied;
    }).filter((m) => m.email);

    setPreviewRows(mapped);
    setApiImportStep(2);
    toast.success("Preview ready. Remove unwanted rows, then save.");
  };

  const handleBackToMapping = () => {
    setApiImportStep(1);
  };

  const handleRequestDelete = (index: number) => {
    setPendingDeleteIndex(index);
  };

  const handleConfirmDelete = (index: number) => {
    setDeletedIndices((prev) => new Set(prev).add(index));
    setPendingDeleteIndex(null);
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const handleCancelDelete = () => {
    setPendingDeleteIndex(null);
  };

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAll = () => {
    const visible = visiblePreviewIndices;
    const allSelected = visible.every((i) => selectedIndices.has(i));
    if (allSelected) {
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        visible.forEach((i) => next.delete(i));
        return next;
      });
    } else {
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        visible.forEach((i) => next.add(i));
        return next;
      });
    }
  };

  const handleDeleteSelected = () => {
    setDeletedIndices((prev) => {
      const next = new Set(prev);
      selectedIndices.forEach((i) => next.add(i));
      return next;
    });
    setSelectedIndices(new Set());
  };

  const visiblePreviewIndices = previewRows
    .map((_, i) => i)
    .filter((i) => !deletedIndices.has(i));

  const filteredIndices = previewSearch.trim()
    ? visiblePreviewIndices.filter((i) => {
        const row = previewRows[i];
        const q = previewSearch.toLowerCase();
        return (
          (row.full_name || "").toLowerCase().includes(q) ||
          (row.email || "").toLowerCase().includes(q)
        );
      })
    : visiblePreviewIndices;

  const rowsToSave = visiblePreviewIndices.map((i) => previewRows[i]);

  const buildPayload = () =>
    rowsToSave.map((r) => ({
      email: r.email,
      full_name: r.full_name,
      employee_code: r.employee_code,
      job_title: r.job_title,
      department: r.department,
      employment_type: r.employment_type,
      reporting_manager_code: r.reporting_manager_code,
      reporting_manager_name: r.reporting_manager_name,
      external_role: r.external_role,
      external_sub_role: r.external_sub_role,
      default_password: r.default_password,
      date_of_joining: r.joining_date,
    }));

  const handleSaveToDb = async (onConflict?: "skip" | "overwrite") => {
    if (rowsToSave.length === 0) {
      toast.error("No employees to save. Remove deletions or add data.");
      return;
    }

    const toSend = buildPayload();

    setImportLoading(true);
    try {
      const response = await db.functions.invoke("admin-import-employees-from-api", {
        body: { employees: toSend, onConflict },
      });
      if (response.error) throw response.error;
      const data = response.data as {
        conflict?: boolean;
        existingEmails?: string[];
        created?: string[];
        updated?: number;
        skipped?: number;
        failed?: { email: string; error: string }[];
        failedDetails?: { email: string; error: string }[];
        message?: string;
      };
      if (data.conflict && data.existingEmails?.length) {
        setConflictModal({ existingEmails: data.existingEmails, pendingEmployees: rowsToSave });
        setImportFailedDetails([]);
      } else {
        setImportFailedDetails(data.failedDetails ?? data.failed ?? []);
        toast.success(data.message || "Import completed");
        onFetchSuccess?.();
      }
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Failed to import employees");
      setImportFailedDetails([]);
    } finally {
      setImportLoading(false);
    }
  };

  const handleConflictResolve = async (choice: "skip" | "overwrite") => {
    if (!conflictModal) return;
    const toSend = conflictModal.pendingEmployees.map((r) => ({
      email: r.email,
      full_name: r.full_name,
      employee_code: r.employee_code,
      job_title: r.job_title,
      department: r.department,
      employment_type: r.employment_type,
      reporting_manager_code: r.reporting_manager_code,
      reporting_manager_name: r.reporting_manager_name,
      external_role: r.external_role,
      external_sub_role: r.external_sub_role,
      default_password: r.default_password,
      date_of_joining: r.joining_date,
    }));
    setImportLoading(true);
    try {
      const response = await db.functions.invoke("admin-import-employees-from-api", {
        body: { employees: toSend, onConflict: choice },
      });
      if (response.error) throw response.error;
      const data = response.data as {
        created?: string[];
        updated?: number;
        failedDetails?: { email: string; error: string }[];
        message?: string;
      };
      setImportFailedDetails(data.failedDetails ?? []);
      toast.success(data.message || "Import completed");
      setConflictModal(null);
      onFetchSuccess?.();
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Failed to import employees");
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* URL + Headers + Send — unchanged */}
      <div className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          Get Employee Data from HRMS Portal
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enter an API URL that returns employee data (JSON). Then parse the response and map fields before saving.
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select
            value={apiMethod}
            onChange={(e) => setApiMethod(e.target.value as "GET" | "POST")}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
          <input
            type="url"
            placeholder="https://api.example.com/employees"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button onClick={handleApiFetch} disabled={apiFetchLoading} className="gap-2">
            <Send className="w-4 h-4" />
            {apiFetchLoading ? "Fetching..." : "Send"}
          </Button>
        </div>
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Headers (optional)</p>
          {apiHeaders.map((h, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                placeholder="Key"
                value={h.key}
                onChange={(e) => {
                  const next = [...apiHeaders];
                  next[i] = { ...next[i], key: e.target.value };
                  setApiHeaders(next);
                }}
                className="w-32 px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              />
              <input
                placeholder="Value"
                value={h.value}
                onChange={(e) => {
                  const next = [...apiHeaders];
                  next[i] = { ...next[i], value: e.target.value };
                  setApiHeaders(next);
                }}
                className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setApiHeaders(apiHeaders.filter((_, j) => j !== i))}
                disabled={apiHeaders.length <= 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setApiHeaders([...apiHeaders, { key: "", value: "" }])}
            className="gap-1 mt-1"
          >
            <Plus className="w-4 h-4" />
            Add header
          </Button>
        </div>
        {apiResponse !== null && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Response {apiResponseStatus != null && `(${apiResponseStatus})`}
            </p>
            <pre className="p-4 rounded-xl bg-muted/50 border border-border text-xs overflow-auto max-h-[240px]">
              {typeof apiResponse === "string"
                ? apiResponse
                : JSON.stringify(apiResponse, null, 2)}
            </pre>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <input
                type="text"
                placeholder="Data path (e.g. data or data.employees)"
                value={dataPath}
                onChange={(e) => setDataPath(e.target.value)}
                className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <Button variant="secondary" onClick={handleParseEmployees} className="gap-1">
                Parse as employees
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Step 1: Field Mapping */}
      {apiImportStep >= 1 && (
        <div className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
          <h3 className="font-semibold mb-1">Map API Fields to Database Columns</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Match each API field to the correct database column.
          </p>
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">API Field (from response)</th>
                  <th className="text-left p-3 font-medium">Maps to DB Column</th>
                </tr>
              </thead>
              <tbody>
                {apiFields.map((field) => (
                  <tr key={field} className={`border-t border-border ${mappingErrors[field] ? "bg-destructive/5" : ""}`}>
                    <td className="p-3 font-mono text-muted-foreground">{field}</td>
                    <td className="p-3">
                      <select
                        value={fieldMapping[field] ?? "skip"}
                        onChange={(e) =>
                          setFieldMapping((prev) => ({ ...prev, [field]: e.target.value }))
                        }
                        className={`w-full max-w-xs px-3 py-2 rounded-lg border bg-background text-sm ${
                          mappingErrors[field] ? "border-destructive" : "border-border"
                        }`}
                      >
                        {DB_COLUMN_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {mappingErrors[field] && (
                        <p className="text-xs text-destructive mt-1">{mappingErrors[field]}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            onClick={handleApplyMapping}
            className="mt-4 gap-2"
          >
            Apply Mapping & Preview <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Step 2: Preview Table with Delete */}
      {apiImportStep === 2 && previewRows.length > 0 && (
        <div className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
          <h3 className="font-semibold mb-4">
            Parsed employees ({visiblePreviewIndices.length})
          </h3>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={previewSearch}
              onChange={(e) => setPreviewSearch(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
            {selectedIndices.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-1">
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedIndices.size})
              </Button>
            )}
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[360px] border border-border rounded-xl">
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="w-10 p-2">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="p-1 rounded hover:bg-muted"
                    >
                      {filteredIndices.every((i) => selectedIndices.has(i)) &&
                      filteredIndices.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </th>
                  <th className="text-left p-2 font-medium">Full Name</th>
                  <th className="text-left p-2 font-medium">Email</th>
                  <th className="text-left p-2 font-medium">Employee Code</th>
                  <th className="text-left p-2 font-medium">Job Title</th>
                  <th className="text-left p-2 font-medium">Department</th>
                  <th className="text-left p-2 font-medium">Employment Type</th>
                  <th className="text-left p-2 font-medium">Reporting Manager</th>
                  <th className="text-left p-2 font-medium">Manager Code</th>
                  <th className="text-left p-2 font-medium">Role</th>
                  <th className="text-left p-2 font-medium">Sub Role</th>
                  <th className="text-left p-2 font-medium">Default Password</th>
                  <th className="text-left p-2 font-medium w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIndices.map((idx) => {
                  const row = previewRows[idx];
                  const isConfirming = pendingDeleteIndex === idx;
                  return (
                    <tr
                      key={idx}
                      className={`border-t border-border hover:bg-muted/30 ${
                        isConfirming ? "bg-destructive/5" : ""
                      }`}
                    >
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => toggleSelect(idx)}
                          className="p-1 rounded hover:bg-muted"
                        >
                          {selectedIndices.has(idx) ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </td>
                      <td className="p-2 whitespace-nowrap">{row.full_name}</td>
                      <td className="p-2 whitespace-nowrap">{row.email}</td>
                      <td className="p-2 whitespace-nowrap">{row.employee_code ?? "—"}</td>
                      <td className="p-2 whitespace-nowrap">{row.job_title ?? "—"}</td>
                      <td className="p-2 whitespace-nowrap">{row.department ?? "—"}</td>
                      <td className="p-2 whitespace-nowrap">
                        {row.employment_type ? formatEmploymentType(row.employment_type) : "—"}
                      </td>
                      <td className="p-2 whitespace-nowrap">{row.reporting_manager_name ?? "—"}</td>
                      <td className="p-2 whitespace-nowrap">{row.reporting_manager_code ?? "—"}</td>
                      <td className="p-2 whitespace-nowrap">
                        {row.external_role ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-muted text-xs">
                            {row.external_role}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-2 whitespace-nowrap">{row.external_sub_role ?? "—"}</td>
                      <td className="p-2 whitespace-nowrap">
                        {row.default_password != null && row.default_password !== "" ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="font-mono">
                              {revealedPasswordIndex === idx ? row.default_password : "••••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedPasswordIndex((p) => (p === idx ? null : idx))
                              }
                              className="p-0.5 rounded hover:bg-muted"
                            >
                              {revealedPasswordIndex === idx ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-2">
                        {isConfirming ? (
                          <span className="flex items-center gap-2 text-sm">
                            Remove {row.full_name || row.email}?
                            <Button variant="ghost" size="sm" onClick={handleCancelDelete}>
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleConfirmDelete(idx)}
                            >
                              Remove
                            </Button>
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRequestDelete(idx)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Button variant="outline" onClick={handleBackToMapping} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Mapping
            </Button>
            <Button
              onClick={() => handleSaveToDb()}
              disabled={importLoading || rowsToSave.length === 0}
            >
              {importLoading ? "Saving..." : `Save ${rowsToSave.length} employees to database →`}
            </Button>
          </div>

          {importFailedDetails.length > 0 && (
            <div className="mt-4 p-3 rounded-lg border border-destructive/50 bg-destructive/5">
              <p className="text-sm font-medium text-destructive mb-2">
                Failed to save ({importFailedDetails.length})
              </p>
              <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                {importFailedDetails.map((f, i) => (
                  <li key={i}>
                    <span className="font-medium">{f.email}</span>: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Conflict modal */}
      <Dialog open={!!conflictModal} onOpenChange={(open) => !open && setConflictModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conflict: employees already exist</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {conflictModal?.existingEmails?.length} employee(s) in your import already exist in the
            database:
          </p>
          <ul className="text-sm list-disc list-inside max-h-32 overflow-y-auto bg-muted/50 rounded-lg p-3">
            {conflictModal?.existingEmails?.slice(0, 20).map((email) => (
              <li key={email}>{email}</li>
            ))}
            {(conflictModal?.existingEmails?.length ?? 0) > 20 && (
              <li className="text-muted-foreground">
                … and {(conflictModal?.existingEmails?.length ?? 0) - 20} more
              </li>
            )}
          </ul>
          <p className="text-sm">How do you want to handle them?</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConflictModal(null)} disabled={importLoading}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleConflictResolve("skip")}
              disabled={importLoading}
            >
              Skip existing
            </Button>
            <Button onClick={() => handleConflictResolve("overwrite")} disabled={importLoading}>
              Overwrite profile data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
