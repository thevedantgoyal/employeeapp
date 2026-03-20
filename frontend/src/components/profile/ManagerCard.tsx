export interface ManagerCardProps {
  full_name: string;
  job_title: string | null;
  avatar_url: string | null;
}

function getInitials(fullName: string): string {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function ManagerCard({ full_name, job_title, avatar_url }: ManagerCardProps) {
  const initials = getInitials(full_name);

  return (
    <div className="flex items-center gap-4 p-4">
      <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/20 flex-shrink-0 flex items-center justify-center">
        {avatar_url?.trim() ? (
          <img
            src={avatar_url.trim()}
            alt={full_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm font-semibold text-primary">
            {initials}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">Reporting Manager</p>
        <p className="font-semibold truncate">{full_name}</p>
        <p className="text-sm text-muted-foreground truncate">
          {job_title || "Manager"}
        </p>
      </div>
    </div>
  );
}
