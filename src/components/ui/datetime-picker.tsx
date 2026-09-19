import * as React from "react";
import { format, parse, isToday, isTomorrow, addDays, nextMonday } from "date-fns";
import { Calendar as CalendarIcon, Clock, Check, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateTimePickerProps {
  dateValue?: string; // Format: "YYYY-MM-DD"
  timeValue?: string; // Format: "HH:mm" (24hr)
  onDateChange: (dateStr: string) => void;
  onTimeChange: (timeStr: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const COMMON_TIME_SLOTS = [
  { label: "09:00 AM", value: "09:00" },
  { label: "10:00 AM", value: "10:00" },
  { label: "11:30 AM", value: "11:30" },
  { label: "01:00 PM", value: "13:00" },
  { label: "02:00 PM", value: "14:00" },
  { label: "03:30 PM", value: "15:30" },
  { label: "05:00 PM", value: "17:00" },
  { label: "06:30 PM", value: "18:30" },
];

export function DateTimePicker({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  placeholder = "Select visit date & time...",
  className,
  disabled = false,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Convert "YYYY-MM-DD" to local Date safely
  const selectedDate = React.useMemo(() => {
    if (!dateValue) return undefined;
    const parts = dateValue.split("-").map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return undefined;
  }, [dateValue]);

  // Parse 24hr "HH:mm" to 12hr parts
  const { hour12, minute, period } = React.useMemo(() => {
    if (!timeValue) return { hour12: 10, minute: "00", period: "AM" as "AM" | "PM" };
    const [hStr, mStr] = timeValue.split(":");
    let h = parseInt(hStr || "10", 10);
    const m = (mStr || "00").slice(0, 2);
    if (isNaN(h)) h = 10;
    const p: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return { hour12: h12, minute: m, period: p };
  }, [timeValue]);

  // Convert selected date back to "YYYY-MM-DD" string
  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, "0");
    const d = String(day.getDate()).padStart(2, "0");
    onDateChange(`${y}-${m}-${d}`);
  };

  // Convert 12hr selection to "HH:mm" 24hr string
  const updateTime = (newHour12: number, newMin: string, newPeriod: "AM" | "PM") => {
    let h24 = newHour12 % 12;
    if (newPeriod === "PM") h24 += 12;
    const hFormatted = String(h24).padStart(2, "0");
    const mFormatted = newMin.padStart(2, "0");
    onTimeChange(`${hFormatted}:${mFormatted}`);
  };

  // Formatted date string for trigger
  const formattedDate = React.useMemo(() => {
    if (!selectedDate) return null;
    try {
      return format(selectedDate, "EEE, dd MMM yyyy");
    } catch {
      return dateValue;
    }
  }, [selectedDate, dateValue]);

  // Formatted time string for trigger
  const formattedTime = React.useMemo(() => {
    if (!timeValue) return null;
    const { hour12, minute, period } = parseTimeString(timeValue);
    return `${String(hour12).padStart(2, "0")}:${minute} ${period}`;
  }, [timeValue]);

  // Relative date pill label
  const relativeDateLabel = React.useMemo(() => {
    if (!selectedDate) return null;
    if (isToday(selectedDate)) return "Today";
    if (isTomorrow(selectedDate)) return "Tomorrow";
    return null;
  }, [selectedDate]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-border/80 bg-card hover:bg-accent/40 text-foreground transition-all duration-150 shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary/20",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <div className="flex items-center gap-3 overflow-hidden text-left">
            {/* Date section */}
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none mb-0.5">
                  Scheduled Date
                </span>
                <span className="font-semibold text-foreground text-xs truncate">
                  {formattedDate || <span className="text-muted-foreground font-normal">Select date</span>}
                </span>
              </div>
              {relativeDateLabel && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  {relativeDateLabel}
                </span>
              )}
            </div>

            {/* Subtle Divider */}
            <div className="h-6 w-px bg-border/80 shrink-0" />

            {/* Time section */}
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none mb-0.5">
                  Visit Time
                </span>
                <span className="font-semibold text-foreground text-xs truncate">
                  {formattedTime || <span className="text-muted-foreground font-normal">Select time</span>}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
            <span className="text-[11px] font-medium hidden sm:inline text-primary">Change</span>
            <ChevronDown className="w-4 h-4" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto p-0 z-[100] bg-card border-border/80 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in-50 zoom-in-95"
      >
        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border/70 max-w-[620px]">
          {/* LEFT: Date Picker & Quick Presets */}
          <div className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-primary" /> Select Date
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = format(new Date(), "yyyy-MM-dd");
                    onDateChange(todayStr);
                  }}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors border",
                    selectedDate && isToday(selectedDate)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 hover:bg-muted text-foreground border-border/60"
                  )}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tmrwStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
                    onDateChange(tmrwStr);
                  }}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors border",
                    selectedDate && isTomorrow(selectedDate)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 hover:bg-muted text-foreground border-border/60"
                  )}
                >
                  Tomorrow
                </button>
              </div>
            </div>

            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDaySelect}
              className="p-1 rounded-xl border border-border/50 bg-background/50 pointer-events-auto"
            />
          </div>

          {/* RIGHT: Time Picker & Presets */}
          <div className="p-3.5 space-y-3 md:w-64 flex flex-col justify-between bg-muted/10">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Visit Time Slot
                </span>
                <span className="text-[10px] font-semibold text-primary">
                  {formattedTime || "10:00 AM"}
                </span>
              </div>

              {/* Quick Preset Time Slots */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-wider">
                  Quick Slots
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {COMMON_TIME_SLOTS.map((slot) => {
                    const isSelected = timeValue === slot.value;
                    return (
                      <button
                        key={slot.value}
                        type="button"
                        onClick={() => onTimeChange(slot.value)}
                        className={cn(
                          "text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center justify-between border transition-all",
                          isSelected
                            ? "bg-amber-500 text-white border-amber-600 shadow-2xs font-bold"
                            : "bg-card hover:bg-accent/60 text-foreground border-border/60"
                        )}
                      >
                        <span>{slot.label}</span>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Time Selection (Hour, Min, AM/PM) */}
              <div className="space-y-1.5 pt-1 border-t border-border/60">
                <span className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-wider">
                  Custom Time
                </span>
                <div className="flex items-center gap-1.5">
                  {/* Hour */}
                  <select
                    aria-label="Hour"
                    value={hour12}
                    onChange={(e) => updateTime(parseInt(e.target.value, 10), minute, period)}
                    className="h-8 px-2 rounded-lg bg-card border border-border/70 text-xs font-bold text-foreground focus:ring-1 focus:ring-primary focus:outline-none flex-1"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}
                      </option>
                    ))}
                  </select>

                  <span className="font-bold text-muted-foreground">:</span>

                  {/* Minute */}
                  <select
                    aria-label="Minute"
                    value={minute}
                    onChange={(e) => updateTime(hour12, e.target.value, period)}
                    className="h-8 px-2 rounded-lg bg-card border border-border/70 text-xs font-bold text-foreground focus:ring-1 focus:ring-primary focus:outline-none flex-1"
                  >
                    {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  {/* AM/PM Toggle */}
                  <div className="flex rounded-lg border border-border/70 overflow-hidden shrink-0 bg-card">
                    <button
                      type="button"
                      onClick={() => updateTime(hour12, minute, "AM")}
                      className={cn(
                        "px-2 py-1 text-[11px] font-bold transition-colors",
                        period === "AM" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTime(hour12, minute, "PM")}
                      className={cn(
                        "px-2 py-1 text-[11px] font-bold transition-colors",
                        period === "PM" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Done Button */}
            <div className="pt-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="w-full h-8 text-xs font-bold gradient-primary rounded-xl"
              >
                Apply Date & Time
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Internal helper to parse time
function parseTimeString(timeStr?: string) {
  if (!timeStr) return { hour12: 10, minute: "00", period: "AM" as "AM" | "PM" };
  const [hStr, mStr] = timeStr.split(":");
  let h = parseInt(hStr || "10", 10);
  const m = (mStr || "00").slice(0, 2);
  if (isNaN(h)) h = 10;
  const p: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12: h12, minute: m, period: p };
}
