// icons/services.ts

export {
  Target as CareerStrategyIcon,
  FileText as ResumeReviewIcon,
  MessageSquare as MockInterviewIcon,
  BriefcaseBusiness as StartupConsultationIcon,
  Users as LeadershipCoachingIcon,
} from "lucide-react";

import {
  BookOpen,
  Briefcase,
  Calculator,
  Dumbbell,
  Globe,
  Heart,
  MessageCircle,
  Music,
  Palette,
  Star,
  Target,
  Video,
  type LucideIcon,
} from "lucide-react";

/**
 * The canonical icon set for creator services. `services.icon_name` in the
 * DB stores one of these keys (default 'Target'); the wizard picker, the
 * preview card and the public page all resolve through this map.
 */
export const SERVICE_ICON_MAP: Record<string, LucideIcon> = {
  Target,
  Video,
  BookOpen,
  MessageCircle,
  Dumbbell,
  Star,
  Briefcase,
  Heart,
  Music,
  Palette,
  Calculator,
  Globe,
};

export const SERVICE_ICON_NAMES = Object.keys(SERVICE_ICON_MAP);
