

interface ScoreDialProps {
  score: number;
  size?: number;
}

export function ScoreDial({ score, size = 120 }: ScoreDialProps) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100);
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600";
    if (score >= 40) return "text-amber-600";
    return "text-red-600";
  };
  
  const getStrokeColor = (score: number) => {
    if (score >= 70) return "stroke-green-600";
    if (score >= 40) return "stroke-amber-600";
    return "stroke-red-600";
  };

  return (
    <div className="flex items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-muted"
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            className={getStrokeColor(score)}
            style={{
              strokeDasharray,
              strokeDashoffset,
              transition: "stroke-dashoffset 0.5s ease-in-out"
            }}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
              {Math.round(score)}
            </div>
            <div className="text-xs text-muted-foreground">/100</div>
          </div>
        </div>
      </div>
    </div>
  );
}
