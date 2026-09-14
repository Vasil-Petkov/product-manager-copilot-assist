import { useState } from "react";
import { DocumentType } from "@workspace/api-client-react";
import { DocumentLibrary } from "./document-library";
import { DocumentWizard } from "./document-wizard";
import { DocumentEditor } from "./document-editor";

export default function Documentation() {
  const [view, setView] = useState<'library' | 'wizard' | 'editor'>('library');
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [activeDocId, setActiveDocId] = useState<number | null>(null);

  const handleCreateNew = (type: DocumentType) => {
    setSelectedType(type);
    setView('wizard');
  };

  const handleEditDoc = (id: number) => {
    setActiveDocId(id);
    setView('editor');
  };

  const handleDocumentGenerated = (id: number) => {
    setActiveDocId(id);
    setView('editor');
  };

  const handleBackToLibrary = () => {
    setView('library');
    setSelectedType(null);
    setActiveDocId(null);
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto w-full">
      {view === 'library' && (
        <DocumentLibrary onCreateNew={handleCreateNew} onOpenDoc={handleEditDoc} />
      )}
      {view === 'wizard' && selectedType && (
        <DocumentWizard
          type={selectedType}
          onCancel={handleBackToLibrary}
          onSuccess={handleDocumentGenerated}
        />
      )}
      {view === 'editor' && activeDocId && (
        <DocumentEditor
          id={activeDocId}
          onBack={handleBackToLibrary}
        />
      )}
    </div>
  );
}