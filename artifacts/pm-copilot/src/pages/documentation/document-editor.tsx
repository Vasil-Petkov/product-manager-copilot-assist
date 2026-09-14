import { useState, useEffect, useRef } from "react";
import { useGetDocument, useUpdateDocument, useRegenerateDocument, useAcceptDocument, getGetDocumentQueryKey, getListDocumentsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, Edit2, RefreshCcw, Save, AlertTriangle, Info, Bot, CheckCircle2 } from "lucide-react";
import { MarkdownViewer } from "./markdown-viewer";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { trackEvent } from "@/lib/analytics";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";

export function DocumentEditor({ id, onBack }: { id: number, onBack: () => void }) {
  const { data: document, isLoading, refetch: refetchDoc } = useGetDocument(id);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateDoc = useUpdateDocument();
  const regenerateDoc = useRegenerateDocument();
  const acceptDoc = useAcceptDocument();

  // Use refs for stable handlers
  const lastSavedContent = useRef("");

  useEffect(() => {
    // Only update local state if we aren't dirty and aren't editing,
    // to prevent clobbering user edits when background refetches occur.
    if (document && !isEditing && content === lastSavedContent.current) {
      setContent(document.content || "");
      lastSavedContent.current = document.content || "";
    }
  }, [document, isEditing, content]);

  const isDirty = content !== lastSavedContent.current;
  const isMutating = updateDoc.isPending || regenerateDoc.isPending || acceptDoc.isPending;

  const handleSave = () => {
    if (!isDirty || !document || isMutating) return;
    trackEvent("document_draft_edited", { document_type: document.documentType });
    updateDoc.mutate({ id, data: { content, expectedRevision: document.revision } }, {
      onSuccess: (data) => {
        toast({ title: "Draft saved" });
        lastSavedContent.current = data.content;
        queryClient.setQueryData(getGetDocumentQueryKey(id), data);
        setIsEditing(false);
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      },
      onError: (error: any) => {
        const isConflict = error?.response?.status === 409 || error?.status === 409;
        toast({
          title: "Save failed",
          description: isConflict ? "Document was modified by someone else or in another tab. Please refresh and try again." : "Could not save edits. Please try again.",
          variant: "destructive"
        });
        if (isConflict) {
          refetchDoc();
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        }
      }
    });
  };

  const handleRegenerate = () => {
    if (!document || isMutating) return;
    trackEvent("document_regenerated", { document_type: document.documentType });
    regenerateDoc.mutate({ id, data: { expectedRevision: document.revision, confirmReplace: true } }, {
      onSuccess: (data) => {
        toast({ title: "Document regenerated" });
        setContent(data.content);
        lastSavedContent.current = data.content;
        queryClient.setQueryData(getGetDocumentQueryKey(id), data);
        setIsEditing(false);
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      },
      onError: (error: any) => {
        const isConflict = error?.response?.status === 409 || error?.status === 409;
        toast({
          title: "Regeneration failed",
          description: isConflict ? "Document was modified since you last viewed it. Please review the latest version before regenerating." : "An error occurred while generating the document. Please try again.",
          variant: "destructive"
        });
        if (isConflict) {
          refetchDoc();
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        }
      }
    });
  };

  const handleAccept = () => {
    if (!document || isMutating) return;

    const doAccept = (revisionToUse: number) => {
      trackEvent("document_accepted", { document_type: document.documentType });
      acceptDoc.mutate({ id, data: { expectedRevision: revisionToUse } }, {
        onSuccess: (data) => {
          toast({ title: "Document accepted as official" });
          queryClient.setQueryData(getGetDocumentQueryKey(id), data);
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
          setIsEditing(false);
        },
        onError: (error: any) => {
          const isConflict = error?.response?.status === 409 || error?.status === 409;
          toast({
            title: "Failed to accept document",
            description: isConflict ? "Document was modified since you last viewed it. Please review the latest version before accepting." : "Please try again.",
            variant: "destructive"
          });
          if (isConflict) {
            refetchDoc();
            queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
          }
        }
      });
    };

    if (isDirty) {
      updateDoc.mutate({ id, data: { content, expectedRevision: document.revision } }, {
        onSuccess: (data) => {
          lastSavedContent.current = data.content;
          queryClient.setQueryData(getGetDocumentQueryKey(id), data);
          doAccept(data.revision);
        },
        onError: (error: any) => {
          const isConflict = error?.response?.status === 409 || error?.status === 409;
          toast({
            title: "Save failed before accepting",
            description: isConflict ? "Document was modified by someone else. Please refresh." : "Could not save edits before accepting.",
            variant: "destructive"
          });
          if (isConflict) {
            refetchDoc();
            queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
          }
        }
      });
    } else {
      doAccept(document.revision);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse space-y-4 w-full max-w-2xl">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-[400px] bg-muted rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <AlertTriangle className="size-10 mb-4 opacity-50" />
        <p>Document not found or could not be loaded.</p>
        <Button variant="link" onClick={onBack}>Go back to library</Button>
      </div>
    );
  }

  const isAccepted = document.status === "accepted";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} disabled={isMutating}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-1">
              <span className="uppercase tracking-wide font-medium">{document.documentType.replace(/_/g, ' ')}</span>
              {isAccepted ? (
                <Badge variant="default" className="bg-success hover:bg-success text-success-foreground h-5"><CheckCircle2 className="size-3 mr-1" /> Official</Badge>
              ) : document.status === 'ai_generated' ? (
                <Badge variant="secondary" className="bg-ai/10 text-ai hover:bg-ai/20 border-ai/20 h-5"><Bot className="size-3 mr-1" /> AI Draft</Badge>
              ) : (
                <Badge variant="secondary" className="h-5 capitalize">{document.status.replace(/_/g, ' ')}</Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{document.title || `Untitled ${document.documentType}`}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isAccepted && (
            <>
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => { setIsEditing(false); setContent(lastSavedContent.current); }} disabled={isMutating}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={!isDirty || isMutating}>
                    <Save className="size-4 mr-2" /> Save Edits
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(true)} disabled={isMutating}>
                    <Edit2 className="size-4 mr-2" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-warning hover:text-warning hover:bg-warning/10 border-warning/30" disabled={isMutating}>
                        <RefreshCcw className="size-4 mr-2" /> Regenerate
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Regenerate Document?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will completely replace the current draft with a new AI-generated version. Any manual edits will be permanently lost.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRegenerate} className="bg-warning text-warning-foreground hover:bg-warning/90">
                          Yes, Regenerate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="bg-success text-success-foreground hover:bg-success/90" disabled={isMutating}>
                        <Check className="size-4 mr-2" /> Accept Document
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Accept as Official?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Accepting this document marks it as official and finalizes the AI draft. It will be available for stakeholders and the delivery team.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleAccept} className="bg-success text-success-foreground hover:bg-success/90">
                          Accept Document
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {!isAccepted && !isEditing && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-4 flex gap-3 text-blue-800 dark:text-blue-300 text-sm">
          <Info className="size-5 shrink-0" />
          <div>
            <p className="font-semibold">Review AI Draft</p>
            <p className="opacity-90">This document was generated by AI. Please review it carefully, edit any inaccuracies, and accept it to make it official.</p>
          </div>
        </div>
      )}

      {isAccepted && (
        <div className="bg-success/10 border border-success/20 rounded-lg p-4 flex gap-3 text-success text-sm mb-6">
          <CheckCircle2 className="size-5 shrink-0" />
          <div>
            <p className="font-semibold">Official Document</p>
            <p className="opacity-90 text-foreground/80">This document has been accepted and is now official. It cannot be regenerated.</p>
            {document.generationMetadata && (
              <p className="mt-2 text-xs opacity-70 text-foreground/60">
                Generated {format(new Date(document.generationMetadata.generatedAt), 'PPP')} • Human edited: {document.humanEdited ? 'Yes' : 'No'}
              </p>
            )}
          </div>
        </div>
      )}

      <Card className="min-h-[600px] border-none shadow-none rounded-none">
        {isEditing ? (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[600px] font-mono text-sm leading-relaxed p-6 resize-none focus-visible:ring-1 bg-background"
            placeholder="Document content (Markdown supported)..."
          />
        ) : (
          <div className="p-2 sm:p-8 bg-card rounded-lg shadow-sm border">
            <MarkdownViewer content={content} />
          </div>
        )}
      </Card>
    </div>
  );
}