/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { FileDown, FileText, Globe, Loader2, CheckCircle2, X, FileEdit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/src/db';
import { Project, Chapter } from '@/src/types';
import { stripHtml, htmlToMarkdown } from '@/src/lib/editorUtils';

interface ExportManagerProps {
  projectId: number;
  project: Project | undefined;
  onClose: () => void;
}

type ExportStatus = 'idle' | 'processing' | 'success';

export function ExportManager({ projectId, project, onClose }: ExportManagerProps) {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [format, setFormat] = useState<'md' | 'pdf' | 'docx'>('md');

  const getAllChaptersPath = async () => {
    return await db.chapters.where('projectId').equals(projectId).sortBy('order');
  };

  const exportMarkdown = async (chapters: Chapter[]) => {
    let content = `# ${project?.name || 'Untitled Project'}\n\n`;
    chapters.forEach(ch => {
      content += `## ${ch.title}\n\n${htmlToMarkdown(ch.content)}\n\n`;
    });
    const blob = new Blob([content], { type: 'text/markdown' });
    saveAs(blob, `${project?.name || 'Manuscript'}.md`);
  };

  const exportPDF = async (chapters: Chapter[]) => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 25.4; // 1 inch margin
    const innerWidth = pageWidth - margin * 2;
    const lineHeight = 7; // Improved line height for 11pt font
    let y = margin;

    // Document styling
    doc.setFont('times', 'normal');

    // Title Page (Simplified)
    doc.setFontSize(24);
    doc.text(project?.name || 'Manuscript', pageWidth / 2, y + 40, { align: 'center' });
    doc.setFontSize(14);
    doc.text('A Novel Manuscript', pageWidth / 2, y + 55, { align: 'center' });
    
    doc.addPage();
    y = margin;

    chapters.forEach((ch, index) => {
      // Check for page overflow before chapter title
      if (y > pageHeight - 40) {
        doc.addPage();
        y = margin;
      }
      
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(ch.title || `Chapter ${index + 1}`, margin, y);
      y += 12;
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      
      // Parse paragraphs from HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = ch.content || '';
      const paragraphs = Array.from(tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6'));
      
      const contentNodes = paragraphs.length > 0 ? paragraphs : [tempDiv];
      
      contentNodes.forEach((pNode) => {
        const text = pNode.textContent?.trim() || '';
        if (!text) return;
        
        const lines = doc.splitTextToSize(text, innerWidth);
        
        lines.forEach((line: string) => {
          if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin, y);
          y += lineHeight;
        });
        
        y += 4; // Extra space after paragraph
      });
      
      y += 10; // Space between chapters
    });

    doc.save(`${project?.name || 'Manuscript'}.pdf`);
  };

  const htmlToDocxElements = (html: string): Paragraph[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const elements: Paragraph[] = [];

    const processNode = (node: Node, styles: { bold?: boolean; italics?: boolean } = {}): TextRun[] => {
      let runs: TextRun[] = [];
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) {
          runs.push(new TextRun({
            text: node.textContent,
            bold: styles.bold,
            italics: styles.italics,
            size: 24, // 12pt
            font: 'Times New Roman'
          }));
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const nextStyles = { ...styles };
        if (el.tagName === 'STRONG' || el.tagName === 'B') nextStyles.bold = true;
        if (el.tagName === 'EM' || el.tagName === 'I') nextStyles.italics = true;
        
        el.childNodes.forEach(child => {
          runs = runs.concat(processNode(child, nextStyles));
        });
      }
      return runs;
    };

    doc.body.childNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const children: TextRun[] = [];
        el.childNodes.forEach(child => {
          children.push(...processNode(child));
        });

        if (el.tagName === 'P') {
          elements.push(new Paragraph({ 
            children, 
            spacing: { after: 200, line: 360 }, // 1.5 line height
            alignment: AlignmentType.JUSTIFIED
          }));
        } else if (el.tagName.startsWith('H')) {
          const level = parseInt(el.tagName.substring(1));
          const headingMap: Record<number, any> = {
            1: HeadingLevel.HEADING_1,
            2: HeadingLevel.HEADING_2,
            3: HeadingLevel.HEADING_3,
          };
          elements.push(new Paragraph({
            children,
            heading: headingMap[level] || HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }));
        } else if (children.length > 0) {
          // Handle other elements as simple paragraphs
          elements.push(new Paragraph({ children, spacing: { after: 200 } }));
        }
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
         elements.push(new Paragraph({
           children: [new TextRun({ text: node.textContent, size: 24, font: 'Times New Roman' })],
           spacing: { after: 200 }
         }));
      }
    });

    return elements;
  };

  const exportDocx = async (chapters: Chapter[]) => {
    const sections = chapters.map(ch => {
      const heading = new Paragraph({
        text: ch.title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 }
      });

      const bodyElements = htmlToDocxElements(ch.content || '');
      
      return [heading, ...bodyElements];
    }).flat();

    const doc = new Document({
      title: project?.name,
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children: sections
      }]
    });

    const buffer = await Packer.toBlob(doc);
    saveAs(buffer, `${project?.name || 'Manuscript'}.docx`);
  };

  const handleExport = async () => {
    setStatus('processing');
    try {
      const chapters = await getAllChaptersPath();
      
      switch (format) {
        case 'md': await exportMarkdown(chapters); break;
        case 'pdf': await exportPDF(chapters); break;
        case 'docx': await exportDocx(chapters); break;
      }
      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        onClose();
      }, 2000);
    } catch (error) {
      console.error(error);
      setStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-3xl overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        <header className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Export Manuscript</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">Prepare your story for the world.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500">
            <X size={18} />
          </button>
        </header>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'md', label: 'Markdown', icon: FileEdit, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' },
              { id: 'pdf', label: 'PDF Document', icon: FileText, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
              { id: 'docx', label: 'Word (DOCX)', icon: Globe, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id as any)}
                className={`flex flex-col items-center gap-3 p-4 rounded-xl border transition-all ${
                  format === f.id 
                    ? 'border-indigo-500 ring-4 ring-indigo-50 dark:ring-indigo-900/10 bg-white dark:bg-slate-800' 
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-800 dark:hover:border-slate-700 opacity-60'
                }`}
              >
                <div className={`p-2 rounded-lg ${f.color}`}>
                  <f.icon size={20} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider dark:text-slate-300">{f.label}</span>
              </button>
            ))}
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
            <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Export Summary</h3>
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Total Words:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{project?.wordGoal?.toLocaleString()} (est)</span>
              </div>
              <div className="flex justify-between">
                <span>Layout:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Standard A4</span>
              </div>
            </div>
          </div>

          <button 
            disabled={status !== 'idle'}
            onClick={handleExport}
            className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 text-sm font-bold transition-all shadow-lg ${
              status === 'success' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50'
            }`}
          >
            {status === 'idle' && (
              <>
                <FileDown size={18} />
                Generate {format.toUpperCase()}
              </>
            )}
            {status === 'processing' && (
              <>
                <Loader2 size={18} className="animate-spin" />
                Brewing your naskah...
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 size={18} />
                Export Complete!
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
