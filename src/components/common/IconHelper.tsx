import React from 'react';
import {
  Sliders,
  Trash2,
  Zap,
  Cpu,
  ShieldCheck,
  Terminal,
  Gauge,
  HardDrive,
  BatteryCharging,
  Activity,
  Flame,
  Crosshair,
  Sparkles,
  MousePointerClick,
  Crown,
  Monitor,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Play,
} from 'lucide-react';

interface IconHelperProps {
  name: string;
  className?: string;
}

export const IconHelper: React.FC<IconHelperProps> = ({ name, className = 'w-5 h-5' }) => {
  switch (name) {
    case 'Sliders':
      return <Sliders className={className} />;
    case 'Trash2':
      return <Trash2 className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'Cpu':
      return <Cpu className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'Terminal':
      return <Terminal className={className} />;
    case 'Gauge':
      return <Gauge className={className} />;
    case 'HardDrive':
      return <HardDrive className={className} />;
    case 'BatteryCharging':
      return <BatteryCharging className={className} />;
    case 'Activity':
      return <Activity className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'Crosshair':
      return <Crosshair className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'MousePointerClick':
      return <MousePointerClick className={className} />;
    case 'Crown':
      return <Crown className={className} />;
    case 'Monitor':
      return <Monitor className={className} />;
    default:
      return <Zap className={className} />;
  }
};
