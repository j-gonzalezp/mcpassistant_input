// C:\Users\joaqu\mcpfiles\MCP-SuperAssistant-main\pages\content\src\components\sidebar\Sidebar.tsx
import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSiteAdapter } from '@src/adapters/adapterRegistry';
import ServerStatus from './ServerStatus/ServerStatus';
import AvailableTools from './AvailableTools/AvailableTools';
import InstructionManager from './Instructions/InstructionManager';
import InputArea from './InputArea/InputArea';
import { useBackgroundCommunication } from './hooks/backgroundCommunication';
import { logMessage, debugShadowDomStyles } from '@src/utils/helpers';
import { Typography, ToggleWithoutLabel, ResizeHandle, Icon, Button } from './ui';
import { cn } from '@src/lib/utils';
import { Card, CardContent } from '@src/components/ui/card';
import type { SidebarPreferences } from '@src/utils/storage';
import { getSidebarPreferences, saveSidebarPreferences } from '@src/utils/storage';

const mcpTools = typeof window !== 'undefined' ? (window as any).mcpTools || {} : {};
const getMasterToolDict = () => mcpTools.getMasterToolDict?.() || {};
const clearAllTools = (callIds?: string[]) => mcpTools.clearAllTools?.(callIds);

type Theme = SidebarPreferences['theme'];
const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];

const SIDEBAR_MINIMIZED_WIDTH = 56;
const SIDEBAR_DEFAULT_WIDTH = 320;

interface ContentScriptApi {
  setAutoScrollState?: (isActive: boolean) => void;
  getAutoScrollState?: () => boolean;
}

const Sidebar: React.FC = () => {
  const adapter = useSiteAdapter();
  const communicationMethods = useBackgroundCommunication();
  const serverStatus = communicationMethods?.serverStatus || 'disconnected';
  const availableTools = communicationMethods?.availableTools || [];
  // const sendMessage = communicationMethods?.sendMessage || (async () => 'Error: Communication unavailable'); // sendMessage from useBackgroundCommunication is used by AvailableTools
  const refreshTools = communicationMethods?.refreshTools || (async () => []);

  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'availableTools' | 'instructions'>('availableTools');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isPushMode, setIsPushMode] = useState(false);
  // const [autoSubmit, setAutoSubmit] = useState(false); // ELIMINADO - Se gestionará en InstructionButtons o similar
  const [theme, setTheme] = useState<Theme>('system');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInitialRender, setIsInitialRender] = useState(true);
  const [isInputMinimized, setIsInputMinimized] = useState(false);
  const [isComponentLoadingComplete, setIsComponentLoadingComplete] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const previousWidthRef = useRef(SIDEBAR_DEFAULT_WIDTH);
  const transitionTimerRef = useRef<number | null>(null);
  const mcpContentScriptApi = useRef<ContentScriptApi | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).mcpContentScriptApi) {
      mcpContentScriptApi.current = (window as any).mcpContentScriptApi;
    } else {
      logMessage('[Sidebar] mcpContentScriptApi not found on window.');
    }
  }, []);
  
  const applyTheme = useCallback((selectedTheme: Theme) => {
    const sidebarManager = (window as any).activeSidebarManager;
    if (!sidebarManager) return;
    sidebarManager.applyThemeClass(selectedTheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => { if (theme === 'system') applyTheme('system'); };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await getSidebarPreferences();
        logMessage(`[Sidebar] Loaded preferences: ${JSON.stringify(preferences)}`);
        setIsPushMode(preferences.isPushMode);
        setSidebarWidth(preferences.sidebarWidth || SIDEBAR_DEFAULT_WIDTH);
        setIsMinimized(preferences.isMinimized ?? false);
        // setAutoSubmit(preferences.autoSubmit ?? false); // ELIMINADO
        setTheme(preferences.theme || 'system');
        setAutoScrollEnabled(preferences.isAutoScrollActive ?? false);
        if (mcpContentScriptApi.current?.getAutoScrollState) {
          setAutoScrollEnabled(mcpContentScriptApi.current.getAutoScrollState());
        }
        previousWidthRef.current = preferences.sidebarWidth || SIDEBAR_DEFAULT_WIDTH;
      } catch (error) {
        logMessage(`[Sidebar] Error loading preferences: ${error}`);
      } finally {
        isInitialLoadRef.current = false;
        setTimeout(() => {
          setIsInitialRender(false);
          setIsComponentLoadingComplete(true);
        }, 200);
      }
    };
    loadPreferences();
    const timeoutId = setTimeout(() => {
      if (!isComponentLoadingComplete) {
        setIsComponentLoadingComplete(true);
        setIsInitialRender(false);
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (isInitialLoadRef.current) return;
    const saveTimeout = setTimeout(() => {
      saveSidebarPreferences({
        isPushMode,
        sidebarWidth,
        isMinimized,
        // autoSubmit, // ELIMINADO
        theme,
      }).catch(error => {
        logMessage(`[Sidebar] Error saving preferences: ${error}`);
      });
    }, 300);
    return () => clearTimeout(saveTimeout);
  }, [isPushMode, sidebarWidth, isMinimized, /* autoSubmit, */ theme]);

  const { 
    startTransition: localStartTransition, 
    handleResize: localHandleResize, 
    handlePushModeToggle: localHandlePushModeToggle, 
    handleAutoScrollToggle: localHandleAutoScrollToggle, 
    handleRefreshTools: localHandleRefreshTools, 
    handleThemeToggle: localHandleThemeToggle, 
    getCurrentThemeIcon: localGetCurrentThemeIcon 
  } = SidebarInternalFunctions(
    transitionTimerRef, setIsTransitioning, 
    isPushMode, sidebarRef, isResizingRef, setSidebarWidth, previousWidthRef, 
    setIsPushMode, 
    setAutoScrollEnabled, mcpContentScriptApi, 
    setIsRefreshing, refreshTools, 
    theme, setTheme
  );

  const toggleMinimize = () => {
    localStartTransition();
    setIsMinimized(!isMinimized);
  };
  const toggleInputMinimize = () => setIsInputMinimized(prev => !prev);
  
  const formattedTools = availableTools.map(tool => ({
    name: tool.name,
    schema: tool.schema,
    description: tool.description || '',
  }));

  if (typeof window !== 'undefined') (window as any).availableTools = availableTools;

  return (
    <div
      ref={sidebarRef}
      className={cn('fixed top-0 right-0 h-screen bg-white dark:bg-slate-900 shadow-lg z-50 flex flex-col border-l border-slate-200 dark:border-slate-700 sidebar', isPushMode && 'push-mode', isResizingRef.current && 'resizing', isMinimized && 'collapsed', isTransitioning && 'sidebar-transitioning', isInitialRender && 'initial-render')}
      style={{ width: isMinimized ? `${SIDEBAR_MINIMIZED_WIDTH}px` : `${sidebarWidth}px` }}
    >
      {!isMinimized && <ResizeHandle onResize={localHandleResize} minWidth={SIDEBAR_DEFAULT_WIDTH} maxWidth={500} className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 z-[60] transition-colors duration-300" />}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between flex-shrink-0 shadow-sm sidebar-header">
        {!isMinimized ? (
          <>
            <div className="flex items-center space-x-2">
              <a href="https://mcpsuperassistant.ai/" target="_blank" rel="noopener noreferrer" aria-label="Visit MCP Super Assistant Website" className="block">
                <img src={chrome.runtime.getURL('icon-34.png')} alt="MCP Logo" className="w-8 h-8 rounded-md " />
              </a>
              {isComponentLoadingComplete ? (
                <>
                  <a href="https://mcpsuperassistant.ai/" target="_blank" rel="noopener noreferrer" className="text-slate-800 dark:text-slate-100 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150 no-underline" aria-label="Visit MCP Super Assistant Website">
                    <Typography variant="h4" className="font-semibold">MCP SuperAssistant</Typography>
                  </a>
                  <a href="https://mcpsuperassistant.ai/" target="_blank" rel="noopener noreferrer" className="ml-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors duration-150" aria-label="Visit MCP Super Assistant Website">
                    <Icon name="arrow-up-right" size="xs" className="inline-block align-baseline" />
                  </a>
                </>
              ) : (
                <Typography variant="h4" className="font-semibold text-slate-800 dark:text-slate-100">MCP SuperAssistant</Typography>
              )}
            </div>
            <div className="flex items-center space-x-2 pr-1">
              <Button variant="ghost" size="icon" onClick={localHandleThemeToggle} aria-label={`Toggle theme (current: ${theme})`} className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all duration-200 hover:scale-105">
                <Icon name={localGetCurrentThemeIcon()} size="sm" className="transition-all text-indigo-600 dark:text-indigo-400" />
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleMinimize} aria-label="Minimize sidebar" className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all duration-200 hover:scale-105">
                <Icon name="chevron-right" className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              </Button>
            </div>
          </>
        ) : (
          <Button variant="ghost" size="icon" onClick={toggleMinimize} aria-label="Expand sidebar" className="mx-auto hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all duration-200 hover:scale-110">
            <Icon name="chevron-left" className="h-4 w-4 text-slate-700 dark:text-slate-300" />
          </Button>
        )}
      </div>

      <div className="sidebar-inner-content flex-1 relative overflow-hidden bg-white dark:bg-slate-900">
        <div
          ref={contentRef}
          className={cn('absolute top-0 bottom-0 right-0 transition-transform duration-200 ease-in-out', isMinimized ? 'translate-x-full' : 'translate-x-0', isTransitioning && 'will-change-transform')}
          style={{ width: `${sidebarWidth}px` }}
        >
          <div className="flex flex-col h-full">
            <div className="py-4 px-4 space-y-4 overflow-y-auto flex-shrink-0">
              <ServerStatus status={serverStatus} />
              <Card className="sidebar-card border-slate-200 dark:border-slate-700 dark:bg-slate-800 flex-shrink-0 overflow-hidden rounded-lg shadow-sm">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Typography variant="subtitle" className="text-slate-700 dark:text-slate-300 font-medium">Push Content Mode</Typography>
                    <ToggleWithoutLabel label="Push Content Mode" checked={isPushMode} onChange={localHandlePushModeToggle} />
                  </div>
                  {/* --- ELIMINADO TOGGLE DE AUTO-SUBMIT DE AQUÍ --- */}
                  <div className="flex items-center justify-between">
                    <Typography variant="subtitle" className="text-slate-700 dark:text-slate-300 font-medium">Auto Scroll (AI Studio)</Typography>
                    <ToggleWithoutLabel label="Auto Scroll Content" checked={autoScrollEnabled} onChange={localHandleAutoScrollToggle} />
                  </div>
                  {process.env.NODE_ENV === 'development' && (
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => {
                        const shadowHost = (window as any).activeSidebarManager?.getShadowHost();
                        if (shadowHost?.shadowRoot) debugShadowDomStyles(shadowHost.shadowRoot);
                        else logMessage('Cannot debug: Shadow DOM not found');
                      }}>Debug Styles</Button>
                  )}
                </CardContent>
              </Card>
              <div className="border-b border-slate-200 dark:border-slate-700 mb-2">
                <div className="flex">
                  <button className={cn('py-2 px-4 font-medium text-sm', activeTab === 'availableTools' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300')} onClick={() => setActiveTab('availableTools')}>Available Tools</button>
                  <button className={cn('py-2 px-4 font-medium text-sm', activeTab === 'instructions' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300')} onClick={() => setActiveTab('instructions')}>Instructions</button>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 px-4 pb-4 overflow-hidden">
              <div className={cn('h-full overflow-y-auto scrollbar-thin', { hidden: activeTab !== 'availableTools' })}>
                <Card className="border-slate-200 dark:border-slate-700 dark:bg-slate-800"><CardContent className="p-0"><AvailableTools tools={availableTools} onExecute={communicationMethods?.sendMessage} onRefresh={localHandleRefreshTools} isRefreshing={isRefreshing} /></CardContent></Card>
              </div>
              <div className={cn('h-full overflow-y-auto scrollbar-thin', { hidden: activeTab !== 'instructions' })}>
                <Card className="border-slate-200 dark:border-slate-700 dark:bg-slate-800"><CardContent className="p-0"><InstructionManager adapter={adapter} tools={formattedTools} /></CardContent></Card>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-800 shadow-inner">
              {!isInputMinimized ? (
                <div className="relative">
                  <Button variant="ghost" size="sm" onClick={toggleInputMinimize} className="absolute top-2 right-2"><Icon name="chevron-down" size="sm" /></Button>
                  <InputArea
                    onSubmit={async text => {
                      if(adapter) {
                        logMessage(`[Sidebar] InputArea onSubmit. Text: "${text.substring(0,30)}..."`);
                        adapter.insertTextIntoInput(text);
                        await new Promise(resolve => setTimeout(resolve, 100)); 
                        logMessage('[Sidebar] InputArea: Directly attempting submission after input.');
                        adapter.triggerSubmission(); // Llama a triggerSubmission directamente
                      } else {
                        logMessage('[Sidebar] No active adapter to submit input from InputArea.');
                      }
                    }}
                    onToggleMinimize={toggleInputMinimize}
                  />
                </div>
              ) : (
                <Button variant="default" size="sm" onClick={toggleInputMinimize} className="w-full h-10"><Icon name="chevron-up" size="sm" className="mr-2" />Show Input</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper functions (ensure these are complete and correct as per your original/previous working version)
const SidebarInternalFunctions = (
  transitionTimerRef: React.MutableRefObject<number | null>, setIsTransitioning: React.Dispatch<React.SetStateAction<boolean>>, 
  isPushMode: boolean, sidebarRef: React.RefObject<HTMLDivElement>, isResizingRef: React.MutableRefObject<boolean>, setSidebarWidth: React.Dispatch<React.SetStateAction<number>>, previousWidthRef: React.MutableRefObject<number>,
  setIsPushMode: React.Dispatch<React.SetStateAction<boolean>>, 
  setAutoScrollEnabled: React.Dispatch<React.SetStateAction<boolean>>, mcpContentScriptApi: React.MutableRefObject<ContentScriptApi | null>,
  setIsRefreshing: React.Dispatch<React.SetStateAction<boolean>>, refreshTools: (force?: boolean) => Promise<any>,
  theme: Theme, setTheme: React.Dispatch<React.SetStateAction<Theme>>
) => ({
  startTransition: () => {
    if (transitionTimerRef.current !== null) clearTimeout(transitionTimerRef.current);
    setIsTransitioning(true);
    transitionTimerRef.current = window.setTimeout(() => {
      setIsTransitioning(false);
      transitionTimerRef.current = null;
    }, 500);
  },
  handleResize: (width: number) => {
      if (!isResizingRef.current) {
        isResizingRef.current = true;
        if (sidebarRef.current) sidebarRef.current.classList.add('resizing');
      }
      const constrainedWidth = Math.max(SIDEBAR_DEFAULT_WIDTH, width);
      if (isPushMode) {
        try {
          const sidebarManager = (window as any).activeSidebarManager;
          if (sidebarManager?.updatePushModeStyles) {
            sidebarManager.updatePushModeStyles(constrainedWidth);
          }
        } catch (error) {
          logMessage(`[Sidebar] Error updating push styles: ${error}`);
        }
      }
      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(() => {
          setSidebarWidth(constrainedWidth);
          if (transitionTimerRef.current !== null) clearTimeout(transitionTimerRef.current);
          transitionTimerRef.current = window.setTimeout(() => {
            if (sidebarRef.current) sidebarRef.current.classList.remove('resizing');
            previousWidthRef.current = constrainedWidth;
            isResizingRef.current = false;
            transitionTimerRef.current = null;
          }, 200);
        });
      } else {
        setSidebarWidth(constrainedWidth);
      }
  },
  handlePushModeToggle: (checked: boolean) => {
    setIsPushMode(checked);
    logMessage(`[Sidebar] Push mode ${checked ? 'enabled' : 'disabled'}`);
  },
  handleAutoScrollToggle: (checked: boolean) => {
    setAutoScrollEnabled(checked);
    if (mcpContentScriptApi.current?.setAutoScrollState) {
      mcpContentScriptApi.current.setAutoScrollState(checked);
      logMessage(`[Sidebar] Auto Scroll ${checked ? 'enabled' : 'disabled'} (global state updated)`);
    } else {
      logMessage(`[Sidebar] Auto Scroll ${checked ? 'enabled' : 'disabled'} (global state NOT updated - API missing)`);
    }
  },
  handleRefreshTools: async () => {
    logMessage('[Sidebar] Refreshing tools');
    setIsRefreshing(true);
    try {
      await refreshTools(true);
      logMessage('[Sidebar] Tools refreshed successfully');
    } catch (error) {
      logMessage(`[Sidebar] Error refreshing tools: ${error}`);
    } finally {
      setIsRefreshing(false);
    }
  },
  handleThemeToggle: () => {
    const currentIndex = THEME_CYCLE.indexOf(theme);
    const nextIndex = (currentIndex + 1) % THEME_CYCLE.length;
    const nextTheme = THEME_CYCLE[nextIndex];
    setTheme(nextTheme);
    logMessage(`[Sidebar] Theme toggled to: ${nextTheme}`);
  },
  getCurrentThemeIcon: (): 'sun' | 'moon' | 'laptop' => {
    switch (theme) {
      case 'light': return 'sun';
      case 'dark': return 'moon';
      default: return 'laptop';
    }
  }
});

export default Sidebar;