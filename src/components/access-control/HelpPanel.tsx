import { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface HelpSection {
  title: string;
  icon?: "check" | "alert" | "info";
  content: string[];
}

interface HelpPanelProps {
  title?: string;
  sections: HelpSection[];
}

const iconMap = {
  check: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />,
  alert: <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />,
  info: <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />,
};

const HelpPanel = ({ title = "Ajuda", sections }: HelpPanelProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>{title}</span>
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 space-y-3 text-xs">
          {sections.map((section, i) => (
            <div key={i}>
              <p className="font-semibold text-foreground mb-1">{section.title}</p>
              <ul className="space-y-1">
                {section.content.map((item, j) => (
                  <li key={j} className="flex items-start gap-1.5 text-muted-foreground leading-relaxed">
                    {iconMap[section.icon || "info"]}
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default HelpPanel;
