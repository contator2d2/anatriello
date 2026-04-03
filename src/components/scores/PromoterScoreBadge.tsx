import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Star } from "lucide-react";

interface Props {
  score: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

function getScoreInfo(score: number) {
  if (score >= 90) return { label: 'Excelente', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300' };
  if (score >= 70) return { label: 'Bom', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300' };
  if (score >= 50) return { label: 'Atenção', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300' };
  return { label: 'Crítico', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300' };
}

export const PromoterScoreBadge = ({ score, size = 'sm', showLabel = false }: Props) => {
  const info = getScoreInfo(score);
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`gap-1 ${info.className} ${size === 'md' ? 'text-sm px-3 py-1' : 'text-xs'}`}>
          <Star className={size === 'md' ? 'h-4 w-4' : 'h-3 w-3'} />
          {score.toFixed(0)}
          {showLabel && <span className="ml-1">{info.label}</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>Score: {score.toFixed(1)} — {info.label}</p>
      </TooltipContent>
    </Tooltip>
  );
};
