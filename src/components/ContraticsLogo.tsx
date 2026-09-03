import React from 'react';

interface ContraticsLogoProps {
  theme: 'light' | 'dark';
  variant?: 'login' | 'sidebar';
  collapsed?: boolean;
}

export default function ContraticsLogo({ theme, variant = 'sidebar', collapsed = false }: ContraticsLogoProps) {
  const isDark = theme === 'dark';

  if (variant === 'login') {
    const logoSrc = isDark ? '/SOF_LOGO_PT_Cor_FundoEscuro.png' : '/sof-logo.png';
    return (
      <div className="flex flex-col items-center justify-center text-center select-none font-sans" id="contratics-logo-login">
        {/* Dynamic theme-aware SOF logo above the app name, sized wide to match the width of the CONTRATICS text */}
        <img 
          src={logoSrc} 
          alt="SOF Logo" 
          className="w-64 sm:w-[290px] h-auto object-contain mb-6"
          referrerPolicy="no-referrer"
        />
        {/* Large Typography matching the uploaded image */}
        <h1 
          className="text-[44px] sm:text-[52px] font-black tracking-[0.08em] leading-none mb-3 font-display transition-colors duration-200"
          style={{ 
            color: isDark ? '#ffffff' : '#222946',
            fontWeight: 800 
          }}
        >
          CONTRATICS
        </h1>
        
        {/* Subtitle structured in two lines exactly as in the uploaded image layout */}
        <div 
          className="text-xs sm:text-[13.5px] font-medium tracking-wide leading-relaxed font-sans max-w-[340px] sm:max-w-[400px] transition-colors duration-200"
          style={{ 
            color: isDark ? 'rgba(255, 255, 255, 0.85)' : '#4a547a' 
          }}
        >
          <p>Sistema de Gestão de Contratos e</p>
          <p className="mt-0.5">Planejamento de Contratações de TIC</p>
        </div>
      </div>
    );
  }

  const logoSrc = isDark ? '/SOF_LOGO_PT_Cor_FundoEscuro.png' : '/sof-logo.png';

  // Sidebar variant with fluid transition
  return (
    <div 
      className={`flex items-center select-none font-sans overflow-hidden transition-all duration-500 ease-in-out ${
        collapsed ? 'justify-center w-full px-0 gap-0' : 'gap-3.5 px-0'
      }`} 
      id={collapsed ? "contratics-logo-sidebar-collapsed" : "contratics-logo-sidebar"}
      title={collapsed ? "Contratics" : undefined}
    >
      {/* Theme-aware SOF logo icon */}
      <img 
        src={logoSrc} 
        alt="SOF Logo" 
        className={`object-contain shrink-0 transition-all duration-500 ease-in-out ${
          collapsed ? 'h-9 w-auto max-w-[50px]' : 'h-10 w-auto'
        }`}
        referrerPolicy="no-referrer"
      />
      
      {/* Brand wordmark with smooth fade and width transition */}
      <div 
        className={`flex flex-col text-left overflow-hidden transition-all duration-500 ease-in-out ${
          collapsed 
            ? 'opacity-0 max-w-0 -translate-x-3 pointer-events-none' 
            : 'opacity-100 max-w-[140px] translate-x-0'
        }`}
      >
        <span 
          className="text-[17px] font-black tracking-[0.06em] leading-none font-display transition-colors duration-200 uppercase whitespace-nowrap"
          style={{ 
            color: isDark ? '#ffffff' : '#1e293b'
          }}
        >
          CONTRATICS
        </span>
      </div>
    </div>
  );
}
