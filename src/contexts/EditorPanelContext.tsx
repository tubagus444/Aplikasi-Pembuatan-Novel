import React, { createContext, useContext, useState } from 'react';

type PanelType = 'none' | 'assistant' | 'snapshots' | 'insights';

interface EditorPanelContextType {
  activePanel: PanelType;
  setActivePanel: (panel: PanelType) => void;
  saveStatus: string;
  setSaveStatus: (status: string) => void;
}

export const EditorPanelContext = createContext<EditorPanelContextType>({
  activePanel: 'none',
  setActivePanel: () => {},
  saveStatus: '',
  setSaveStatus: () => {},
});

export const EditorPanelProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [activePanel, setActivePanel] = useState<PanelType>('none');
  const [saveStatus, setSaveStatus] = useState<string>('');

  return (
    <EditorPanelContext.Provider value={{
      activePanel, 
      setActivePanel,
      saveStatus,
      setSaveStatus
    }}>
      {children}
    </EditorPanelContext.Provider>
  );
};

export const useEditorPanel = () => useContext(EditorPanelContext);
