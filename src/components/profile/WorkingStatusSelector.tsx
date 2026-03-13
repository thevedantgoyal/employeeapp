import { useState } from "react";
import { Circle, Coffee, Clock, EyeOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateWorkingStatus } from "@/hooks/useProfileManagement";

const STATUS_OPTIONS = [
  { value: "available", label: "Available", icon: Circle, color: "text-emerald-500 fill-emerald-500" },
  { value: "busy", label: "Busy", icon: Circle, color: "text-red-500 fill-red-500" },
  { value: "brb", label: "Be Right Back", icon: Coffee, color: "text-amber-500" },
  { value: "offline", label: "Appear Offline", icon: EyeOff, color: "text-muted-foreground" },
];

interface WorkingStatusSelectorProps {
  currentStatus: string;
}

export const WorkingStatusSelector = ({ currentStatus }: WorkingStatusSelectorProps) => {
  const updateStatus = useUpdateWorkingStatus();
  const [value, setValue] = useState(currentStatus);

  const handleChange = (newStatus: string) => {
    setValue(newStatus);
    updateStatus.mutate(newStatus);
  };

  const currentOption = STATUS_OPTIONS.find((o) => o.value === value) || STATUS_OPTIONS[0];

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-full">
        <SelectValue>
          <span className="flex items-center gap-2">
            <currentOption.icon className={`w-3 h-3 ${currentOption.color}`} />
            {currentOption.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex items-center gap-2">
              <option.icon className={`w-3 h-3 ${option.color}`} />
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
