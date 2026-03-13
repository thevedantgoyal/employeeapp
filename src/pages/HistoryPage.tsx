import { useState } from "react";
import { motion } from "framer-motion";
import { History, Loader2, FileText } from "lucide-react";
import { useContributions, groupContributionsByDate } from "@/hooks/useContributions";
import { HistoryItem } from "@/components/cards/HistoryItem";
import { ScrollablePillRow } from "@/components/ui/scrollable-pill-row";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
};

const HistoryPage = () => {
  const { data: contributions, isLoading, error } = useContributions();
  const [filterStatus, setFilterStatus] = useState<string>("");

  const groupedContributions = contributions
    ? groupContributionsByDate(
        filterStatus ? contributions.filter((c) => c.status === filterStatus) : contributions
      )
    : [];

  const filters = [
    { value: "", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <>
      {/* Filter Pills — Option C: horizontal scroll with fade edges */}
      <div className="mb-4 pb-2">
        <ScrollablePillRow>
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setFilterStatus(filter.value)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                filterStatus === filter.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted border border-border"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </ScrollablePillRow>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">Failed to load contributions</div>
      ) : groupedContributions.length > 0 ? (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
          {groupedContributions.map((group) => (
            <motion.section key={group.label} variants={itemVariants}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <motion.div key={item.id} variants={itemVariants}>
                    <HistoryItem
                      icon={FileText}
                      title={item.title}
                      status={(item.status as "pending" | "approved" | "rejected") || "pending"}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))}
        </motion.div>
      ) : (
        <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
          <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold">No contributions yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {filterStatus ? "Try a different filter" : "Add your first work update to start tracking your progress"}
          </p>
        </div>
      )}
    </>
  );
};

export default HistoryPage;
