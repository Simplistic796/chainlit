export type ScoreDialProps = {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function ScoreDial({ score, size = "lg", className }: ScoreDialProps) {
  const normalized = Math.min(Math.max(score, 0), 100);

  // Use exact sizing to avoid clipping and ensure perfect centering
  const sizeConfig = {
    sm: { box: 128, strokeWidth: 8, fontSize: 22 },
    md: { box: 176, strokeWidth: 10, fontSize: 28 },
    lg: { box: 224, strokeWidth: 12, fontSize: 36 },
  } as const;
  const cfg = sizeConfig[size];
  const radius = (cfg.box - cfg.strokeWidth) / 2; // keep stroke fully inside viewBox

  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (normalized / 100) * circumference;

  const strokeColorClass =
    normalized >= 70 ? "stroke-green-500" : normalized >= 40 ? "stroke-amber-500" : "stroke-red-500";
  const textColorClass =
    normalized >= 70 ? "fill-green-600" : normalized >= 40 ? "fill-amber-600" : "fill-red-600";

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className || ""}`}
      style={{ width: cfg.box, height: cfg.box }}
    >
      <svg className="block transform -rotate-90" width={cfg.box} height={cfg.box} viewBox={`0 0 ${cfg.box} ${cfg.box}`}>
        <circle
          cx={cfg.box / 2}
          cy={cfg.box / 2}
          r={radius}
          className="stroke-muted"
          strokeWidth={cfg.strokeWidth}
          fill="none"
          strokeLinecap="round"
          style={{ opacity: 0.25 }}
        />
        <circle
          cx={cfg.box / 2}
          cy={cfg.box / 2}
          r={radius}
          className={`${strokeColorClass} transition-all duration-700`}
          strokeWidth={cfg.strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${textColorClass}`} style={{ fontWeight: 700, fontSize: cfg.fontSize }}>{Math.round(normalized)}</span>
        <span className="text-xs text-muted-foreground font-medium">SCORE</span>
      </div>
    </div>
  );
}
