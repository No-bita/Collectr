import React, { useRef, useState } from 'react';
import { Download, Printer, Share2, Sparkles, Check, CheckCircle2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { DEFAULT_THEMES } from '../utils/tambolaEngine';

export default function TicketGrid({
  tickets,
  language,
  theme,
  ticketStyle,
  ticketsPerPage,
  customTitle,
  setTickets
}) {
  const [markedCells, setMarkedCells] = useState({}); // { [ticketId-row-col]: boolean }
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const containerRef = useRef(null);

  // Compute current header title dynamically supporting translation fallbacks
  const currentTitle = customTitle.trim() || (DEFAULT_THEMES[theme]?.name[language] || 'TAMBOLA');

  // Get current font family based on selected language
  const getFontFamily = () => {
    if (language === 'gu') return 'var(--font-gujarati)';
    if (language === 'hi') return 'var(--font-devanagari)';
    return 'var(--font-sans)';
  };

  // Get item name depending on language selection
  const getItemName = (item) => {
    if (!item) return '';
    return item.name[language] || item.name['en'] || item.name;
  };

  // Toggle cell marked status (gameplay simulation)
  const toggleCell = (ticketId, rowIndex, colIndex) => {
    const key = `${ticketId}-${rowIndex}-${colIndex}`;
    setMarkedCells(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Divide tickets into pages based on density setting
  const getPages = () => {
    const pages = [];
    for (let i = 0; i < tickets.length; i += ticketsPerPage) {
      pages.push(tickets.slice(i, i + ticketsPerPage));
    }
    return pages;
  };

  // Capture single ticket to PNG
  const downloadSingleTicketPNG = async (ticketId, index) => {
    const ticketElement = document.getElementById(`ticket-element-${ticketId}`);
    if (!ticketElement) return;

    try {
      setIsExporting(true);
      const canvas = await html2canvas(ticketElement, {
        scale: 3,
        useCORS: true,
        backgroundColor: null
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `tambola-ticket-${index + 1}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting ticket to PNG:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Share single ticket via Web Share API or WhatsApp
  const shareSingleTicket = async (ticketId, index) => {
    const ticketElement = document.getElementById(`ticket-element-${ticketId}`);
    if (!ticketElement) return;

    try {
      setIsExporting(true);
      const canvas = await html2canvas(ticketElement, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: null
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `tambola-ticket-${index + 1}.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Tambola Ticket #${index + 1}`,
            text: `Here is your Ticket #${index + 1} for ${currentTitle}!`
          });
        } else {
          // Fallback - copy image to clipboard and notify
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            alert('Ticket image copied to clipboard! You can now paste and share it in WhatsApp.');
          } catch (e) {
            // Direct WhatsApp Web text link fallback
            const message = encodeURIComponent(`Let's play Tambola! Here is ticket #${index + 1} for ${currentTitle}. Please request your card!`);
            window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
          }
        }
      }, 'image/png');
    } catch (err) {
      console.error('Error sharing ticket:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Trigger Browser Print Dialogue
  const handlePrint = () => {
    window.print();
  };

  // Export full pages PDF
  const exportPDF = async () => {
    const pages = document.querySelectorAll('.a4-page');
    if (!pages.length) return;

    try {
      setIsExporting(true);
      setExportProgress(10);
      
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      for (let i = 0; i < pages.length; i++) {
        setExportProgress(Math.round(10 + (i / pages.length) * 80));
        const canvas = await html2canvas(pages[i], {
          scale: 2, // good resolution vs file size trade-off
          useCORS: true,
          logging: false
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        if (i > 0) {
          doc.addPage();
        }
        doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      setExportProgress(95);
      doc.save(`${currentTitle.replace(/\s+/g, '_')}_Tickets.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Could not generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const pages = getPages();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* Top Floating Action Bar */}
      <div className="glass-panel no-print" style={{
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Live Sheets Preview</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Showing {tickets.length} tickets spread across {pages.length} A4 page(s)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handlePrint}
            className="btn btn-secondary"
          >
            <Printer size={18} /> Print
          </button>
          
          <button
            onClick={exportPDF}
            disabled={isExporting}
            className="btn btn-primary"
          >
            {isExporting ? (
              <span>Rendering PDF ({exportProgress}%)</span>
            ) : (
              <>
                <Download size={18} /> Export PDF (A4)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid styling based on tickets density */}
      <div className="print-area" ref={containerRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
        {pages.map((pageTickets, pageIdx) => (
          <div
            key={pageIdx}
            className={`a4-page a4-grid-${ticketsPerPage}`}
          >
            {pageTickets.map((ticket, ticketIdx) => {
              const globalIndex = pageIdx * ticketsPerPage + ticketIdx;
              return (
                <div
                  key={ticket.id}
                  id={`ticket-element-${ticket.id}`}
                  className={`ticket-wrapper theme-${ticketStyle}`}
                  style={{ fontFamily: getFontFamily() }}
                >
                  
                  {/* Action overlays visible on hover inside browser */}
                  <div className="no-print" style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    display: 'flex',
                    gap: '6px',
                    zIndex: 10
                  }}>
                    <button
                      onClick={() => shareSingleTicket(ticket.id, globalIndex)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px'
                      }}
                      title="Share to WhatsApp / Copy link"
                    >
                      <Share2 size={12} /> Share
                    </button>
                    <button
                      onClick={() => downloadSingleTicketPNG(ticket.id, globalIndex)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px'
                      }}
                      title="Download as PNG"
                    >
                      <Download size={12} /> PNG
                    </button>
                  </div>

                  {/* Ticket Header Banner */}
                  <div className="ticket-header">
                    <span className="ticket-title">{currentTitle}</span>
                    <span className="ticket-no">Card #{globalIndex + 1}</span>
                  </div>

                  {/* 3x9 Ticket Grid */}
                  <div className="ticket-grid">
                    {ticket.grid.map((row, rIdx) => 
                      row.map((item, cIdx) => {
                        const cellKey = `${ticket.id}-${rIdx}-${cIdx}`;
                        const isMarked = !!markedCells[cellKey];
                        
                        if (item === null) {
                          return (
                            <div
                              key={`${rIdx}-${cIdx}`}
                              className="ticket-cell empty"
                            />
                          );
                        }

                        return (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            onClick={() => toggleCell(ticket.id, rIdx, cIdx)}
                            className={`ticket-cell filled ${isMarked ? 'marked' : ''}`}
                          >
                            <span className="cell-emoji">{item.emoji}</span>
                            <span className="cell-name">{getItemName(item)}</span>
                            {isMarked && (
                              <div style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                background: 'rgba(239, 68, 68, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none'
                              }}>
                                <div style={{
                                  border: '2px solid #ef4444',
                                  borderRadius: '50%',
                                  width: '26px',
                                  height: '26px',
                                  transform: 'rotate(-12deg)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ef4444',
                                  fontSize: '8px',
                                  fontWeight: '900',
                                  textTransform: 'uppercase'
                                }}>
                                  Cut
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Ticket footer info */}
                  <div className="ticket-meta">
                    <span>Rules: 5 per row | 15 total</span>
                    <span style={{ fontSize: '7px' }}>Generated by Lekho Tambola AI</span>
                  </div>

                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
