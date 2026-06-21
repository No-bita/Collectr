import React, { useState, useEffect } from 'react';
import { Sparkles, Dices, Printer, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ControlPanel from './components/ControlPanel';
import TicketGrid from './components/TicketGrid';
import { DEFAULT_THEMES, generateTicket } from './utils/tambolaEngine';

const TRANSLATIONS = {
  en: {
    appTitle: 'Tambola',
    appSubtitle: 'Themed Housie Ticket Generator',
    footer: 'Tambola AI © 2026.',
    btnPrint: 'Print',
    btnExport: 'Export',
    renderingPdf: (progress) => `Rendering PDF (${progress}%)`
  },
  hi: {
    appTitle: 'तंबोला',
    appSubtitle: 'थीम आधारित तंबोला टिकट जनरेटर',
    footer: 'तंबोला AI © 2026।',
    btnPrint: 'प्रिंट',
    btnExport: 'निर्यात',
    renderingPdf: (progress) => `पीडीएफ रेंडर किया जा रहा है (${progress}%)`
  },
  gu: {
    appTitle: 'તંબોલા',
    appSubtitle: 'થીમ આધારિત તંબોલા ટિકિટ જનરેટર',
    footer: 'તંબોલા AI © 2026.',
    btnPrint: 'પ્રિન્ટ',
    btnExport: 'નિકાસ',
    renderingPdf: (progress) => `પીડીએફ રેન્ડર કરી રહ્યું છે (${progress}%)`
  }
};

export default function App() {
  const [language, setLanguage] = useState('en');
  const [theme, setTheme] = useState('custom');
  const [items, setItems] = useState([]);
  const [customTitle, setCustomTitle] = useState({ en: '', hi: '', gu: '' });
  const [ticketsCount, setTicketsCount] = useState(6);
  const [ticketStyle, setTicketStyle] = useState('royal-gold');
  const [customBgImage, setCustomBgImage] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(9);
  const [itemsPerRow, setItemsPerRow] = useState(5);
  const [ticketsPerPage, setTicketsPerPage] = useState(2);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handlePrint = () => {
    window.print();
  };

  const exportPDF = async () => {
    const printArea = document.querySelector('.print-area');
    if (!printArea) return;

    const currentTitle = 
      (customTitle[language] && customTitle[language].trim()) || 
      (customTitle['en'] && customTitle['en'].trim()) || 
      (DEFAULT_THEMES[theme]?.name[language] || (language === 'hi' ? 'तंबोला AI' : language === 'gu' ? 'તંબોલા AI' : 'TAMBOLA AI'));

    try {
      setIsExporting(true);
      setExportProgress(10);

      // Activate export mode: forces fixed A4 dimensions, removes overflow clipping
      printArea.classList.add('export-mode');

      // Give the browser a frame to apply the export-mode styles
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      const pages = printArea.querySelectorAll('.a4-page');
      if (!pages.length) {
        printArea.classList.remove('export-mode');
        setIsExporting(false);
        setExportProgress(0);
        return;
      }

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      for (let i = 0; i < pages.length; i++) {
        setExportProgress(Math.round(10 + (i / pages.length) * 80));
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          logging: false,
          width: 794,   // Fixed A4 width at 96dpi
          height: 1123,  // Fixed A4 height at 96dpi
          windowWidth: 794,
          backgroundColor: '#ffffff'
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
      // Remove export mode to restore normal preview styling
      printArea.classList.remove('export-mode');
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // Initial state is empty custom theme
  useEffect(() => {
    setItems([]);
  }, []);

  // Update page title when language changes
  useEffect(() => {
    document.title = `${t.appTitle} - ${t.appSubtitle}`;
  }, [language, t]);

  // Handle generating new tickets
  const handleGenerate = () => {
    if (items.length < rows * itemsPerRow) return;
    
    const newTickets = [];
    for (let i = 0; i < ticketsCount; i++) {
      try {
        const ticket = generateTicket(items, i, rows, columns, itemsPerRow);
        newTickets.push(ticket);
      } catch (err) {
        console.error('Failed to generate ticket:', err);
      }
    }
    setTickets(newTickets);
  };

  // Auto-generate tickets when items, rows, columns, counts, or itemsPerRow change
  useEffect(() => {
    if (items.length >= rows * itemsPerRow) {
      handleGenerate();
    }
  }, [items, rows, columns, ticketsCount, itemsPerRow, ticketsPerPage]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header (hidden on print) */}
      <header className="no-print app-header">
        <div className="app-header-logo">
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(138, 43, 226, 0.3)'
          }}>
            <Dices color="white" size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
              {t.appTitle} <span style={{ color: 'var(--accent-secondary)' }}>AI</span>
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
              {t.appSubtitle}
            </p>
          </div>
        </div>

        <div className="app-header-actions">
          <button
            onClick={handlePrint}
            className="btn btn-secondary"
            disabled={tickets.length === 0}
            style={{ padding: '8px 16px', fontSize: '14px' }}
          >
            <Printer size={16} /> {t.btnPrint}
          </button>
          
          <button
            onClick={exportPDF}
            disabled={isExporting || tickets.length === 0}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '14px' }}
          >
            {isExporting ? (
              <span>{t.renderingPdf(exportProgress)}</span>
            ) : (
              <>
                <Download size={16} /> {t.btnExport}
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="app-main-layout">
        
        {/* Left Side: Control Panel (no-print) */}
        <div className="no-print app-sidebar">
          <ControlPanel
            language={language}
            setLanguage={setLanguage}
            ticketsPerPage={ticketsPerPage}
            setTicketsPerPage={setTicketsPerPage}
            theme={theme}
            setTheme={setTheme}
            items={items}
            setItems={setItems}
            ticketsCount={ticketsCount}
            setTicketsCount={setTicketsCount}
            ticketStyle={ticketStyle}
            setTicketStyle={setTicketStyle}
            onGenerate={handleGenerate}
            customTitle={customTitle}
            setCustomTitle={setCustomTitle}
            customBgImage={customBgImage}
            setCustomBgImage={setCustomBgImage}
            rows={rows}
            setRows={setRows}
            columns={columns}
            setColumns={setColumns}
            itemsPerRow={itemsPerRow}
            setItemsPerRow={setItemsPerRow}
          />
        </div>

        {/* Right Side: Printable Tickets area */}
        <div className="app-content-area">
          {tickets.length > 0 ? (
            <TicketGrid
              tickets={tickets}
              language={language}
              theme={theme}
              ticketStyle={ticketStyle}
              customTitle={customTitle}
              customBgImage={customBgImage}
              setTickets={setTickets}
              ticketsPerPage={ticketsPerPage}
              rows={rows}
              columns={columns}
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px',
              textAlign: 'center',
              width: '100%'
            }} className="glass-panel">
              <Dices size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: '600' }}>No Tickets Generated</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px', marginTop: '4px' }}>
                Add at least {rows * columns} items in the list and click "Generate Tambola Tickets" to view your themed print sheet.
              </p>
            </div>
          )}
        </div>

      </main>

      {/* Footer (no-print) */}
      <footer className="no-print" style={{
        padding: '20px 40px',
        textAlign: 'center',
        borderTop: '1px solid var(--border-color)',
        fontSize: '12px',
        color: 'var(--text-muted)',
        marginTop: 'auto'
      }}>
        {t.footer}
      </footer>

    </div>
  );
}
