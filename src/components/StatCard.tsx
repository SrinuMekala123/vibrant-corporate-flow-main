import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  trend?: "up" | "down" | "flat";
  icon: LucideIcon;
  gradient?: "primary" | "warm" | "cool";
  delay?: number;
  className?: string;
  titleClassName?: string;
  iconClassName?: string;
  iconBgClassName?: string;
}

const gradientMap = {
  primary: "gradient-primary",
  warm: "gradient-warm",
  cool: "gradient-cool",
};

export function StatCard({ 
  label, 
  value, 
  unit, 
  change, 
  trend, 
  icon: Icon, 
  gradient = "primary", 
  delay = 0,
  className,
  titleClassName,
  iconClassName,
  iconBgClassName
}: StatCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        "glass-card rounded-2xl p-6 border border-border/60 hover:border-primary/30 hover:shadow-glow transition-all duration-300 relative overflow-hidden group cursor-pointer",
        className
      )}
    >
      {/* Decorative ambient light behind card */}
      <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-all duration-300 filter blur-xl" />

      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 duration-300", iconBgClassName || gradientMap[gradient])}>
          <Icon className={cn("w-5 h-5 text-white", iconClassName)} />
        </div>
        {change !== undefined && (
          <div className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-muted/65 border border-border/40", trendColor)}>
            <TrendIcon className="w-3.5 h-3.5" />
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      <div className="space-y-1 relative z-10">
        <p className="text-3xl font-extrabold tracking-tight text-foreground">
          {value}
          {unit && <span className="text-sm font-semibold text-muted-foreground ml-1">{unit}</span>}
        </p>
        <p className={cn("text-xs uppercase font-extrabold tracking-wider text-muted-foreground", titleClassName)}>{label}</p>
      </div>
    </motion.div>
  );
}
