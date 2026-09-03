import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text?: string | null;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  label,
  className = '',
  iconOnly = true
}) => {
  const [copied, setCopied] = useState(false);

  if (!text || text === '-' || text === 'Não informado' || text === 'N/A' || text === 'Sem DFD' || text === 'Sem SEI' || text === 'Sem Contrato') {
    return null;
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    let success = false;

    // Try Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch (err) {
        console.warn('Clipboard API failed, trying fallback:', err);
      }
    }

    // Fallback if Clipboard API fails
    if (!success) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 transition-all cursor-pointer shrink-0 group/copy ${className}`}
      title={copied ? 'Copiado para a área de transferência!' : `Copiar ${label ? `${label}: ` : ''}${text} para pesquisar no SEI`}
      aria-label={`Copiar ${text}`}
    >
      {copied ? (
        <span className="inline-flex items-center gap-1 text-emerald-500 font-bold animate-in zoom-in-50 duration-150">
          <Check className="w-3 h-3 stroke-[2.5]" />
          <span>Copiado!</span>
        </span>
      ) : (
        <>
          <Copy className="w-3 h-3 text-primary/80 group-hover/copy:text-primary transition-colors" />
          {!iconOnly && <span>Copiar</span>}
        </>
      )}
    </button>
  );
};

export const CopyableText: React.FC<{
  text?: string | null;
  label?: string;
  className?: string;
  textClassName?: string;
}> = ({ text, label, className = '', textClassName = '' }) => {
  if (!text || text === '-' || text === 'Não informado' || text === 'N/A' || text === 'Sem DFD' || text === 'Sem SEI' || text === 'Sem Contrato') {
    return <span className={textClassName}>{text || '-'}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 max-w-full ${className}`}>
      <span className={textClassName}>{text}</span>
      <CopyButton text={text} label={label} />
    </span>
  );
};

