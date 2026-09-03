/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ArrowRight, CloudUpload, Check, Calendar } from 'lucide-react';

// ==========================================
// 1. RE-UI BADGE COMPONENT
// ==========================================
export type BadgeVariant = 'success' | 'warning' | 'info' | 'danger' | 'ongoing' | 'neutral';

interface ReUIBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  id?: string;
}

export function ReUIBadge({ variant = 'neutral', children, id }: ReUIBadgeProps) {
  const styles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-sans',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-sans',
    info: 'bg-sky-500/10 border-sky-500/30 text-sky-400 font-sans',
    ongoing: 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-sans',
    danger: 'bg-rose-500/10 border-rose-500/30 text-rose-400 font-sans',
    neutral: 'bg-slate-500/10 border-slate-500/20 text-slate-300 font-sans',
  };

  const dots: Record<BadgeVariant, string> = {
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    info: 'bg-sky-400',
    ongoing: 'bg-blue-400',
    danger: 'bg-rose-400',
    neutral: 'bg-slate-400',
  };

  return (
    <span
      id={id}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border tracking-wide shadow-sm animate-in fade-in duration-100 ${styles[variant]}`}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {variant !== 'neutral' && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-65 ${dots[variant]}`}></span>
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dots[variant]}`}></span>
      </span>
      <span className="leading-none">{children}</span>
    </span>
  );
}

// ==========================================
// 2. RE-UI CARD / FRAME COMPONENT
// ==========================================
interface ReUICardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  hoverGlow?: boolean;
  action?: React.ReactNode;
  id?: string;
}

export function ReUICard({
  children,
  title,
  subtitle,
  className = '',
  hoverGlow = true,
  action,
  id,
}: ReUICardProps) {
  return (
    <div
      id={id}
      className={`relative bg-surface border border-outline rounded-xl p-5 md:p-6 overflow-hidden transition-all duration-300 shadow-sm
        ${hoverGlow ? 'hover:border-primary/30 hover:shadow-md' : ''}
        ${className}`}
    >
      {/* Decorative top-right glassmorphic gradient */}
      <div className="absolute top-0 right-0 w-28 h-28 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>

      {(title || subtitle || action) && (
        <div className="flex justify-between items-start gap-4 mb-5 border-b border-outline-variant/30 pb-3 z-10 relative">
          <div className="space-y-0.5">
            {title && (
              <h4 className="font-bold text-on-surface text-xs md:text-sm tracking-tight font-display flex items-center gap-2">
                {title}
              </h4>
            )}
            {subtitle && (
              <p className="text-[10px] text-on-surface-variant leading-snug font-sans">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="relative z-10 w-full font-sans">{children}</div>
    </div>
  );
}

// ==========================================
// 3. RE-UI ACCORDION COMPONENT
// ==========================================
interface ReUIAccordionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  badge?: React.ReactNode;
  id?: string;
}

export function ReUIAccordion({
  title,
  children,
  defaultExpanded = false,
  className = '',
  badge,
  id,
}: ReUIAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);

  return (
    <div
      id={id}
      className={`border border-outline rounded-lg overflow-hidden bg-surface transition-all ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-surface-container-low hover:bg-surface-container text-left transition-colors select-none"
      >
        <div className="flex items-center gap-3.5 min-w-0 pr-2">
          <span className="font-bold text-on-surface text-xs tracking-tight transition-all truncate">
            {title}
          </span>
          {badge}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="text-on-surface-variant flex-shrink-0"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="px-5 py-4 border-t border-outline text-xs text-on-surface/90 leading-relaxed font-sans bg-surface-container-lowest">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// 4. RE-UI TIMELINE COMPONENT
// ==========================================
export interface TimelineItem {
  id: string;
  date: string;
  title: string;
  description: string;
  badgeText?: string;
  badgeVariant?: BadgeVariant;
  tag?: string;
}

interface ReUITimelineProps {
  items: TimelineItem[];
  id?: string;
}

export function ReUITimeline({ items, id }: ReUITimelineProps) {
  return (
    <div id={id} className="relative pl-6 border-l-2 border-outline-variant/40 space-y-7 py-2 font-sans ml-3">
      {items.map((item, index) => (
        <div key={item.id} className="relative animate-in fade-in duration-200">
          {/* Circular Node marker */}
          <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface-container border-2 border-primary shadow-sm z-10">
            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
          </span>

          <div className="space-y-1 bg-surface-container-low/40 p-4 border border-outline-variant/30 rounded-xl hover:border-primary/20 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-outline-variant/10 pb-1.5 mb-1.5">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-primary flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {item.date}
              </span>
              {item.badgeText && (
                <ReUIBadge variant={item.badgeVariant || 'neutral'}>
                  {item.badgeText}
                </ReUIBadge>
              )}
            </div>
            
            <h5 className="font-bold text-on-surface text-xs leading-snug">
              {item.title}
            </h5>
            <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
              {item.description}
            </p>
            {item.tag && (
              <div className="pt-1.5">
                <span className="inline-block bg-surface-container px-2 py-0.5 rounded font-mono text-[9px] text-primary">
                  {item.tag}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// 5. RE-UI STEPPER COMPONENT
// ==========================================
export interface Step {
  label: string;
  description?: string;
  status: 'complete' | 'active' | 'upcoming';
}

interface ReUIStepperProps {
  steps: Step[];
  id?: string;
}

export function ReUIStepper({ steps, id }: ReUIStepperProps) {
  return (
    <div id={id} className="w-full flex items-center gap-3 py-3 overflow-x-auto scrollbar-none font-sans select-none">
      {steps.map((step, idx) => {
        const isComplete = step.status === 'complete';
        const isActive = step.status === 'active';

        return (
          <React.Fragment key={idx}>
            <div className="flex items-center gap-2 shrink-0 min-w-[130px] pr-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center border font-mono text-[10px] font-bold transition-all shrink-0
                  ${isComplete ? 'bg-primary/20 border-primary text-primary shadow-sm' : ''}
                  ${isActive ? 'bg-primary border-primary text-on-primary font-extrabold shadow animate-pulse' : ''}
                  ${step.status === 'upcoming' ? 'bg-surface-container-low border-outline-variant text-on-surface-variant/60' : ''}
                `}
              >
                {isComplete ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
              </div>

              <div className="min-w-0 leading-tight">
                <div
                  className={`text-[11px] font-bold truncate transition-all
                    ${isActive ? 'text-primary' : ''}
                    ${isComplete ? 'text-on-surface/90' : ''}
                    ${step.status === 'upcoming' ? 'text-on-surface-variant/50' : ''}
                  `}
                >
                  {step.label}
                </div>
                {step.description && (
                  <div className="text-[8px] text-on-surface-variant/70 font-medium truncate">
                    {step.description}
                  </div>
                )}
              </div>
            </div>

            {idx < steps.length - 1 && (
              <ArrowRight
                className={`w-4 h-4 shrink-0 transition-opacity
                  ${isComplete ? 'text-primary opacity-90' : 'text-on-surface-variant/30 opacity-50'}
                `}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ==========================================
// 6. RE-UI FILES DROP-ZONE COMPONENT
// ==========================================
interface ReUIDropzoneProps {
  onFileSelect: (fileName: string) => void;
  allowedExtensions?: string;
  isUploading?: boolean;
  id?: string;
}

export function ReUIDropzone({ onFileSelect, allowedExtensions = '.pdf, .csv, .xlsx', isUploading = false, id }: ReUIDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      onFileSelect(file.name);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0].name);
    }
  };

  return (
    <div
      id={id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 select-none flex flex-col items-center justify-center gap-2.5 font-sans
        ${isDragOver ? 'border-primary bg-primary/5 scale-[0.99] shadow-sm' : 'border-outline-variant hover:border-primary/40 bg-surface-container-low/50 hover:bg-surface-container-low'}
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept={allowedExtensions}
        className="hidden"
      />
      
      <div className={`p-3 rounded-full border border-outline bg-surface transition-all ${isDragOver ? 'border-primary text-primary' : 'text-on-surface-variant'}`}>
        <CloudUpload className={`w-5 h-5 ${isUploading ? 'animate-bounce' : ''}`} />
      </div>

      <div>
        <p className="font-bold text-on-surface text-[11px]">
          Arrastar & soltar documento ou <span className="text-primary underline hover:text-primary-active">Navegar local</span>
        </p>
        <p className="text-[9px] text-on-surface-variant/80 mt-1">
          Formatos autorizados: {allowedExtensions} &bull; Limite de 15MB
        </p>
      </div>
    </div>
  );
}

// ==========================================
// 7. RE-UI GLOWING PROGRESS BAR
// ==========================================
interface ReUIProgressProps {
  value: number; // 0 to 100
  max?: number;
  showText?: boolean;
  className?: string;
  id?: string;
}

export function ReUIProgress({ value, max = 100, showText = false, className = '', id }: ReUIProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div id={id} className={`w-full font-sans ${className}`}>
      {showText && (
        <div className="flex justify-between items-center text-[9px] font-mono font-bold text-on-surface-variant mb-1 ml-1">
          <span>COMPLETO</span>
          <span className="text-primary">{percentage.toFixed(0)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-surface border border-outline rounded-full overflow-hidden relative shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full relative"
        >
          {/* Subtle glowing reflection line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/20"></div>
        </motion.div>
      </div>
    </div>
  );
}
