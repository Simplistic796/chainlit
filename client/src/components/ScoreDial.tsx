interface ScoreDialProps {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ScoreDial({ score, size = "md", className }: ScoreDialProps) {
  const normalizedScore = Math.min(Math.max(score, 0), 100);
  
  // Calculate color based on score ranges
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
  
  // Size configurations
  const sizeConfig = {
    sm: { radius: 45, strokeWidth: 6, fontSize: "text-lg", containerSize: "w-24 h-24" },
    md: { radius: 60, strokeWidth: 8, fontSize: "text-2xl", containerSize: "w-32 h-32" },
    lg: { radius: 80, strokeWidth: 10, fontSize: "text-4xl", containerSize: "w-44 h-44" }
  };
  
  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div className={`relative flex items-center justify-center ${config.containerSize} ${className || ''}`}>
      <svg
        className="transform -rotate-90"
        width="100%"
        height="100%"
        viewBox={`0 0 ${(config.radius + config.strokeWidth) * 2} ${(config.radius + config.strokeWidth) * 2}`}
      >
        {/* Background circle */}
        <circle
          cx={config.radius + config.strokeWidth}
          cy={config.radius + config.strokeWidth}
          r={config.radius}
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          fill="transparent"
          className="text-gray-300 opacity-20"
        />
        {/* Progress circle */}
        <circle
          cx={config.radius + config.strokeWidth}
          cy={config.radius + config.strokeWidth}
          r={config.radius}
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`transition-all duration-1000 ease-out ${getStrokeColor(normalizedScore)}`}
        />
      </svg>
      
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold tabular-nums ${config.fontSize} ${getScoreColor(normalizedScore)}`}>
          {Math.round(normalizedScore)}
        </span>
        <span className="text-xs text-gray-500 font-medium">SCORE</span>
      </div>
    </div>
  );
}
