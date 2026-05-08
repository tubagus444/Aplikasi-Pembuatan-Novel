import React, { createContext, useContext, useState } from 'react';

type PanelType = 'none' | 'assistant' | 'snapshots' | 'timeline' | 'insights';

interface EditorPanelContextType {
  activePanel: PanelType;
  setActivePanel: (panel: PanelType) => void;
}

export const EditorPanelContext = createContext<EditorPanelContextType>({
  activePanel: 'none',
  setActivePanel: () => {},
});

export const EditorPanelProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [activePanel, setActivePanel] = useState<PanelType>('none');
  return (
    <EditorPanelContext.Provider value={{activePanel, setActivePanel}}>
      {children}
    </EditorPanelContext.Provider>
  );
};

export const useEditorPanel = () => useContext(EditorPanelContext);
