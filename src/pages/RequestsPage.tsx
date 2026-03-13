import { useState, useEffect } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, Plus, Loader2, Inbox, Users } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useAuth } from "@/contexts/AuthContext";
import {
  useMyRequests,
  useTeamRequests,
  useRequestById,
  useIsTopLevel,
  usePendingRequestsCount,
} from "@/hooks/useRequests";
import { RequestCard } from "@/components/requests/RequestCard";
import { RequestDetail } from "@/components/requests/RequestDetail";
import { NewRequestForm } from "@/components/requests/NewRequestForm";
import { ScrollablePillRow } from "@/components/ui/scrollable-pill-row";

type TabValue = "team" | "my" | "new";

export default function RequestsPage() {
  const { user } = useAuth();
  const { hasAnyRole } = useUserRoles();
  const userType = (user as { userType?: string } | null)?.userType;
  const isManager = hasAnyRole(["manager", "team_lead", "hr", "admin"]) || userType === "MANAGER" || userType === "SENIOR_MANAGER";
  const { isTopLevel } = useIsTopLevel();

  const { requestId: requestIdParam } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterFromUrl = searchParams.get("filter");
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<TabValue>(() => {
    if (tabFromUrl === "my") return "my";
    if (isManager && filterFromUrl && ["pending", "forwarded", "approved", "rejected"].includes(filterFromUrl)) return "team";
    return isManager ? "team" : "my";
  });
  const [selectedId, setSelectedId] = useState<string | null>(requestIdParam || null);
  const [teamFilter, setTeamFilter] = useState<string>(() => filterFromUrl && ["pending", "forwarded", "approved", "rejected"].includes(filterFromUrl) ? filterFromUrl : "");

  useEffect(() => {
    if (requestIdParam) setSelectedId(requestIdParam);
  }, [requestIdParam]);

  // Sync active tab when URL tab param changes (e.g. /requests?tab=my)
  useEffect(() => {
    if (tabFromUrl === "my") setActiveTab("my");
    else if (isManager && tabFromUrl === "team") setActiveTab("team");
    else if (tabFromUrl === "new" && !isTopLevel) setActiveTab("new");
  }, [tabFromUrl, isManager, isTopLevel]);

  const { data: myRequests = [], isLoading: myLoading } = useMyRequests();
  const { data: teamRequests = [], isLoading: teamLoading } = useTeamRequests(
    teamFilter && ["pending", "forwarded", "approved", "rejected"].includes(teamFilter) ? teamFilter : undefined
  );
  const { data: selectedRequest, isLoading: detailLoading } = useRequestById(selectedId);
  const { data: pendingCount = 0, refetch: refetchPending } = usePendingRequestsCount();

  // Refetch pending count when tab is focused (e.g. user navigates back to this page)
  useEffect(() => {
    if (isManager) refetchPending();
  }, [activeTab, isManager, refetchPending]);

  const showNewRequestTab = !isTopLevel;

  // If top-level manager, don't leave activeTab on "new" (tab is hidden)
  useEffect(() => {
    if (isTopLevel && activeTab === "new") setActiveTab(isManager ? "team" : "my");
  }, [isTopLevel, activeTab, isManager]);

  const teamFilterOptions = [
    { value: "", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "forwarded", label: "Forwarded" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Requests</h2>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="space-y-4">
        <div className="flex gap-2 mb-4">
          {isManager && (
            <button
              type="button"
              onClick={() => setActiveTab("team")}
              className={cn(
                "flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
                activeTab === "team"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card hover:bg-muted border border-border"
              )}
            >
              <Users className="w-4 h-4" />
              Team Requests
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("my")}
            className={cn(
              "flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
              activeTab === "my"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-card hover:bg-muted border border-border"
            )}
          >
            <FileText className="w-4 h-4" />
            My Requests
          </button>
          {showNewRequestTab && (
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className={cn(
                "flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
                activeTab === "new"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card hover:bg-muted border border-border"
              )}
            >
              <Plus className="w-4 h-4" />
              New Request
            </button>
          )}
        </div>

        {isManager && (
          <TabsContent value="team" className="space-y-4 mt-4">
            <div className="pb-1">
              <ScrollablePillRow>
                {teamFilterOptions.map((opt) => (
                  <button
                    key={opt.value || "all"}
                    type="button"
                    onClick={() => setTeamFilter(opt.value)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      teamFilter === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </ScrollablePillRow>
            </div>
            {teamLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : selectedId ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => { setSelectedId(null); navigate("/requests", { replace: true }); }}
                  className="text-sm text-primary hover:underline"
                >
                  ← Back to list
                </button>
                {detailLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <RequestDetail
                    request={selectedRequest}
                    isManagerView
                    onClose={() => { setSelectedId(null); navigate("/requests", { replace: true }); }}
                    onEditSuccess={() => {}}
                  />
                )}
              </div>
            ) : teamRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No team requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teamRequests.map((req) => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    showSubmitter
                    onClick={() => setSelectedId(req.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="my" className="space-y-4 mt-4">
          {myLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedId ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => { setSelectedId(null); navigate("/requests", { replace: true }); }}
                className="text-sm text-primary hover:underline"
              >
                ← Back to list
              </button>
              {detailLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <RequestDetail
                  request={selectedRequest}
                  onClose={() => { setSelectedId(null); navigate("/requests", { replace: true }); }}
                  onEditSuccess={() => setSelectedId(null)}
                />
              )}
            </div>
          ) : myRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No requests yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myRequests.map((req) => (
                <RequestCard key={req.id} request={req} onClick={() => setSelectedId(req.id)} />
              ))}
            </div>
          )}
        </TabsContent>

        {showNewRequestTab && (
          <TabsContent value="new" className="mt-4">
            <div className="max-w-xl">
              <NewRequestForm onSuccess={() => setActiveTab("my")} />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </motion.div>
  );
}
